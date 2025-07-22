const MongoClient = require('mongodb').MongoClient;

async function checkOnepanman() {
  const masterUri = process.env.MASTER_MONGODB_URI;
  
  if (!masterUri) {
    console.log('MASTER_MONGODB_URI not set - cannot check database');
    return;
  }
  
  try {
    const client = await MongoClient.connect(masterUri, { useUnifiedTopology: true });
    const db = client.db();
    const tenant = await db.collection('tenants').findOne({ subdomain: 'onepanman' });
    
    if (tenant) {
      console.log('Tenant found:');
      console.log('- Subdomain:', tenant.subdomain);
      console.log('- Name:', tenant.tenantName);
      console.log('- isAdmin:', tenant.isAdmin || false);
      console.log('- Active:', tenant.isActive);
    } else {
      console.log('No tenant found with subdomain: onepanman');
    }
    
    await client.close();
  } catch (err) {
    console.log('Error checking database:', err.message);
  }
}

checkOnepanman();