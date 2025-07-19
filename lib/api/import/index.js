'use strict';

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

function configure(app, wares, ctx, env) {
  const express = require('express');
  const api = express.Router();
  
  // Import data from another Nightscout instance
  api.post('/import', async function(req, res) {
    try {
      // Check authentication
      if (!req.user || req.user.role !== 'admin') {
        console.log('Auth check failed:', req.user);
        return res.status(403).json({
          status: 403,
          message: 'Admin access required',
          user: req.user ? { role: req.user.role, email: req.user.email } : 'No user'
        });
      }
      const { sourceUri, days = 30, collections = ['entries', 'treatments', 'devicestatus', 'profile'] } = req.body;
      
      if (!sourceUri) {
        return res.status(400).json({ 
          status: 400, 
          message: 'sourceUri is required' 
        });
      }
      
      const tenant = req.tenant;
      const tenantDb = req.ctx.store.db;
      
      // Connect to source database
      console.log('Attempting to connect to source database...');
      const sourceClient = new MongoClient(sourceUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      try {
        await sourceClient.connect();
        console.log('Connected to source database');
      } catch (connError) {
        console.error('Failed to connect to source database:', connError);
        throw new Error(`Failed to connect to source database: ${connError.message}`);
      }
      
      // Extract database name from URI or use default
      let dbName = 'nightscout'; // Default Nightscout database name
      
      // Check if database name is specified in the URI
      const uriParts = sourceUri.match(/\/([^/?]+)(\?|$)/);
      if (uriParts && uriParts[1] && uriParts[1] !== '') {
        dbName = uriParts[1];
      }
      
      console.log(`Using source database: ${dbName}`);
      const sourceDb = sourceClient.db(dbName);
      
      // Calculate date filter
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const dateFilter = { 
        $or: [
          { date: { $gte: cutoffDate.getTime() } },
          { created_at: { $gte: cutoffDate.toISOString() } },
          { createdAt: { $gte: cutoffDate } }
        ]
      };
      
      const results = {};
      
      // Import each collection
      for (const collectionName of collections) {
        try {
          const sourceCollection = sourceDb.collection(collectionName);
          const targetCollection = tenantDb.collection(collectionName);
          
          // Use appropriate filter
          const filter = (collectionName === 'profile' || collectionName === 'food') ? {} : dateFilter;
          
          const documents = await sourceCollection.find(filter).toArray();
          
          if (documents.length > 0) {
            // Add tenant ID to each document
            const transformedDocs = documents.map(doc => ({
              ...doc,
              _id: crypto.randomBytes(12).toString('hex'),
              tenantId: tenant.tenantId,
              migratedAt: new Date(),
              originalId: doc._id
            }));
            
            await targetCollection.insertMany(transformedDocs, { ordered: false });
            results[collectionName] = documents.length;
          } else {
            results[collectionName] = 0;
          }
        } catch (err) {
          console.error(`Error importing ${collectionName}:`, err);
          results[collectionName] = { error: err.message };
        }
      }
      
      await sourceClient.close();
      
      res.json({
        status: 200,
        message: 'Import completed',
        results: results,
        tenant: tenant.subdomain
      });
      
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({
        status: 500,
        message: 'Import failed',
        error: error.message
      });
    }
  });
  
  // Get import status
  api.get('/status', function(req, res) {
    res.json({
      status: 200,
      message: 'Import endpoint available',
      supportedCollections: ['entries', 'treatments', 'devicestatus', 'profile', 'food', 'activity'],
      authenticated: !!req.user,
      user: req.user ? { email: req.user.email, role: req.user.role } : null
    });
  });
  
  // Test endpoint to verify database connection
  api.post('/test', async function(req, res) {
    try {
      const { sourceUri } = req.body;
      
      if (!sourceUri) {
        return res.status(400).json({ 
          status: 400, 
          message: 'sourceUri is required' 
        });
      }
      
      console.log('Testing connection to:', sourceUri);
      const client = new MongoClient(sourceUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000
      });
      
      await client.connect();
      const admin = client.db().admin();
      const dbs = await admin.listDatabases();
      await client.close();
      
      res.json({
        status: 200,
        message: 'Connection successful',
        databases: dbs.databases.map(db => db.name)
      });
      
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({
        status: 500,
        message: 'Connection failed',
        error: error.message
      });
    }
  });
  
  return api;
}

module.exports = configure;