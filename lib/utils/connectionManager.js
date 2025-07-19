'use strict';

const MongoClient = require('mongodb').MongoClient;
const _ = require('lodash');

function init(env) {
  const connectionManager = {};
  
  // Connection cache - stores database connections per tenant
  const connectionCache = new Map();
  
  // Master database connection (for tenants and users)
  let masterConnection = null;
  let masterDb = null;
  
  // Connection options
  const defaultOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 60000,
    waitQueueTimeoutMS: 30000
  };

  // Get master database URI
  function getMasterUri() {
    return env.MASTER_MONGODB_URI || env.storageURI;
  }

  // Extract base URI without database name
  function getBaseUri(uri) {
    // Remove database name from URI
    const parts = uri.split('/');
    if (parts.length > 3) {
      parts.pop(); // Remove database name
      return parts.join('/');
    }
    return uri;
  }

  // Initialize master database connection
  connectionManager.initMaster = async function() {
    if (masterConnection && masterDb) {
      return masterDb;
    }

    const uri = getMasterUri();
    if (!uri) {
      throw new Error('Master MongoDB URI is required');
    }

    try {
      console.log('Connecting to master database...');
      masterConnection = new MongoClient(uri, defaultOptions);
      await masterConnection.connect();
      
      const dbName = masterConnection.s.options.dbName || 'nightscout_master';
      masterDb = masterConnection.db(dbName);
      
      console.log('Master database connected successfully');
      return masterDb;
    } catch (err) {
      console.error('Failed to connect to master database:', err);
      throw err;
    }
  };

  // Get master database
  connectionManager.getMasterDb = function() {
    if (!masterDb) {
      throw new Error('Master database not initialized');
    }
    return masterDb;
  };

  // Get or create tenant database connection
  connectionManager.getTenantDb = async function(tenant) {
    if (!tenant || !tenant.databaseName) {
      throw new Error('Invalid tenant data');
    }

    const dbName = tenant.databaseName;
    
    // Check cache first
    if (connectionCache.has(dbName)) {
      const cached = connectionCache.get(dbName);
      // Verify connection is still alive
      try {
        await cached.db.admin().ping();
        cached.lastAccessed = new Date();
        return cached.db;
      } catch (err) {
        // Connection is dead, remove from cache
        console.log(`Cached connection for ${dbName} is dead, removing...`);
        connectionCache.delete(dbName);
      }
    }

    // Create new connection
    try {
      console.log(`Creating new connection for tenant database: ${dbName}`);
      const baseUri = getBaseUri(getMasterUri());
      const tenantUri = `${baseUri}/${dbName}`;
      
      const client = new MongoClient(tenantUri, defaultOptions);
      await client.connect();
      
      const db = client.db(dbName);
      
      // Verify connection
      await db.admin().ping();
      
      // Cache the connection
      connectionCache.set(dbName, {
        client: client,
        db: db,
        tenantId: tenant.tenantId,
        created: new Date(),
        lastAccessed: new Date()
      });
      
      console.log(`Tenant database ${dbName} connected successfully`);
      return db;
    } catch (err) {
      console.error(`Failed to connect to tenant database ${dbName}:`, err);
      throw err;
    }
  };

  // Close tenant connection
  connectionManager.closeTenantConnection = async function(databaseName) {
    if (connectionCache.has(databaseName)) {
      const cached = connectionCache.get(databaseName);
      try {
        await cached.client.close();
        connectionCache.delete(databaseName);
        console.log(`Closed connection for tenant database: ${databaseName}`);
      } catch (err) {
        console.error(`Error closing connection for ${databaseName}:`, err);
      }
    }
  };

  // Clean up idle connections
  connectionManager.cleanupIdleConnections = async function(maxIdleMinutes = 30) {
    const now = new Date();
    const maxIdleMs = maxIdleMinutes * 60 * 1000;
    
    for (const [dbName, cached] of connectionCache.entries()) {
      const idleTime = now - cached.lastAccessed;
      if (idleTime > maxIdleMs) {
        console.log(`Cleaning up idle connection for ${dbName}`);
        await connectionManager.closeTenantConnection(dbName);
      }
    }
  };

  // Get connection statistics
  connectionManager.getStats = function() {
    const stats = {
      master: {
        connected: !!masterConnection,
        database: masterDb ? masterDb.databaseName : null
      },
      tenants: {
        total: connectionCache.size,
        connections: []
      }
    };
    
    for (const [dbName, cached] of connectionCache.entries()) {
      stats.tenants.connections.push({
        database: dbName,
        tenantId: cached.tenantId,
        created: cached.created,
        lastAccessed: cached.lastAccessed,
        idleMinutes: Math.floor((new Date() - cached.lastAccessed) / 60000)
      });
    }
    
    return stats;
  };

  // Close all connections
  connectionManager.closeAll = async function() {
    console.log('Closing all database connections...');
    
    // Close tenant connections
    for (const [dbName] of connectionCache.entries()) {
      await connectionManager.closeTenantConnection(dbName);
    }
    
    // Close master connection
    if (masterConnection) {
      try {
        await masterConnection.close();
        masterConnection = null;
        masterDb = null;
        console.log('Master database connection closed');
      } catch (err) {
        console.error('Error closing master connection:', err);
      }
    }
  };

  // Create tenant database and collections
  connectionManager.createTenantDatabase = async function(tenant) {
    const db = await connectionManager.getTenantDb(tenant);
    
    // Create required collections with indexes
    const collections = [
      { name: 'entries', indexes: [{ date: -1 }, { type: 1 }] },
      { name: 'treatments', indexes: [{ created_at: -1 }, { eventType: 1 }] },
      { name: 'devicestatus', indexes: [{ created_at: -1 }, { device: 1 }] },
      { name: 'profile', indexes: [{ startDate: -1 }] },
      { name: 'food', indexes: [{ name: 1 }] },
      { name: 'activity', indexes: [{ created_at: -1 }] },
      { name: 'settings', indexes: [{ name: 1 }] }
    ];
    
    for (const col of collections) {
      try {
        await db.createCollection(col.name);
        const collection = db.collection(col.name);
        
        // Create indexes
        for (const index of col.indexes) {
          await collection.createIndex(index, { background: true });
        }
        
        console.log(`Created collection ${col.name} for tenant ${tenant.subdomain}`);
      } catch (err) {
        if (err.code !== 48) { // 48 = collection already exists
          throw err;
        }
      }
    }
    
    return db;
  };

  // Set up periodic cleanup
  setInterval(() => {
    connectionManager.cleanupIdleConnections().catch(err => {
      console.error('Error during connection cleanup:', err);
    });
  }, 5 * 60 * 1000); // Run every 5 minutes

  return connectionManager;
}

module.exports = init;