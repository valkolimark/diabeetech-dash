const MongoClient = require('mongodb').MongoClient;

async function fixOnepanmanSettings() {
  let client;
  
  try {
    // Get connection string from environment
    const uri = process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.CONNECTION_STRING;
    
    if (!uri) {
      throw new Error('No MongoDB connection string found. Please set MONGODB_URI environment variable.');
    }
    
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // Step 1: Update tenant record to ensure correct database name
    console.log('\n=== Step 1: Checking tenant record ===');
    const tenantsCollection = db.collection('tenants');
    const onepanman = await tenantsCollection.findOne({ subdomain: 'onepanman' });
    
    if (onepanman) {
      console.log('Found onepanman tenant:');
      console.log('- Tenant ID:', onepanman.tenantId);
      console.log('- Current database:', onepanman.databaseName);
      
      if (onepanman.databaseName !== 'nightscout-tenant-onepanman') {
        console.log('\nUpdating database name to nightscout-tenant-onepanman...');
        await tenantsCollection.updateOne(
          { subdomain: 'onepanman' },
          { $set: { databaseName: 'nightscout-tenant-onepanman' } }
        );
        console.log('Updated!');
      } else {
        console.log('Database name is already correct.');
      }
    } else {
      console.log('ERROR: No onepanman tenant found!');
      return;
    }
    
    // Step 2: Add bridge settings to the correct database
    console.log('\n=== Step 2: Adding bridge settings to nightscout-tenant-onepanman ===');
    const tenantDb = client.db('nightscout-tenant-onepanman');
    
    // Create the bridge settings
    const bridgeSettings = {
      bridge: {
        enable: true,
        userName: process.env.DEXCOM_USERNAME || 'YOUR_DEXCOM_USERNAME',
        password: process.env.DEXCOM_PASSWORD || 'YOUR_DEXCOM_PASSWORD',
        server: 'US',
        firstFetchCount: 3,
        maxFetchCount: 1,
        fetchCount: 1,
        maxRetryDuration: 60000,
        retryDelay: 1000,
        pollInterval: 150000  // 2.5 minutes
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
    
    // Check and update settings
    const settingsCollection = tenantDb.collection('settings');
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
      console.log('Inserted:', !!result.insertedId);
    }
    
    // Verify the settings
    const finalSettings = await settingsCollection.findOne({});
    console.log('\n=== Settings Verification ===');
    console.log('Bridge enabled:', finalSettings?.bridge?.enable);
    console.log('Bridge userName:', finalSettings?.bridge?.userName);
    console.log('Bridge password:', finalSettings?.bridge?.password ? '[SET]' : '[NOT SET]');
    console.log('Poll interval:', finalSettings?.bridge?.pollInterval, 'ms');
    
    // Step 3: List collections in both databases
    console.log('\n=== Step 3: Database Contents ===');
    console.log('\nnightscout-tenant-onepanman collections:');
    const collections = await tenantDb.listCollections().toArray();
    collections.forEach(col => console.log(' -', col.name));
    
    // Check entries count
    const entriesCount = await tenantDb.collection('entries').countDocuments();
    console.log('\nEntries count:', entriesCount);
    
    // Check latest entry
    const latestEntry = await tenantDb.collection('entries').findOne({}, { sort: { date: -1 } });
    if (latestEntry) {
      console.log('Latest entry:', new Date(latestEntry.date), '- SGV:', latestEntry.sgv);
    }
    
    console.log('\n=== IMPORTANT NOTES ===');
    console.log('1. The bridge settings have been configured in nightscout-tenant-onepanman');
    console.log('2. You need to set the actual Dexcom credentials as environment variables:');
    console.log('   - DEXCOM_USERNAME: Your Dexcom username');
    console.log('   - DEXCOM_PASSWORD: Your Dexcom password');
    console.log('3. After setting credentials, restart the app for the bridge to start fetching data');
    console.log('4. The duplicate database tenant_onepanman can be deleted from MongoDB Atlas');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run the fix
fixOnepanmanSettings();