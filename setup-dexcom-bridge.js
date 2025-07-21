// Script to set up Dexcom bridge for a tenant
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_CONNECTION || process.env.MONGODB_URI;
const TENANT_ID = process.env.TENANT_ID || 'onepanman'; // Change this to your tenant ID

if (!MONGO_URI) {
  console.error('MongoDB connection string not found in environment variables');
  process.exit(1);
}

async function setupDexcomBridge() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const tenantDb = client.db(`tenant_${TENANT_ID}`);
    const settingsCollection = tenantDb.collection('settings');
    
    // Check current settings
    const currentSettings = await settingsCollection.findOne({});
    console.log('Current settings:', JSON.stringify(currentSettings, null, 2));
    
    // Prompt for Dexcom credentials
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const question = (prompt) => new Promise((resolve) => readline.question(prompt, resolve));
    
    console.log('\n=== Dexcom Bridge Setup ===');
    console.log('Enter your Dexcom Share credentials:');
    
    const username = await question('Dexcom username: ');
    const password = await question('Dexcom password: ');
    const server = await question('Dexcom server (us/eu) [default: us]: ') || 'us';
    
    readline.close();
    
    // Update settings with Dexcom bridge configuration
    const bridgeSettings = {
      bridge: {
        userName: username,
        password: password,
        server: server,
        minutes: '1440' // 24 hours of data
      }
    };
    
    // Enable bridge plugin if not already enabled
    let enable = currentSettings?.enable || '';
    if (!enable.includes('bridge')) {
      enable = enable ? `${enable} bridge` : 'bridge';
    }
    
    const updateResult = await settingsCollection.updateOne(
      {},
      {
        $set: {
          ...bridgeSettings,
          enable: enable,
          lastModified: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log('\n✅ Dexcom bridge settings updated successfully!');
    console.log('Update result:', updateResult);
    
    // Verify the update
    const updatedSettings = await settingsCollection.findOne({});
    console.log('\nUpdated settings:');
    console.log('- Bridge enabled:', updatedSettings.enable?.includes('bridge'));
    console.log('- Bridge username:', updatedSettings.bridge?.userName);
    console.log('- Bridge server:', updatedSettings.bridge?.server);
    
    console.log('\n🔄 Please restart your Nightscout app for changes to take effect.');
    console.log('The bridge will start fetching data from Dexcom Share.');
    
  } catch (error) {
    console.error('Error setting up Dexcom bridge:', error);
  } finally {
    await client.close();
  }
}

setupDexcomBridge();