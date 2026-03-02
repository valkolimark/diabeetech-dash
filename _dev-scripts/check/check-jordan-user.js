const MongoClient = require('mongodb').MongoClient;
const crypto = require('crypto');

// Get MongoDB URI from command line
const MONGODB_URI = process.argv[2];

if (!MONGODB_URI) {
  console.error('Please provide MongoDB URI as argument');
  console.error('Usage: node tools/check-jordan-user.js "mongodb+srv://..."');
  process.exit(1);
}

async function checkJordanUser() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    // Check master database for tenant info
    const masterDb = client.db('nightscout-master');
    const tenantsCollection = masterDb.collection('tenants');
    
    console.log('=== Checking Jordan Tenant Info ===');
    const jordanTenant = await tenantsCollection.findOne({ subdomain: 'jordan' });
    
    if (jordanTenant) {
      console.log('Tenant found:');
      console.log(`  Subdomain: ${jordanTenant.subdomain}`);
      console.log(`  Database: ${jordanTenant.databaseName}`);
      console.log(`  Admin User ID: ${jordanTenant.adminUserId}`);
      console.log(`  Created: ${jordanTenant.createdAt}`);
    }
    
    // Check users in master database
    console.log('\n=== Checking Users in Master Database ===');
    const usersCollection = masterDb.collection('users');
    
    // Find users associated with Jordan
    const jordanUsers = await usersCollection.find({
      $or: [
        { email: 'jordan@p5400.com' },
        { tenantId: jordanTenant?._id },
        { tenantId: jordanTenant?.tenantId },
        { _id: jordanTenant?.adminUserId }
      ]
    }).toArray();
    
    console.log(`Found ${jordanUsers.length} user(s):`);
    jordanUsers.forEach(user => {
      console.log(`\n  Email: ${user.email}`);
      console.log(`  Username: ${user.username || 'N/A'}`);
      console.log(`  User ID: ${user._id}`);
      console.log(`  Tenant ID: ${user.tenantId}`);
      console.log(`  Roles: ${user.roles?.join(', ') || 'N/A'}`);
      console.log(`  Has Password: ${!!user.password}`);
    });
    
    // Check Jordan's tenant database
    console.log('\n=== Checking Jordan Tenant Database ===');
    const jordanDb = client.db('nightscout_3231e141e813d8b788a306ed');
    
    // Check for users collection in tenant database
    const collections = await jordanDb.listCollections().toArray();
    const hasUsersCollection = collections.some(c => c.name === 'users');
    
    if (hasUsersCollection) {
      const tenantUsers = await jordanDb.collection('users').find({}).toArray();
      console.log(`Found ${tenantUsers.length} users in tenant database`);
      tenantUsers.forEach(user => {
        console.log(`  Email: ${user.email}, Has Password: ${!!user.password}`);
      });
    } else {
      console.log('No users collection in tenant database (this is normal for multi-tenant)');
    }
    
    // Suggest password reset
    console.log('\n=== Password Reset Instructions ===');
    console.log('To reset Jordan\'s password, use one of these methods:');
    console.log('\n1. Using the password reset script:');
    console.log('   node scripts/reset-user-password.js jordan@p5400.com NewPassword123!');
    console.log('\n2. Or create a new admin user for Jordan:');
    console.log('   node tools/create-jordan-admin.js');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkJordanUser();