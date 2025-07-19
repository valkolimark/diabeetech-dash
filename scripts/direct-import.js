#!/usr/bin/env node
'use strict';

/**
 * Direct import script to run on the server
 * This bypasses the API and imports data directly
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

async function directImport() {
  const sourceUri = 'mongodb+srv://arigold:yvJp2VbaeoShpSX3@nightscoutcluster.nkz27.mongodb.net/?retryWrites=true&w=majority&appName=ari-cluster';
  const targetUri = process.env.MONGODB_URI;
  const tenantSubdomain = 'clinic2';
  const days = 30;
  
  if (!targetUri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }
  
  console.log('Starting direct import...');
  
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  
  try {
    // Connect to source
    console.log('Connecting to source database...');
    await sourceClient.connect();
    
    // List databases to find the right one
    const adminDb = sourceClient.db().admin();
    const dbList = await adminDb.listDatabases();
    console.log('Available databases:', dbList.databases.map(db => db.name));
    
    // Try common Nightscout database names
    let sourceDb;
    for (const dbName of ['nightscout', 'heroku_4r0q2jxg', 'nightscout-prod', 'cgm']) {
      if (dbList.databases.some(db => db.name === dbName)) {
        sourceDb = sourceClient.db(dbName);
        console.log(`Using source database: ${dbName}`);
        break;
      }
    }
    
    if (!sourceDb) {
      // Use the first non-system database
      const userDb = dbList.databases.find(db => !['admin', 'local', 'config'].includes(db.name));
      if (userDb) {
        sourceDb = sourceClient.db(userDb.name);
        console.log(`Using source database: ${userDb.name}`);
      } else {
        throw new Error('No suitable database found');
      }
    }
    
    // Connect to target
    console.log('Connecting to target database...');
    await targetClient.connect();
    const masterDb = targetClient.db();
    
    // Find tenant
    const tenant = await masterDb.collection('tenants').findOne({ subdomain: tenantSubdomain });
    if (!tenant) {
      throw new Error(`Tenant ${tenantSubdomain} not found`);
    }
    
    const tenantDbName = tenant.databaseName || `nightscout-tenant-${tenantSubdomain}`;
    const tenantDb = targetClient.db(tenantDbName);
    console.log(`Target database: ${tenantDbName}`);
    
    // Import data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    console.log(`Importing data from last ${days} days (since ${cutoffDate.toISOString()})`);
    
    const collections = [
      { name: 'entries', dateField: 'date', isTimestamp: true },
      { name: 'treatments', dateField: 'created_at', isTimestamp: false },
      { name: 'devicestatus', dateField: 'created_at', isTimestamp: false },
      { name: 'profile', dateField: null }, // Import all profiles
      { name: 'food', dateField: null } // Import all food
    ];
    
    for (const col of collections) {
      console.log(`\nImporting ${col.name}...`);
      
      try {
        const sourceCollection = sourceDb.collection(col.name);
        
        // Build filter
        let filter = {};
        if (col.dateField) {
          if (col.isTimestamp) {
            filter[col.dateField] = { $gte: cutoffDate.getTime() };
          } else {
            filter[col.dateField] = { $gte: cutoffDate.toISOString() };
          }
        }
        
        const count = await sourceCollection.countDocuments(filter);
        console.log(`Found ${count} documents to import`);
        
        if (count > 0) {
          const targetCollection = tenantDb.collection(col.name);
          const documents = await sourceCollection.find(filter).toArray();
          
          // Transform documents
          const transformed = documents.map(doc => ({
            ...doc,
            _id: crypto.randomBytes(12).toString('hex'),
            tenantId: tenant.tenantId,
            migratedAt: new Date(),
            originalId: doc._id
          }));
          
          // Insert in batches
          const batchSize = 1000;
          for (let i = 0; i < transformed.length; i += batchSize) {
            const batch = transformed.slice(i, i + batchSize);
            await targetCollection.insertMany(batch, { ordered: false });
            console.log(`Imported ${Math.min(i + batchSize, transformed.length)}/${transformed.length}`);
          }
          
          console.log(`✓ Imported ${transformed.length} documents`);
        }
        
      } catch (err) {
        console.error(`Error importing ${col.name}:`, err.message);
      }
    }
    
    console.log('\n✓ Import completed!');
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

directImport().catch(console.error);