const { MongoClient } = require('mongodb');

const uri = 'mongodb://markt:xebkaW-kaqmu4-wynkor@nightscout-master-shard-00-00.nkz27.mongodb.net:27017,nightscout-master-shard-00-01.nkz27.mongodb.net:27017,nightscout-master-shard-00-02.nkz27.mongodb.net:27017/nightscout-master?authSource=admin&replicaSet=atlas-4omu1t-shard-0&retryWrites=true&w=majority&appName=nightscout-master&ssl=true';

async function addSingleTestEntry() {
  const client = new MongoClient(uri, { useNewUrlParser: true });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Directly connect to the specific tenant database
    const tenantDb = client.db('nightscout-tenant-onepanman');
    const entriesCollection = tenantDb.collection('entries');
    
    // Check current count
    const beforeCount = await entriesCollection.countDocuments();
    console.log('Entries before insert:', beforeCount);
    
    // Add a single test entry with current timestamp
    const now = new Date();
    const testEntry = {
      sgv: 999,  // Distinctive value to find it easily
      date: now.getTime(),
      dateString: now.toISOString(),
      trend: 4,
      direction: 'Flat',
      device: 'heroku-test',
      type: 'sgv',
      utcOffset: 0,
      sysTime: now.toISOString()
    };
    
    console.log('Inserting test entry:', testEntry);
    const result = await entriesCollection.insertOne(testEntry);
    console.log('Insert result:', result.insertedId);
    
    // Verify it was added
    const afterCount = await entriesCollection.countDocuments();
    console.log('Entries after insert:', afterCount);
    
    // Find the entry we just added
    const found = await entriesCollection.findOne({ device: 'heroku-test', sgv: 999 });
    console.log('Found test entry:', found ? 'YES' : 'NO');
    if (found) {
      console.log('Test entry details:', found);
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

addSingleTestEntry();