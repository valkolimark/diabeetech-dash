'use strict';

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

function configure(app, wares, ctx, env) {
  const express = require('express');
  const api = express.Router();
  
  // Temporary simple import endpoint
  api.post('/simple', async function(req, res) {
    try {
      // Simple auth check - just check for a secret key
      const secretKey = req.headers['x-import-key'];
      if (secretKey !== 'temporary-import-2024') {
        return res.status(403).json({ status: 403, message: 'Invalid import key' });
      }
      
      const tenantSubdomain = 'clinic2';
      const sourceUri = 'mongodb+srv://arigold:yvJp2VbaeoShpSX3@nightscoutcluster.nkz27.mongodb.net/?retryWrites=true&w=majority&appName=ari-cluster';
      const days = 30;
      
      console.log('Starting simple import...');
      
      // Connect to target database
      const targetUri = process.env.MONGODB_URI;
      if (!targetUri) {
        throw new Error('MONGODB_URI not configured');
      }
      
      const targetClient = new MongoClient(targetUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      await targetClient.connect();
      console.log('Connected to target database');
      
      // Get tenant
      const masterDb = targetClient.db();
      const tenant = await masterDb.collection('tenants').findOne({ subdomain: tenantSubdomain });
      if (!tenant) {
        throw new Error('Tenant not found');
      }
      
      const tenantDbName = tenant.databaseName || `nightscout-tenant-${tenantSubdomain}`;
      const tenantDb = targetClient.db(tenantDbName);
      
      // Connect to source
      const sourceClient = new MongoClient(sourceUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      await sourceClient.connect();
      console.log('Connected to source');
      
      // List databases
      const adminDb = sourceClient.db().admin();
      const dbList = await adminDb.listDatabases();
      const dbNames = dbList.databases.map(db => db.name);
      console.log('Available databases:', dbNames);
      
      // Find the right database
      let sourceDb;
      for (const dbName of ['nightscout', 'heroku_4r0q2jxg', 'ari-gluco', 'cgm']) {
        if (dbNames.includes(dbName)) {
          sourceDb = sourceClient.db(dbName);
          console.log(`Using database: ${dbName}`);
          break;
        }
      }
      
      if (!sourceDb) {
        // Use first non-system database
        const userDb = dbList.databases.find(db => !['admin', 'local', 'config'].includes(db.name));
        if (userDb) {
          sourceDb = sourceClient.db(userDb.name);
          console.log(`Using database: ${userDb.name}`);
        } else {
          throw new Error('No suitable database found');
        }
      }
      
      // Import entries
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const results = {};
      
      // Import entries (glucose data)
      try {
        const entriesCollection = sourceDb.collection('entries');
        const entries = await entriesCollection.find({
          date: { $gte: cutoffDate.getTime() }
        }).limit(5000).toArray();
        
        if (entries.length > 0) {
          const transformed = entries.map(doc => ({
            ...doc,
            _id: crypto.randomBytes(12).toString('hex'),
            tenantId: tenant.tenantId,
            migratedAt: new Date()
          }));
          
          await tenantDb.collection('entries').insertMany(transformed, { ordered: false });
          results.entries = entries.length;
        } else {
          results.entries = 0;
        }
      } catch (err) {
        console.error('Error importing entries:', err);
        results.entries = { error: err.message };
      }
      
      // Import treatments
      try {
        const treatmentsCollection = sourceDb.collection('treatments');
        const treatments = await treatmentsCollection.find({
          created_at: { $gte: cutoffDate.toISOString() }
        }).limit(1000).toArray();
        
        if (treatments.length > 0) {
          const transformed = treatments.map(doc => ({
            ...doc,
            _id: crypto.randomBytes(12).toString('hex'),
            tenantId: tenant.tenantId,
            migratedAt: new Date()
          }));
          
          await tenantDb.collection('treatments').insertMany(transformed, { ordered: false });
          results.treatments = treatments.length;
        } else {
          results.treatments = 0;
        }
      } catch (err) {
        console.error('Error importing treatments:', err);
        results.treatments = { error: err.message };
      }
      
      await sourceClient.close();
      await targetClient.close();
      
      res.json({
        status: 200,
        message: 'Import completed',
        results: results,
        tenant: tenantSubdomain
      });
      
    } catch (error) {
      console.error('Simple import error:', error);
      
      // Clean up connections
      try {
        if (sourceClient) await sourceClient.close();
        if (targetClient) await targetClient.close();
      } catch (cleanupError) {
        console.error('Error closing connections:', cleanupError);
      }
      
      res.status(500).json({
        status: 500,
        message: 'Import failed',
        error: error.message
      });
    }
  });
  
  return api;
}

module.exports = configure;