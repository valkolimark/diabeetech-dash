#!/usr/bin/env node

/**
 * Document current database schema for rollback purposes
 * Captures collection structures, indexes, and sample documents
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nightscout';

async function documentSchema() {
  const client = new MongoClient(MONGODB_URI);
  const schema = {
    timestamp: new Date().toISOString(),
    database: null,
    collections: {}
  };
  
  try {
    await client.connect();
    const db = client.db();
    schema.database = db.databaseName;
    
    console.log('📋 Documenting database schema...');
    
    const collections = await db.listCollections().toArray();
    
    for (const collInfo of collections) {
      const collName = collInfo.name;
      const collection = db.collection(collName);
      
      // Get collection stats
      const stats = await collection.stats();
      
      // Get indexes
      const indexes = await collection.indexes();
      
      // Get sample document for structure
      const sampleDoc = await collection.findOne({});
      
      // Get field types from sample
      const fieldTypes = {};
      if (sampleDoc) {
        for (const [key, value] of Object.entries(sampleDoc)) {
          fieldTypes[key] = Array.isArray(value) ? 'array' : typeof value;
        }
      }
      
      schema.collections[collName] = {
        stats: {
          count: stats.count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize
        },
        indexes: indexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false,
          sparse: idx.sparse || false
        })),
        fieldTypes,
        sampleStructure: sampleDoc ? Object.keys(sampleDoc) : []
      };
      
      console.log(`  ✅ Documented collection: ${collName} (${stats.count} documents)`);
    }
    
    // Get database info
    const dbInfo = await db.admin().serverStatus();
    schema.serverInfo = {
      version: dbInfo.version,
      uptime: dbInfo.uptime,
      host: dbInfo.host
    };
    
    return schema;
    
  } catch (error) {
    console.error('❌ Error documenting schema:', error);
    throw error;
  } finally {
    await client.close();
  }
}

async function main() {
  try {
    const schema = await documentSchema();
    console.log(JSON.stringify(schema, null, 2));
  } catch (error) {
    console.error('Failed to document schema:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { documentSchema };