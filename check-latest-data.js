const MongoClient = require('mongodb').MongoClient;

async function checkLatestData() {
  let client;
  
  try {
    const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
    
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    const tenantDb = client.db('nightscout-tenant-onepanman');
    const entries = tenantDb.collection('entries');
    
    // Get total count
    const totalCount = await entries.countDocuments();
    console.log('\nTotal entries in database:', totalCount);
    
    // Get latest 5 entries
    const latestEntries = await entries.find({})
      .sort({ date: -1 })
      .limit(5)
      .toArray();
    
    console.log('\nLatest 5 glucose readings:');
    latestEntries.forEach((entry, index) => {
      const date = new Date(entry.date);
      const localTime = date.toLocaleString('en-US', { timeZone: 'America/Chicago' });
      console.log(`${index + 1}. ${localTime} CST - ${entry.sgv} mg/dL - ${entry.direction || ''}`);
    });
    
    // Check time since last reading
    if (latestEntries.length > 0) {
      const lastReading = new Date(latestEntries[0].date);
      const now = new Date();
      const minutesAgo = Math.floor((now - lastReading) / 1000 / 60);
      console.log(`\nLast reading was ${minutesAgo} minutes ago`);
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkLatestData();