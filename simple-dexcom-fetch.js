// Simple Dexcom data fetcher
const axios = require('axios');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

// Use the share2nightscout-bridge's internal API
const Dexcom = require('share2nightscout-bridge/lib/dexcom');

async function fetchAndSave() {
  const dexcom = Dexcom({
    login: {
      accountName: 'mark@markmireles.com',
      password: 'GodIsGood23!'
    },
    fetch: {
      maxCount: 50,
      minutes: 180
    }
  });
  
  console.log('🔄 Fetching Dexcom data...\n');
  
  dexcom.fetch(async function(err, glucose) {
    if (err) {
      console.error('❌ Error:', err);
      return;
    }
    
    if (!glucose || glucose.length === 0) {
      console.log('No data available yet');
      return;
    }
    
    console.log('✅ Found', glucose.length, 'readings');
    
    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI);
    try {
      await client.connect();
      const db = client.db('tenant_onepanman');
      
      // Save each reading
      let saved = 0;
      for (const reading of glucose) {
        const entry = {
          device: 'share2',
          date: reading.date,
          dateString: new Date(reading.date).toISOString(),
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
        saved++;
      }
      
      console.log('✅ Saved', saved, 'entries to MongoDB');
      
      // Show latest readings
      console.log('\nLatest readings (Central Time):');
      glucose.slice(0, 5).forEach((entry, i) => {
        const date = new Date(entry.date);
        const centralTime = date.toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          hour: '2-digit',
          minute: '2-digit'
        });
        console.log(`${i+1}. ${centralTime} CST - ${entry.sgv} mg/dL ${entry.direction}`);
      });
      
      await client.close();
      console.log('\n✅ Success! Data saved to database.');
      console.log('🔄 Refresh your browser to see the data');
      
    } catch (error) {
      console.error('MongoDB error:', error.message);
    }
  });
}

fetchAndSave();