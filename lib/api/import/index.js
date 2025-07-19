'use strict';

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

function configure(app, wares, ctx, env) {
  const express = require('express');
  const api = express.Router();
  
  // Import data from another Nightscout instance
  api.post('/import', async function(req, res) {
    // Check authentication
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        status: 403,
        message: 'Admin access required'
      });
    }
    try {
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
      const sourceClient = new MongoClient(sourceUri);
      await sourceClient.connect();
      const sourceDb = sourceClient.db();
      
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
      supportedCollections: ['entries', 'treatments', 'devicestatus', 'profile', 'food', 'activity']
    });
  });
  
  return api;
}

module.exports = configure;