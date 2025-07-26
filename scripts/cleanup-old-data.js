// Cleanup script for old data to reduce database size and improve performance
const { MongoClient } = require('mongodb');
require('dotenv').config();

const RETENTION_DAYS = {
  entries: 90,          // 3 months of CGM data
  treatments: 180,      // 6 months of treatments
  devicestatus: 30,     // 1 month of device status
  activity: 90,         // 3 months of activity
  food: 365,           // 1 year of food (usually small)
  profile: null        // Keep all profiles
};

async function cleanupOldData(dryRun = true) {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_CONNECTION;
  if (!mongoUri) {
    console.error('No MongoDB URI found');
    return;
  }

  const client = new MongoClient(mongoUri, { useUnifiedTopology: true });

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log(dryRun ? '=== DRY RUN MODE - No data will be deleted ===' : '=== CLEANUP MODE - Data will be deleted ===');
    console.log('');

    const db = client.db();
    let totalDeleted = 0;
    let totalFreed = 0;

    for (const [collection, days] of Object.entries(RETENTION_DAYS)) {
      if (!days) continue;

      console.log(`\nProcessing ${collection} (retention: ${days} days)...`);
      
      const coll = db.collection(collection);
      const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      
      // Different date fields for different collections
      let dateField = 'date';
      if (['treatments', 'devicestatus', 'activity', 'food'].includes(collection)) {
        dateField = 'created_at';
      }

      // Build query based on date field type
      let query;
      if (collection === 'entries') {
        // entries uses milliseconds timestamp
        query = { [dateField]: { $lt: cutoffDate.getTime() } };
      } else {
        // others use ISO string dates
        query = { [dateField]: { $lt: cutoffDate.toISOString() } };
      }

      // Count documents to delete
      const countToDelete = await coll.countDocuments(query);
      
      if (countToDelete > 0) {
        // Estimate size
        const sample = await coll.findOne(query);
        const avgSize = sample ? JSON.stringify(sample).length : 200;
        const estimatedSize = (countToDelete * avgSize) / (1024 * 1024); // MB
        
        console.log(`  Found ${countToDelete} documents to delete`);
        console.log(`  Estimated size: ${estimatedSize.toFixed(2)} MB`);
        
        if (!dryRun) {
          console.log('  Deleting...');
          const result = await coll.deleteMany(query);
          console.log(`  ✓ Deleted ${result.deletedCount} documents`);
          totalDeleted += result.deletedCount;
          totalFreed += estimatedSize;
        } else {
          console.log('  → Would delete these documents');
          totalDeleted += countToDelete;
          totalFreed += estimatedSize;
        }
      } else {
        console.log('  No old documents found');
      }
    }

    // Check for orphaned tenant data
    console.log('\n\nChecking for orphaned tenant databases...');
    const admin = db.admin();
    const dbs = await admin.listDatabases();
    const tenantDbs = dbs.databases.filter(d => d.name.startsWith('nightscout-tenant-'));
    
    if (tenantDbs.length > 0) {
      console.log(`Found ${tenantDbs.length} tenant databases`);
      
      // Get active tenants
      const activeTenants = await db.collection('tenants')
        .find({ isActive: true })
        .project({ databaseName: 1, tenantId: 1 })
        .toArray();
      
      const activeDbNames = new Set(activeTenants.map(t => t.databaseName));
      
      const orphanedDbs = tenantDbs.filter(d => !activeDbNames.has(d.name));
      
      if (orphanedDbs.length > 0) {
        console.log(`\nFound ${orphanedDbs.length} orphaned tenant databases:`);
        orphanedDbs.forEach(d => {
          console.log(`  - ${d.name} (${(d.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
        
        if (!dryRun) {
          console.log('\nTo remove orphaned databases, run these commands in MongoDB shell:');
        } else {
          console.log('\nWould remove these orphaned databases');
        }
        orphanedDbs.forEach(d => {
          console.log(`  use ${d.name}; db.dropDatabase();`);
        });
      } else {
        console.log('No orphaned tenant databases found');
      }
    }

    // Summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Total documents ${dryRun ? 'to delete' : 'deleted'}: ${totalDeleted}`);
    console.log(`Estimated space ${dryRun ? 'to free' : 'freed'}: ${totalFreed.toFixed(2)} MB`);
    
    if (dryRun) {
      console.log('\nTo perform actual cleanup, run:');
      console.log('  node scripts/cleanup-old-data.js --execute');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the cleanup
const dryRun = !process.argv.includes('--execute');
cleanupOldData(dryRun);