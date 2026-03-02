const MongoClient = require('mongodb').MongoClient;

async function checkBridgeSettings() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Check the tenant database directly
    const tenantDb = client.db('nightscout-tenant-onepanman');
    console.log('\nChecking nightscout-tenant-onepanman database...');
    
    // Check settings collection
    const settings = await tenantDb.collection('settings').findOne({});
    console.log('\nSettings document found:', !!settings);
    
    if (settings) {
      console.log('Settings keys:', Object.keys(settings));
      console.log('Bridge config exists:', !!settings.bridge);
      if (settings.bridge) {
        console.log('Bridge enabled:', settings.bridge.enable);
        console.log('Bridge userName:', settings.bridge.userName ? 'SET' : 'NOT SET');
        console.log('Bridge password:', settings.bridge.password ? 'SET' : 'NOT SET');
        console.log('Bridge fields:', Object.keys(settings.bridge));
      }
    } else {
      console.log('NO SETTINGS DOCUMENT FOUND - This is the problem!');
      
      // Check if there are any documents in settings collection
      const count = await tenantDb.collection('settings').countDocuments();
      console.log('Total documents in settings collection:', count);
      
      // List all collections in the tenant database
      const collections = await tenantDb.listCollections().toArray();
      console.log('\nCollections in tenant database:');
      collections.forEach(col => console.log(' -', col.name));
    }
    
    client.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkBridgeSettings();