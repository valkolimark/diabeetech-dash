const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function checkLatestData() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    // Get latest entries
    const entries = await db.collection('entries')
      .find({})
      .sort({ date: -1 })
      .limit(10)
      .toArray();
    
    console.log('\n=== Latest entries in MongoDB ===');
    entries.forEach((entry, i) => {
      const date = new Date(entry.date);
      const now = new Date();
      const ageMinutes = Math.round((now - date) / 60000);
      const ageHours = Math.round(ageMinutes / 60);
      console.log(`${i+1}. Date: ${date.toISOString()} (${ageMinutes} min / ${ageHours} hrs ago) - SGV: ${entry.sgv} mg/dL`);
    });
    
    // Check settings
    const settings = await db.collection('settings').findOne({});
    console.log('\n=== Bridge Settings ===');
    console.log('Bridge enabled:', !!settings?.bridge);
    console.log('Bridge interval:', settings?.bridge_interval, 'ms (', settings?.bridge_interval / 60000, 'minutes)');
    console.log('Bridge username:', settings?.bridge?.userName);
    console.log('Enabled plugins:', settings?.enable);
    
    // Check if bridge should be working
    if (settings?.bridge && settings?.enable?.includes('bridge')) {
      console.log('\n✅ Bridge is configured and should be fetching data');
      console.log('If data is old, the bridge may need to be restarted');
    } else {
      console.log('\n⚠️ Bridge is not properly configured');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

checkLatestData();