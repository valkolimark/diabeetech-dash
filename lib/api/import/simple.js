'use strict';

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

function configure(app, wares, ctx, env) {
  const express = require('express');
  const api = express.Router();
  
  // Temporary simple import endpoint
  api.post('/simple', async function(req, res) {
    let sourceClient, targetClient;
    
    try {
      // Simple auth check - just check for a secret key
      const secretKey = req.headers['x-import-key'];
      if (secretKey !== 'temporary-import-2024') {
        return res.status(403).json({ status: 403, message: 'Invalid import key' });
      }
      
      const tenantSubdomain = 'clinic2';
      const sourceUri = 'mongodb+srv://arigold:yvJp2VbaeoShpSX3@nightscoutcluster.nkz27.mongodb.net/?retryWrites=true&w=majority&appName=ari-cluster';
      const days = 365; // Import last year of data
      
      console.log('Starting simple import...');
      
      // Connect to target database
      // Use the correct MongoDB URI from environment
      const targetUri = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';
      console.log('Using target URI for master database');
      
      targetClient = new MongoClient(targetUri, {
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
      sourceClient = new MongoClient(sourceUri, {
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
      const dbsToCheck = ['nightscout', 'heroku_4r0q2jxg', 'ari-gluco', 'cgm', 'ari-glucocom'];
      for (const dbName of dbsToCheck) {
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
        const totalEntries = await entriesCollection.countDocuments({});
        console.log(`Total entries in source: ${totalEntries}`);
        
        // Get a sample entry to check date format
        const sampleEntry = await entriesCollection.findOne({});
        if (sampleEntry) {
          console.log('Sample entry date field:', sampleEntry.date, 'type:', typeof sampleEntry.date);
        }
        
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
        tenant: tenantSubdomain,
        sourceDatabase: sourceDb.databaseName,
        cutoffDate: cutoffDate.toISOString()
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