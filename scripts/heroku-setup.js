#!/usr/bin/env node

/**
 * Heroku-specific setup script
 * Runs during release phase to set up database
 */

const { MongoClient } = require('mongodb');

async function setupHeroku() {
  console.log('🚀 Running Heroku setup...');
  
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
  
  if (!MONGODB_URI) {
    console.error('❌ No MongoDB connection string found in environment variables');
    console.error('Please set MONGODB_URI, MONGO_CONNECTION, or MONGOLAB_URI');
    // Don't exit with error - allow app to start
    return;
  }
  
  const client = new MongoClient(MONGODB_URI, { 
    useUnifiedTopology: true,
    connectTimeoutMS: 10000 
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Ensure admin_audit collection exists
    if (!collectionNames.includes('admin_audit')) {
      await db.createCollection('admin_audit');
      console.log('✅ Created admin_audit collection');
    }
    
    // Create indexes for better performance
    await db.collection('admin_audit').createIndex({ timestamp: -1 });
    await db.collection('admin_audit').createIndex({ user: 1 });
    await db.collection('admin_audit').createIndex({ action: 1 });
    console.log('✅ Created admin_audit indexes');
    
    // Ensure users collection has proper indexes
    if (collectionNames.includes('users')) {
      await db.collection('users').createIndex({ email: 1 });
      await db.collection('users').createIndex({ role: 1 });
      console.log('✅ Updated users indexes');
    }
    
    // Ensure tenants collection has proper indexes
    if (collectionNames.includes('tenants')) {
      await db.collection('tenants').createIndex({ subdomain: 1 });
      await db.collection('tenants').createIndex({ status: 1 });
      console.log('✅ Updated tenants indexes');
    }
    
    console.log('✅ Heroku setup completed successfully');
    
  } catch (error) {
    console.error('❌ Setup error:', error.message);
    // Don't exit with error - allow app to start
  } finally {
    await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  setupHeroku().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(0); // Exit cleanly to not block deployment
  });
}

module.exports = setupHeroku;