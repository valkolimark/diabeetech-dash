// Fetch and save Dexcom data to MongoDB
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
    maxCount: 36,
    minutes: 180 // Get last 3 hours
  },
  nightscout: {
    endpoint: 'http://localhost:1337/api/v1/entries.json',
    secret: 'dummy'
  },
  callback: async function(err, glucose) {
    if (err) {
      console.error('❌ Bridge error:', err);
      return;
    }
    
    console.log('✅ Fetched', glucose.length, 'readings from Dexcom');
    
    // Save to MongoDB
    const client = new MongoClient(MONGO_URI);
    try {
      await client.connect();
      const db = client.db('tenant_onepanman');
      
      // Convert to Nightscout format
      const entries = glucose.map(reading => ({
        device: reading.device || 'share2',
        date: reading.date,
        dateString: reading.dateString,
        sgv: reading.sgv,
        direction: reading.direction,
        type: 'sgv',
        created_at: new Date().toISOString(),
        mills: reading.date,
        mgdl: reading.sgv
      }));
      
      // Remove duplicates
      for (const entry of entries) {
        await db.collection('entries').replaceOne(
          { date: entry.date, device: entry.device },
          entry,
          { upsert: true }
        );
      }
      
      console.log('✅ Saved readings to MongoDB');
      
      // Show latest entries
      console.log('\nLatest readings (Central Time):');
      entries.slice(0, 5).forEach((entry, i) => {
        const date = new Date(entry.date);
        const centralTime = date.toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        console.log(`${i+1}. ${centralTime} CST - ${entry.sgv} mg/dL ${entry.direction}`);
      });
      
      await client.close();
      console.log('\n✅ Data saved! Refresh your browser to see live data.');
      
    } catch (error) {
      console.error('MongoDB error:', error);
    }
    
    process.exit(0);
  },
  maxFailures: 1
};

console.log('🔄 Fetching Dexcom data...\n');
bridge(options);