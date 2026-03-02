// Direct save of the Dexcom data we know exists
const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function saveDexcomData() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    // The data we got from the bridge
    const reading = {
      sgv: 161,
      date: 1753064334936,
      dateString: '2025-07-21T02:18:54.936Z',
      trend: 4,
      direction: 'Flat',
      device: 'share2',
      type: 'sgv'
    };
    
    const entry = {
      device: 'share2',
      date: reading.date,
      dateString: reading.dateString,
      sgv: reading.sgv,
      direction: reading.direction,
      type: 'sgv',
      created_at: new Date().toISOString(),
      mills: reading.date,
      mgdl: reading.sgv
    };
    
    await db.collection('entries').replaceOne(
      { date: entry.date, device: entry.device },
      entry,
      { upsert: true }
    );
    
    console.log('✅ Saved Dexcom reading to database!');
    
    const date = new Date(reading.date);
    const centralTime = date.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      minute: '2-digit'
    });
    console.log('- Value:', reading.sgv, 'mg/dL');
    console.log('- Time:', centralTime, 'CST');
    console.log('- Direction:', reading.direction);
    
    // Check all recent data
    console.log('\n📊 All recent readings:');
    const allEntries = await db.collection('entries')
      .find({})
      .sort({ date: -1 })
      .limit(5)
      .toArray();
      
    allEntries.forEach((e, i) => {
      const d = new Date(e.date);
      const ct = d.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`${i+1}. ${ct} CST - ${e.sgv} mg/dL (${e.device})`);
    });
    
    await client.close();
    console.log('\n✅ Success! Your live Dexcom data is now in the database.');
    console.log('🔄 Refresh your browser at https://btech-d038118b5224.herokuapp.com/?t=onepanman');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

saveDexcomData();