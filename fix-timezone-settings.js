const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function fixTimezoneSettings() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('tenant_onepanman');
    
    // Get current settings
    const settings = await db.collection('settings').findOne({}) || {};
    
    console.log('Current timezone setting:', settings.timeFormat);
    console.log('Current language:', settings.language);
    
    // Update settings with Central Time Zone
    const updatedSettings = {
      ...settings,
      timeFormat: 12,
      language: 'en',
      timezone: 'America/Chicago', // Central Time Zone
      timeZone: 'America/Chicago', // Alternative property name
      showClockDelta: true,
      showClockLastTime: true,
      lastModified: new Date()
    };
    
    // Update settings
    const result = await db.collection('settings').replaceOne(
      {},
      updatedSettings,
      { upsert: true }
    );
    
    console.log('\n✅ Timezone settings updated!');
    console.log('- Timezone: America/Chicago (Central Time)');
    console.log('- Time format: 12-hour');
    
    // Also update the env settings for the tenant
    const envCollection = db.collection('env_settings');
    await envCollection.updateOne(
      { tenantId: 'onepanman' },
      { 
        $set: { 
          DISPLAY_TIMEZONE: 'America/Chicago',
          TIME_ZONE: 'America/Chicago',
          lastModified: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log('- Environment timezone settings also updated');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

fixTimezoneSettings();