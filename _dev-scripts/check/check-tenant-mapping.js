const MongoClient = require('mongodb').MongoClient;

async function checkTenantMapping() {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_CONNECTION;
    if (!uri) {
      throw new Error('No MongoDB URI found in environment variables');
    }
    
    console.log('Connecting to MongoDB...');
    const client = await MongoClient.connect(uri);
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // Check the tenants collection
    console.log('\nChecking tenants collection...');
    const tenants = await db.collection('tenants').find({ subdomain: 'onepanman' }).toArray();
    
    console.log(`Found ${tenants.length} tenant(s) with subdomain 'onepanman':`);
    tenants.forEach((tenant, index) => {
      console.log(`\nTenant ${index + 1}:`);
      console.log('- Tenant ID:', tenant.tenantId);
      console.log('- Subdomain:', tenant.subdomain);
      console.log('- Database Name:', tenant.databaseName);
      console.log('- Active:', tenant.isActive);
      console.log('- Created:', tenant.createdAt);
    });
    
    // Check both databases
    console.log('\n\nChecking database contents...');
    
    const dbNames = ['nightscout-tenant-onepanman', 'tenant_onepanman'];
    
    for (const dbName of dbNames) {
      console.log(`\n--- Database: ${dbName} ---`);
      try {
        const tenantDb = client.db(dbName);
        const collections = await tenantDb.listCollections().toArray();
        console.log(`Collections (${collections.length}):`, collections.map(c => c.name).join(', '));
        
        // Check for settings
        const settings = await tenantDb.collection('settings').findOne({});
        console.log('Has settings document:', !!settings);
        if (settings) {
          console.log('Has bridge config:', !!settings.bridge);
        }
        
        // Check for entries
        const entriesCount = await tenantDb.collection('entries').countDocuments();
        console.log('Entries count:', entriesCount);
        
        // Check for recent entries
        const latestEntry = await tenantDb.collection('entries').findOne({}, { sort: { date: -1 } });
        if (latestEntry) {
          console.log('Latest entry date:', new Date(latestEntry.date));
        }
      } catch (err) {
        console.log('Error accessing database:', err.message);
      }
    }
    
    client.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkTenantMapping();