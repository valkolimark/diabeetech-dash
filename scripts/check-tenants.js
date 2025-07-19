const MongoClient = require('mongodb').MongoClient;

async function checkTenants() {
  const uri = process.env.MASTER_MONGODB_URI;
  
  if (!uri) {
    console.error('MASTER_MONGODB_URI not set');
    process.exit(1);
  }

  try {
    const client = await MongoClient.connect(uri, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    const db = client.db();
    
    // Get tenants
    const tenants = await db.collection('tenants').find({}).toArray();
    console.log('\n=== Tenants ===');
    tenants.forEach(t => {
      console.log(`\nTenant: ${t.name}`);
      console.log(`  Subdomain: ${t.subdomain}`);
      console.log(`  URL: https://${t.subdomain}.diabeetech.net`);
    });
    
    // Get admin users
    const users = await db.collection('users').find({ role: 'admin' }).toArray();
    console.log('\n=== Admin Users ===');
    for (const user of users) {
      const tenant = tenants.find(t => t._id.toString() === user.tenantId.toString());
      console.log(`\nEmail: ${user.email}`);
      console.log(`  Tenant: ${tenant ? tenant.name : 'Unknown'}`);
      console.log(`  Login URL: https://${tenant ? tenant.subdomain : 'unknown'}.diabeetech.net/login`);
    }
    
    await client.close();
    console.log('\nNote: Passwords were sent to mark@p5400.com during deployment.\n');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkTenants();