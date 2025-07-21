// Save current Dexcom data
const bridge = require('share2nightscout-bridge');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

const options = {
  login: {
    accountName: 'mark@markmireles.com',
    password: 'GodIsGood23!'
  },
  interval: 150000,
  fetch: {
    maxCount: 10,
    minutes: 60
  },
  nightscout: {
    endpoint: 'http://localhost',
    secret: 'dummy'
  },
  callback: async function(err, glucose) {
    if (err) {
      console.error('❌ Error:', err);
      process.exit(1);
    }
    
    if (!glucose || glucose.length === 0) {
      console.log('No data available');
      process.exit(1);
    }
    
    console.log('✅ Fetched', glucose.length, 'readings');
    
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
      
      console.log('✅ Saved to MongoDB');
      
      // Show what we saved
      const latest = glucose[0];
      const date = new Date(latest.date);
      const centralTime = date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log('\nLatest reading:', latest.sgv, 'mg/dL at', centralTime, 'CST');
      console.log('Direction:', latest.direction);
      
      await client.close();
      console.log('\n✅ Success! Refresh your browser to see live data.');
      
    } catch (error) {
      console.error('MongoDB error:', error.message);
    }
    
    process.exit(0);
  },
  maxFailures: 1
};

console.log('🔄 Fetching current Dexcom data...\n');

// Override the nightscout posting to prevent errors
const originalPost = bridge.post;
bridge.post = function(glucose, callback) {
  // Skip posting, just call the callback
  if (callback) callback(null, glucose);
};

bridge(options);