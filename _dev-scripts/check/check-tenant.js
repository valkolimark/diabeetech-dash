const MongoClient = require('mongodb').MongoClient;

async function checkTenant() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const tenants = await db.collection('tenants').find({ isActive: true }).toArray();
    console.log('Active tenants:', tenants.length);
    
    tenants.forEach(t => {
      console.log('- ' + t.subdomain + ' (ID: ' + t.tenantId + ', DB: ' + t.databaseName + ')');
    });
    
    // Check onepanman specifically
    const onepanman = await db.collection('tenants').findOne({ subdomain: 'onepanman' });
    console.log('\nOnepanman tenant:', onepanman ? 'FOUND' : 'NOT FOUND');
    if (onepanman) {
      console.log('Tenant ID:', onepanman.tenantId);
      console.log('Database:', onepanman.databaseName);
      console.log('Active:', onepanman.isActive);
    }
    
    client.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkTenant();