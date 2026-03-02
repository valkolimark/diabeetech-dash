// Monitor for Dexcom data availability
const bridge = require('share2nightscout-bridge');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

let checkCount = 0;
const maxChecks = 20; // Check for 10 minutes (every 30 seconds)

function checkDexcomData() {
  checkCount++;
  console.log(`\n🔍 Check #${checkCount} at ${new Date().toLocaleTimeString('en-US', {timeZone: 'America/Chicago'})} CST`);
  
  const options = {
    login: {
      accountName: 'mark@markmireles.com',
      password: 'GodIsGood23!'
    },
    interval: 150000,
    fetch: {
      maxCount: 5,
      minutes: 30
    },
    nightscout: {
      endpoint: 'http://localhost:1337',
      secret: 'dummy'
    },
    callback: async function(err, glucose) {
      if (err) {
        console.log('❌ Error:', err.message);
      } else if (glucose && glucose.length > 0) {
        console.log('✅ DATA AVAILABLE! Found', glucose.length, 'readings');
        console.log('Latest:', glucose[0].sgv, 'mg/dL at', new Date(glucose[0].date).toLocaleTimeString());
        
        // Save to MongoDB
        const client = new MongoClient(MONGO_URI);
        try {
          await client.connect();
          const db = client.db('tenant_onepanman');
          
          for (const reading of glucose) {
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
          }
          
          console.log('✅ Saved to MongoDB!');
          console.log('\n🎉 Dexcom bridge is working! Data will update every 2.5 minutes.');
          console.log('Deploy to Heroku and restart to enable automatic polling.');
          
          await client.close();
          process.exit(0);
        } catch (error) {
          console.error('MongoDB error:', error.message);
        }
      } else {
        console.log('⏳ No data yet. Dexcom Share may still be syncing...');
      }
      
      if (checkCount >= maxChecks) {
        console.log('\n⚠️ No data after 10 minutes. Please check:');
        console.log('1. Dexcom app shows current readings');
        console.log('2. Share is enabled in Dexcom app settings');
        console.log('3. You are using the correct Dexcom account');
        process.exit(1);
      }
    },
    maxFailures: 1
  };
  
  bridge(options);
}

console.log('🔄 Monitoring for Dexcom data...');
console.log('This will check every 30 seconds for up to 10 minutes.\n');
console.log('Account: mark@markmireles.com');
console.log('Make sure:');
console.log('✓ Dexcom app is showing current readings');
console.log('✓ Share is enabled in Dexcom app');
console.log('✓ You have internet connection\n');

// Check immediately
checkDexcomData();

// Then check every 30 seconds
const interval = setInterval(() => {
  checkDexcomData();
}, 30000);