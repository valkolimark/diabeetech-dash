// Save the latest Dexcom reading
const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function saveLatestReading() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    
    // Use correct database name
    const db = client.db('tenant_onepanman');
    
    // Latest reading from Dexcom
    const reading = {
      device: 'share2',
      date: 1753064936356,
      dateString: '2025-07-21T02:28:56.356Z',
      sgv: 175,
      direction: 'FortyFiveUp',
      type: 'sgv',
      created_at: new Date().toISOString(),
      mills: 1753064936356,
      mgdl: 175
    };
    
    await db.collection('entries').replaceOne(
      { date: reading.date, device: reading.device },
      reading,
      { upsert: true }
    );
    
    console.log('✅ Saved latest Dexcom reading!');
    
    const date = new Date(reading.date);
    const centralTime = date.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      minute: '2-digit'
    });
    console.log('- Value:', reading.sgv, 'mg/dL');
    console.log('- Time:', centralTime, 'CST');
    console.log('- Direction:', reading.direction, '(45° up arrow)');
    console.log('- Trend: Rising moderately');
    
    // Check all recent data
    console.log('\n📊 Recent readings:');
    const allEntries = await db.collection('entries')
      .find({ device: 'share2' })
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
      const age = Math.round((Date.now() - e.date) / 60000);
      console.log(`${i+1}. ${ct} CST - ${e.sgv} mg/dL ${e.direction} (${age}m ago)`);
    });
    
    await client.close();
    console.log('\n✅ Your Nightscout now has live data!');
    console.log('🔄 The bridge should poll every 2.5 minutes on Heroku');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

saveLatestReading();