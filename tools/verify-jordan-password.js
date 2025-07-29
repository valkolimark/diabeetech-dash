const MongoClient = require('mongodb').MongoClient;

const MONGODB_URI = process.argv[2];

if (!MONGODB_URI) {
  console.error('Please provide MongoDB URI as argument');
  process.exit(1);
}

async function verifyJordanPassword() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    // Check master database
    const masterDb = client.db('nightscout-master');
    const usersCollection = masterDb.collection('users');
    
    // Find Jordan's user
    const jordanUser = await usersCollection.findOne({ email: 'jordan@p5400.com' });
    
    if (!jordanUser) {
      console.error('❌ User not found: jordan@p5400.com');
      return;
    }
    
    console.log('=== Jordan User Details ===');
    console.log(`Email: ${jordanUser.email}`);
    console.log(`User ID: ${jordanUser._id}`);
    console.log(`Tenant ID: ${jordanUser.tenantId}`);
    console.log(`Has Password Field: ${!!jordanUser.password}`);
    console.log(`Password Value: ${jordanUser.password ? '[HASHED]' : 'NULL/UNDEFINED'}`);
    console.log(`Role: ${jordanUser.role || 'Not set'}`);
    console.log(`Status: ${jordanUser.status || 'Not set'}`);
    
    // Check if user collection exists in tenant database
    const tenantDb = client.db('nightscout_3231e141e813d8b788a306ed');
    const collections = await tenantDb.listCollections().toArray();
    console.log('\n=== Tenant Database Check ===');
    console.log(`Has users collection: ${collections.some(c => c.name === 'users')}`);
    
    if (collections.some(c => c.name === 'users')) {
      const tenantUsers = await tenantDb.collection('users').find({ email: 'jordan@p5400.com' }).toArray();
      console.log(`Users in tenant DB: ${tenantUsers.length}`);
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

verifyJordanPassword();