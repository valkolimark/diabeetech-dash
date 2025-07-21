const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function insertTestData() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    // Generate test data for the last 3 hours
    const now = new Date();
    const entries = [];
    
    // Create entries every 5 minutes for the last 3 hours
    for (let i = 0; i < 36; i++) {
      const time = new Date(now.getTime() - (i * 5 * 60 * 1000)); // 5 minutes apart
      const sgv = 120 + Math.floor(Math.random() * 60) - 30; // Random between 90-150
      
      entries.push({
        date: time.getTime(),
        dateString: time.toISOString(),
        sgv: sgv,
        direction: 'Flat',
        type: 'sgv',
        device: 'test-data',
        created_at: time.toISOString()
      });
    }
    
    // Insert entries
    console.log('Inserting', entries.length, 'test entries...');
    const result = await db.collection('entries').insertMany(entries);
    console.log('✅ Inserted', result.insertedCount, 'entries');
    
    // Show latest entries
    const latest = await db.collection('entries')
      .find({})
      .sort({ date: -1 })
      .limit(5)
      .toArray();
    
    console.log('\nLatest entries:');
    latest.forEach((entry, i) => {
      const date = new Date(entry.date);
      console.log(`${i+1}. ${date.toLocaleTimeString()} - ${entry.sgv} mg/dL`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

insertTestData();