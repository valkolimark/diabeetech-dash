const { MongoClient } = require('mongodb');
const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;

(async () => {
  const client = new MongoClient(MASTER_DB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    // Search for tenant named Jordan Marco
    const tenant = await db.collection('tenants').findOne({ 
      name: { $regex: 'Jordan Marco', $options: 'i' }
    });
    
    if (tenant) {
      console.log('Found tenant:', JSON.stringify(tenant, null, 2));
    } else {
      console.log('No tenant found with name Jordan Marco');
      
      // List all tenants to help find the right one
      const allTenants = await db.collection('tenants').find({}).toArray();
      console.log('\nAll tenants:');
      allTenants.forEach(t => {
        console.log(`- ${t.name} (subdomain: ${t.subdomain})`);
      });
    }
  } finally {
    await client.close();
  }
})();