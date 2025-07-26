// Memory optimization script for Nightscout multi-tenant
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function analyzeAndOptimize() {
  console.log('=== Nightscout Memory & Database Optimization ===\n');
  
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_CONNECTION;
  if (!mongoUri) {
    console.error('No MongoDB URI found');
    return;
  }

  const client = new MongoClient(mongoUri, { 
    useUnifiedTopology: true,
    // Connection pool optimization
    maxPoolSize: 10,  // Reduce from default 100
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000
  });

  try {
    await client.connect();
    const db = client.db();
    
    // 1. Analyze collection sizes
    console.log('1. Analyzing collection sizes...\n');
    const collections = ['entries', 'treatments', 'devicestatus', 'tenants', 'users', 'tenant_settings'];
    
    for (const collName of collections) {
      const stats = await db.collection(collName).stats();
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      const indexSizeMB = (stats.totalIndexSize / 1024 / 1024).toFixed(2);
      console.log(`${collName}:`);
      console.log(`  Documents: ${stats.count}`);
      console.log(`  Data size: ${sizeMB} MB`);
      console.log(`  Index size: ${indexSizeMB} MB`);
      console.log(`  Indexes: ${stats.nindexes}`);
      console.log('');
    }
    
    // 2. Check for old data
    console.log('2. Checking for old data...\n');
    
    // Entries older than 90 days
    const oldEntriesCount = await db.collection('entries').countDocuments({
      date: { $lt: Date.now() - (90 * 24 * 60 * 60 * 1000) }
    });
    console.log(`Entries older than 90 days: ${oldEntriesCount}`);
    
    // Treatments older than 180 days
    const oldTreatmentsCount = await db.collection('treatments').countDocuments({
      created_at: { $lt: new Date(Date.now() - (180 * 24 * 60 * 60 * 1000)).toISOString() }
    });
    console.log(`Treatments older than 180 days: ${oldTreatmentsCount}`);
    
    // Device status older than 30 days
    const oldDeviceStatusCount = await db.collection('devicestatus').countDocuments({
      created_at: { $lt: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString() }
    });
    console.log(`Device status older than 30 days: ${oldDeviceStatusCount}`);
    
    // 3. Check indexes
    console.log('\n3. Checking indexes...\n');
    
    const entriesIndexes = await db.collection('entries').indexes();
    console.log('Entries indexes:', entriesIndexes.map(idx => idx.name).join(', '));
    
    // 4. Memory usage estimate
    console.log('\n4. Memory Usage Recommendations:\n');
    
    const totalDocs = await db.collection('entries').countDocuments();
    const avgDocSize = 200; // bytes
    const estimatedMemoryMB = (totalDocs * avgDocSize * 0.1) / 1024 / 1024; // 10% in memory
    
    console.log(`Estimated memory for entries cache: ${estimatedMemoryMB.toFixed(2)} MB`);
    
    // 5. Optimization recommendations
    console.log('\n5. Optimization Recommendations:\n');
    
    console.log('IMMEDIATE ACTIONS:');
    console.log('- Set NODE_OPTIONS="--max-old-space-size=400" (leaves 112MB for system)');
    console.log('- Implement data retention policy (90 days for entries, 180 for treatments)');
    console.log('- Add missing indexes for common queries');
    console.log('- Reduce WebSocket ping interval');
    console.log('- Implement connection pooling limits');
    
    console.log('\nDATABASE CLEANUP COMMANDS:');
    
    if (oldEntriesCount > 0) {
      console.log(`\n// Remove entries older than 90 days`);
      console.log(`db.entries.deleteMany({ date: { $lt: ${Date.now() - (90 * 24 * 60 * 60 * 1000)} } })`);
    }
    
    if (oldTreatmentsCount > 0) {
      console.log(`\n// Remove treatments older than 180 days`);
      console.log(`db.treatments.deleteMany({ created_at: { $lt: new Date(${Date.now() - (180 * 24 * 60 * 60 * 1000)}).toISOString() } })`);
    }
    
    if (oldDeviceStatusCount > 0) {
      console.log(`\n// Remove device status older than 30 days`);
      console.log(`db.devicestatus.deleteMany({ created_at: { $lt: new Date(${Date.now() - (30 * 24 * 60 * 60 * 1000)}).toISOString() } })`);
    }
    
    console.log('\nINDEX CREATION COMMANDS:');
    console.log('// Critical indexes for performance');
    console.log('db.entries.createIndex({ date: -1, tenant: 1 })');
    console.log('db.entries.createIndex({ tenant: 1, date: -1 })');
    console.log('db.treatments.createIndex({ created_at: -1, tenant: 1 })');
    console.log('db.treatments.createIndex({ tenant: 1, created_at: -1 })');
    console.log('db.devicestatus.createIndex({ created_at: -1, tenant: 1 })');
    console.log('db.users.createIndex({ email: 1 })');
    console.log('db.users.createIndex({ tenant: 1 })');
    console.log('db.tenants.createIndex({ subdomain: 1 })');
    console.log('db.tenants.createIndex({ isActive: 1 })');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeAndOptimize();