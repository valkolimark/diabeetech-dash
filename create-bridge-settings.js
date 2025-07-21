const MongoClient = require('mongodb').MongoClient;

async function createBridgeSettings() {
  try {
    console.log('Connecting to MongoDB...');
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Connect to the onepanman tenant database
    const tenantDb = client.db('nightscout-tenant-onepanman');
    console.log('\nConnected to nightscout-tenant-onepanman database');
    
    // Create the bridge settings
    const bridgeSettings = {
      bridge: {
        enable: true,
        userName: process.env.BRIDGE_USER_NAME || 'YOUR_DEXCOM_USERNAME',
        password: process.env.BRIDGE_PASSWORD || 'YOUR_DEXCOM_PASSWORD',
        server: process.env.BRIDGE_SERVER || 'US',
        firstFetchCount: process.env.BRIDGE_FIRST_FETCH_COUNT || 3,
        maxFetchCount: process.env.BRIDGE_MAX_FETCH_COUNT || 1,
        fetchCount: process.env.BRIDGE_FETCH_COUNT || 1,
        maxRetryDuration: process.env.BRIDGE_MAX_RETRY_DURATION || 60000,
        retryDelay: process.env.BRIDGE_RETRY_DELAY || 1000,
        pollInterval: process.env.BRIDGE_POLL_INTERVAL || 150000  // 2.5 minutes
      },
      units: 'mg/dl',
      timeFormat: 12,
      nightMode: false,
      showRawbg: 'never',
      customTitle: 'Nightscout',
      theme: 'default',
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
      enable: ['careportal', 'boluscalc', 'food', 'bwp', 'cage', 'sage', 'iage', 'iob', 'cob', 'basal', 'ar2', 'rawbg', 'pushover', 'bgi', 'pump', 'openaps', 'treatmentnotify', 'bgnow', 'delta', 'direction', 'timeago', 'devicestatus', 'upbat', 'errorcodes', 'profile', 'dbsize', 'runtimestate', 'basalprofile', 'bolus', 'bridge', 'speech', 'cors'],
      thresholds: {
        bgHigh: 180,
        bgTargetTop: 180,
        bgTargetBottom: 80,
        bgLow: 70
      },
      DEFAULT_FEATURES: ['bgnow', 'delta', 'direction', 'timeago', 'devicestatus', 'upbat', 'errorcodes', 'profile', 'dbsize', 'runtimestate', 'bridge'],
      authDefaultRoles: 'readable',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the settings
    const settingsCollection = tenantDb.collection('settings');
    
    // Check if settings already exist
    const existingSettings = await settingsCollection.findOne({});
    if (existingSettings) {
      console.log('\nSettings already exist. Updating bridge configuration...');
      const result = await settingsCollection.updateOne(
        {},
        { 
          $set: { 
            bridge: bridgeSettings.bridge,
            updatedAt: new Date()
          } 
        }
      );
      console.log('Updated:', result.modifiedCount > 0);
    } else {
      console.log('\nNo settings found. Creating new settings document...');
      const result = await settingsCollection.insertOne(bridgeSettings);
      console.log('Inserted:', result.insertedId);
    }
    
    // Verify the settings
    const finalSettings = await settingsCollection.findOne({});
    console.log('\nFinal settings verification:');
    console.log('Bridge enabled:', finalSettings?.bridge?.enable);
    console.log('Bridge userName:', finalSettings?.bridge?.userName ? 'SET' : 'NOT SET');
    console.log('Bridge password:', finalSettings?.bridge?.password ? 'SET' : 'NOT SET');
    console.log('Poll interval:', finalSettings?.bridge?.pollInterval);
    
    client.close();
    console.log('\nDone! Bridge settings have been configured.');
    console.log('\nNOTE: You need to set the actual Dexcom credentials:');
    console.log('- BRIDGE_USER_NAME: Your Dexcom username');
    console.log('- BRIDGE_PASSWORD: Your Dexcom password');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

createBridgeSettings();