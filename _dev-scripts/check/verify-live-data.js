// Verify live data is flowing
const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function verifyLiveData() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    console.log('🔍 Checking for live Dexcom data...\n');
    
    // Get latest entries
    const entries = await db.collection('entries')
      .find({ device: 'share2' })
      .sort({ date: -1 })
      .limit(10)
      .toArray();
    
    if (entries.length === 0) {
      console.log('⚠️ No Dexcom data found yet');
      console.log('\nThe bridge may still be starting up.');
      console.log('Wait 2-3 minutes and run this script again.');
    } else {
      console.log('✅ Found', entries.length, 'Dexcom readings!\n');
      
      const now = new Date();
      entries.forEach((entry, i) => {
        const date = new Date(entry.date);
        const ageMinutes = Math.round((now - date) / 60000);
        const centralTime = date.toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const fresh = ageMinutes < 10 ? '🟢' : ageMinutes < 30 ? '🟡' : '🔴';
        console.log(`${i+1}. ${centralTime} CST - ${entry.sgv} mg/dL ${entry.direction} ${fresh} (${ageMinutes}m ago)`);
      });
      
      const latestAge = Math.round((now - new Date(entries[0].date)) / 60000);
      if (latestAge < 5) {
        console.log('\n🎉 LIVE DATA IS FLOWING! The bridge is working perfectly.');
      } else if (latestAge < 15) {
        console.log('\n✅ Data is recent. Bridge appears to be working.');
      } else {
        console.log('\n⚠️ Data is getting stale. Bridge may need attention.');
      }
    }
    
    // Check bridge settings
    const settings = await db.collection('settings').findOne({});
    if (settings?.bridge?.enable) {
      console.log('\n📋 Bridge Configuration:');
      console.log('- Status: Enabled');
      console.log('- Interval:', settings.bridge_interval / 60000, 'minutes');
      console.log('- Account:', settings.bridge.userName);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

console.log('=== Nightscout Live Data Verification ===\n');
verifyLiveData();