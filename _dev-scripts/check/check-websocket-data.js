const { MongoClient } = require('mongodb');

const uri = 'mongodb://markt:xebkaW-kaqmu4-wynkor@nightscout-master-shard-00-00.nkz27.mongodb.net:27017,nightscout-master-shard-00-01.nkz27.mongodb.net:27017,nightscout-master-shard-00-02.nkz27.mongodb.net:27017/nightscout-master?authSource=admin&replicaSet=atlas-4omu1t-shard-0&retryWrites=true&w=majority&appName=nightscout-master&ssl=true';

async function checkWebSocketData() {
  const client = new MongoClient(uri, { useNewUrlParser: true });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    const tenantDb = client.db('nightscout-tenant-onepanman');
    
    // Check total entries
    const totalCount = await tenantDb.collection('entries').countDocuments();
    console.log('\nTotal entries in database:', totalCount);
    
    // Get entries like WebSocket does
    const wsEntries = await tenantDb.collection('entries')
      .find({})
      .sort({ date: -1 })
      .limit(300)
      .toArray();
      
    console.log('WebSocket query found:', wsEntries.length, 'entries');
    
    // Show date distribution
    const dateCounts = {};
    wsEntries.forEach(e => {
      const dateStr = new Date(e.date).toISOString().split('T')[0];
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });
    
    console.log('\nEntries by date:');
    Object.entries(dateCounts).sort().forEach(([date, count]) => {
      console.log(`  ${date}: ${count} entries`);
    });
    
    // Show sample entries
    console.log('\nLatest 5 entries:');
    wsEntries.slice(0, 5).forEach(e => {
      console.log(`  ${new Date(e.date).toISOString()} - SGV: ${e.sgv}, Device: ${e.device}`);
    });
    
    // Check if our test data exists
    const testDataCount = await tenantDb.collection('entries').countDocuments({
      device: 'share2',
      date: { $gte: new Date('2025-07-20T00:00:00Z').getTime() }
    });
    console.log('\nTest data entries (July 20):', testDataCount);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

checkWebSocketData();