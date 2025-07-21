const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function enableBridge() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    // Get current settings
    const settings = await db.collection('settings').findOne({}) || {};
    
    // Update bridge settings with enable flag
    settings.bridge = {
      ...settings.bridge,
      enable: true,  // This was missing!
      userName: 'mark@markmireles.com',
      password: 'GodIsGood23!',
      server: 'us',
      minutes: '1440',
      maxCount: 1,
      firstFetchCount: 3
    };
    
    // Also ensure bridge_interval is set
    settings.bridge_interval = 150000; // 2.5 minutes
    
    // Update settings
    await db.collection('settings').replaceOne(
      {},
      settings,
      { upsert: true }
    );
    
    console.log('✅ Bridge enabled successfully!');
    console.log('Bridge settings:', settings.bridge);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

enableBridge();