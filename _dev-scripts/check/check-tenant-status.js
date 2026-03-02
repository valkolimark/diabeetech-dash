const MongoClient = require('mongodb').MongoClient;

const MONGODB_URI = process.argv[2];
const SUBDOMAIN = process.argv[3] || 'testreg';

if (!MONGODB_URI) {
  console.error('Please provide MongoDB URI as argument');
  console.error('Usage: node tools/check-tenant-status.js "mongodb+srv://..." [subdomain]');
  process.exit(1);
}

async function checkTenantStatus() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    const masterDb = client.db('nightscout-master');
    const tenantsCollection = masterDb.collection('tenants');
    
    // Find tenant
    const tenant = await tenantsCollection.findOne({ subdomain: SUBDOMAIN });
    
    if (!tenant) {
      console.error(`❌ Tenant not found: ${SUBDOMAIN}`);
      return;
    }
    
    console.log(`=== Tenant: ${SUBDOMAIN} ===`);
    console.log(`Name: ${tenant.tenantName}`);
    console.log(`Database: ${tenant.databaseName}`);
    console.log(`Status: ${tenant.status}`);
    console.log(`Active: ${tenant.isActive}`);
    console.log(`Created: ${tenant.createdAt}`);
    console.log(`Contact: ${tenant.contactEmail}`);
    
    // Check if database exists
    const admin = client.db().admin();
    const dbList = await admin.listDatabases();
    const dbExists = dbList.databases.some(db => db.name === tenant.databaseName);
    console.log(`Database exists: ${dbExists ? '✅' : '❌'}`);
    
    // Check users
    const usersCollection = masterDb.collection('users');
    const users = await usersCollection.find({ tenantId: tenant.tenantId }).toArray();
    console.log(`\nUsers: ${users.length}`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - Has passwordHash: ${!!user.passwordHash}`);
    });
    
    if (dbExists) {
      // Check tenant database collections
      const tenantDb = client.db(tenant.databaseName);
      const collections = await tenantDb.listCollections().toArray();
      console.log(`\nCollections in tenant database:`);
      collections.forEach(coll => {
        console.log(`  - ${coll.name}`);
      });
      
      // Check settings
      const settings = await tenantDb.collection('settings').findOne({});
      console.log(`\nBridge configuration:`);
      if (settings?.bridge) {
        console.log(`  Enabled: ${settings.bridge.enable}`);
        console.log(`  Username: ${settings.bridge.userName || 'Not set'}`);
        console.log(`  Has Password: ${!!settings.bridge.password}`);
      } else {
        console.log(`  ❌ No bridge configuration found`);
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkTenantStatus();