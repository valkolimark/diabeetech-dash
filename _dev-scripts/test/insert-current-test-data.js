const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function insertCurrentTestData() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    // Delete old test data
    await db.collection('entries').deleteMany({ device: 'test-current' });
    
    // Generate test data for RIGHT NOW
    const now = new Date();
    const entries = [];
    
    // Create entries every 5 minutes for the last 2 hours
    for (let i = 0; i < 24; i++) {
      const time = new Date(now.getTime() - (i * 5 * 60 * 1000)); // 5 minutes apart
      const sgv = 120 + Math.floor(Math.random() * 40) - 20; // Random between 100-140
      
      entries.push({
        device: 'test-current',
        date: time.getTime(),
        dateString: time.toISOString(),
        sgv: sgv,
        direction: 'Flat',
        type: 'sgv',
        created_at: time.toISOString(),
        mills: time.getTime(),
        mgdl: sgv
      });
    }
    
    // Insert entries
    console.log('Inserting', entries.length, 'current test entries...');
    const result = await db.collection('entries').insertMany(entries);
    console.log('✅ Inserted', result.insertedCount, 'entries');
    
    // Show latest entries
    console.log('\nLatest entries (Central Time):');
    entries.slice(0, 5).forEach((entry, i) => {
      const date = new Date(entry.date);
      const centralTime = date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      console.log(`${i+1}. ${centralTime} CST - ${entry.sgv} mg/dL`);
    });
    
    console.log('\n✅ Current test data inserted!');
    console.log('🔄 Refresh your browser to see the data');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

insertCurrentTestData();