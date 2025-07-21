// Direct Dexcom bridge setup - no dependencies needed
const { MongoClient } = require('mongodb');

// MongoDB connection string from Heroku
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

// Configuration
const TENANT_ID = 'onepanman';

// Dexcom credentials
const DEXCOM_CONFIG = {
  userName: 'mark@markmireles.com',
  password: 'GodIsGood23!',
  server: 'us',
  minutes: '1440'
};

// MongoDB URI is configured

async function setupDexcomBridge() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const tenantDb = client.db(`tenant_${TENANT_ID}`);
    const settingsCollection = tenantDb.collection('settings');
    
    // Get current settings
    const currentSettings = await settingsCollection.findOne({}) || {};
    console.log('\nCurrent settings:');
    console.log('- Enabled plugins:', currentSettings.enable || 'none');
    console.log('- Bridge configured:', !!currentSettings.bridge);
    
    // Prepare enabled plugins
    let enabledPlugins = currentSettings.enable || '';
    const pluginsArray = enabledPlugins.split(' ').filter(p => p);
    
    // Add required plugins
    const requiredPlugins = ['bridge', 'careportal', 'basal', 'iob', 'cob', 'bwp', 'rawbg'];
    requiredPlugins.forEach(plugin => {
      if (!pluginsArray.includes(plugin)) {
        pluginsArray.push(plugin);
      }
    });
    
    const updatedSettings = {
      ...currentSettings,
      bridge: DEXCOM_CONFIG,
      bridge_interval: 150000,  // 2.5 minutes
      enable: pluginsArray.join(' '),
      units: 'mg/dl',
      timeFormat: 12,
      theme: 'colors',
      language: 'en',
      scaleY: 'log',
      showRawbg: 'noise',
      showPlugins: pluginsArray.join(' '),
      lastModified: new Date()
    };
    
    // Update settings
    const result = await settingsCollection.replaceOne(
      {},
      updatedSettings,
      { upsert: true }
    );
    
    console.log('\n✅ Dexcom bridge settings updated!');
    console.log('- Bridge username:', DEXCOM_CONFIG.userName);
    console.log('- Polling interval: 2.5 minutes');
    console.log('- Enabled plugins:', pluginsArray.join(' '));
    
    console.log('\n🎉 Setup complete!');
    console.log('\nNext: Restart your Heroku app');
    console.log('Run: heroku restart -a btech');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

console.log('🚀 Setting up Dexcom bridge...');
setupDexcomBridge();