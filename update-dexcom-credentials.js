const MongoClient = require('mongodb').MongoClient;

async function updateDexcomCredentials() {
  let client;
  
  try {
    // Get connection string from environment
    const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('No MongoDB connection string found. Please set MASTER_MONGODB_URI environment variable.');
    }
    
    // Set the credentials
    const username = 'mark@markmireles.com';
    const password = 'GodIsGood23!';
    
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    // Connect to the onepanman tenant database
    const tenantDb = client.db('nightscout-tenant-onepanman');
    console.log('\nConnected to nightscout-tenant-onepanman database');
    
    // Update the bridge credentials
    const settingsCollection = tenantDb.collection('settings');
    const result = await settingsCollection.updateOne(
      {},
      { 
        $set: { 
          'bridge.userName': username,
          'bridge.password': password,
          updatedAt: new Date()
        } 
      }
    );
    
    console.log('\nCredentials updated:', result.modifiedCount > 0);
    
    // Verify the update
    const settings = await settingsCollection.findOne({});
    console.log('\nVerification:');
    console.log('Bridge enabled:', settings?.bridge?.enable);
    console.log('Bridge userName:', settings?.bridge?.userName);
    console.log('Bridge password:', settings?.bridge?.password ? '[SET]' : '[NOT SET]');
    
    console.log('\nDone! The Dexcom bridge credentials have been updated.');
    console.log('The app will now start fetching glucose data from Dexcom.');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run the update
updateDexcomCredentials();