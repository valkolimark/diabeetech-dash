const MongoClient = require('mongodb').MongoClient;
const bcrypt = require('bcryptjs');

// Get MongoDB URI
const MONGODB_URI = process.argv[2];
const NEW_PASSWORD = 'Camzack23'; // Set Jordan's password to match his Dexcom password

if (!MONGODB_URI) {
  console.error('Please provide MongoDB URI as argument');
  console.error('Usage: node tools/reset-jordan-password.js "mongodb+srv://..."');
  process.exit(1);
}

async function resetJordanPassword() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    // Connect to master database
    const masterDb = client.db('nightscout-master');
    const usersCollection = masterDb.collection('users');
    
    // Find Jordan's user
    const jordanUser = await usersCollection.findOne({ email: 'jordan@p5400.com' });
    
    if (!jordanUser) {
      console.error('❌ User not found: jordan@p5400.com');
      return;
    }
    
    console.log('Found user:');
    console.log(`  Email: ${jordanUser.email}`);
    console.log(`  User ID: ${jordanUser._id}`);
    console.log(`  Tenant ID: ${jordanUser.tenantId}`);
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);
    
    // Update the password
    const result = await usersCollection.updateOne(
      { _id: jordanUser._id },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        } 
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('\n✅ Password updated successfully!');
      console.log('\nNew login credentials for Jordan:');
      console.log(`  URL: https://jordan.diabeetech.net/login`);
      console.log(`  Email: jordan@p5400.com`);
      console.log(`  Password: ${NEW_PASSWORD}`);
    } else {
      console.error('❌ Failed to update password');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

resetJordanPassword();