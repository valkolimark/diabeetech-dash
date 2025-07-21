const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';

async function checkDatabases() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  
  // Check master database
  const masterDb = client.db('nightscout-master');
  const tenants = await masterDb.collection('tenants').find({ subdomain: 'onepanman' }).toArray();
  console.log('Tenant record:', JSON.stringify(tenants[0], null, 2));
  
  // Check tenant database
  const tenantDb = client.db('tenant_onepanman');
  const collections = await tenantDb.listCollections().toArray();
  console.log('\nTenant database collections:', collections.map(c => c.name));
  
  const settings = await tenantDb.collection('settings').findOne({});
  console.log('\nSettings found:', !!settings);
  console.log('Bridge configured:', !!settings?.bridge);
  console.log('Bridge enabled:', settings?.bridge?.enable);
  
  await client.close();
}

checkDatabases();