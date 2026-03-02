const MongoClient = require('mongodb').MongoClient;

const MASTER_MONGODB_URI = process.env.MASTER_MONGODB_URI;

async function checkDatabaseStats() {
  console.log('Checking database stats for multi-tenant setup...');
  
  try {
    // Connect to master database
    const client = new MongoClient(MASTER_MONGODB_URI);
    await client.connect();
    console.log('Connected to master database');
    
    // Get tenant database
    const tenantDbName = 'nightscout-tenant-onepanman';
    console.log(`Switching to tenant database: ${tenantDbName}`);
    const tenantDb = client.db(tenantDbName);
    
    // Test the stats command directly
    console.log('Running dbStats command...');
    const stats = await tenantDb.command({ dbStats: 1, scale: 1 });
    console.log('Database stats:', {
      dataSize: stats.dataSize,
      indexSize: stats.indexSize,
      storageSize: stats.storageSize,
      collections: stats.collections,
      objects: stats.objects
    });
    
    // Test with callback style (like the code expects)
    console.log('\nTesting callback style stats...');
    tenantDb.stats = function(callback) {
      tenantDb.command({ dbStats: 1, scale: 1 })
        .then(function(stats) {
          callback(null, {
            dataSize: stats.dataSize || 0,
            indexSize: stats.indexSize || 0
          });
        })
        .catch(function(err) {
          callback(err, null);
        });
    };
    
    tenantDb.stats(function(err, result) {
      if (err) {
        console.error('Error with callback style:', err);
      } else {
        console.log('Callback style stats:', result);
      }
      
      client.close();
      console.log('\nDone!');
    });
    
  } catch (err) {
    console.error('Error:', err);
  }
}

checkDatabaseStats();