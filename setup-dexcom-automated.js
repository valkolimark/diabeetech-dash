// Automated Dexcom bridge setup
require('dotenv').config();
const { MongoClient } = require('mongodb');

// Configuration
const MONGO_URI = process.env.MONGO_CONNECTION || process.env.MONGODB_URI;
const TENANT_ID = 'onepanman';

// IMPORTANT: Update these with your actual Dexcom credentials
const DEXCOM_CONFIG = {
  userName: 'mark@markmireles.com',  // <-- Replace with your Dexcom username
  password: 'GodIsGood23!',  // <-- Replace with your Dexcom password
  server: 'us',                      // 'us' or 'eu' depending on your location
  minutes: '1440'                    // 24 hours of data
};

if (!MONGO_URI) {
  console.error('MongoDB connection string not found in environment variables');
  console.log('Please set MONGO_CONNECTION or MONGODB_URI in your .env file');
  process.exit(1);
}

// Credentials have been updated

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
    
    // Prepare updated settings
    let enabledPlugins = currentSettings.enable || '';
    const pluginsArray = enabledPlugins.split(' ').filter(p => p);
    
    // Add required plugins if not present
    const requiredPlugins = ['bridge', 'careportal', 'basal', 'iob', 'cob', 'bwp', 'rawbg'];
    requiredPlugins.forEach(plugin => {
      if (!pluginsArray.includes(plugin)) {
        pluginsArray.push(plugin);
      }
    });
    
    const updatedSettings = {
      ...currentSettings,
      bridge: DEXCOM_CONFIG,
      bridge_interval: 150000,  // 2.5 minutes in milliseconds (2.5 * 60 * 1000)
      enable: pluginsArray.join(' '),
      units: 'mg/dl',
      timeFormat: 12,
      theme: 'colors',
      language: 'en',
      scaleY: 'log',
      showRawbg: 'noise',
      showPlugins: pluginsArray.join(' '),
      alarmTypes: ['simple'],
      alarmUrgentHigh: true,
      alarmUrgentHighMins: [30, 60, 90, 120],
      alarmHigh: true,
      alarmHighMins: [30, 60, 90, 120],
      alarmLow: true,
      alarmLowMins: [15, 30, 45, 60],
      alarmUrgentLow: true,
      alarmUrgentLowMins: [15, 30, 45],
      alarmUrgentMins: [30, 60, 90, 120],
      alarmWarnMins: [30, 60, 90, 120],
      lastModified: new Date()
    };
    
    // Update settings
    const result = await settingsCollection.replaceOne(
      {},
      updatedSettings,
      { upsert: true }
    );
    
    console.log('\n✅ Dexcom bridge settings updated successfully!');
    console.log('- Modified:', result.modifiedCount);
    console.log('- Upserted:', result.upsertedCount);
    
    // Verify the update
    const newSettings = await settingsCollection.findOne({});
    console.log('\n📋 Updated configuration:');
    console.log('- Bridge username:', newSettings.bridge?.userName);
    console.log('- Bridge server:', newSettings.bridge?.server);
    console.log('- Enabled plugins:', newSettings.enable);
    
    console.log('\n🎉 Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy to Heroku: git push heroku main');
    console.log('2. Restart the app: heroku restart -a btech');
    console.log('3. The bridge will start fetching live Dexcom data');
    console.log('4. Check the logs: heroku logs --tail -a btech | grep bridge');
    
  } catch (error) {
    console.error('❌ Error setting up Dexcom bridge:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

console.log('🚀 Setting up Dexcom bridge for tenant:', TENANT_ID);
setupDexcomBridge();