// Check superadmin account status
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// Connection string from environment
const uri = process.env.MONGODB_URI || process.env.MASTER_MONGODB_URI;

if (!uri) {
  console.error('No MongoDB URI found in environment');
  process.exit(1);
}

async function checkSuperAdmin() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('nightscout_shared');
    const users = db.collection('users');
    
    // Look for superadmin
    const superadmins = await users.find({ role: 'superadmin' }).toArray();
    
    console.log(`\nFound ${superadmins.length} superadmin account(s):`);
    
    superadmins.forEach(admin => {
      console.log('\n-------------------');
      console.log('ID:', admin._id);
      console.log('Email:', admin.email);
      console.log('Username:', admin.username);
      console.log('Role:', admin.role);
      console.log('Created:', admin.createdAt);
      console.log('Last Login:', admin.lastLogin || 'Never');
      console.log('Email Verified:', admin.emailVerified || false);
      console.log('Has Password:', !!admin.password);
    });
    
    // Check if we need to create one
    if (superadmins.length === 0) {
      console.log('\nNo superadmin found. Creating default superadmin...');
      
      const salt = crypto.randomBytes(16).toString('hex');
      const password = 'Db#SuperAdmin2025!Secure';
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      
      const newAdmin = {
        email: 'superadmin@diabeetech.net',
        username: 'superadmin',
        password: `${salt}:${hash}`,
        role: 'superadmin',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await users.insertOne(newAdmin);
      console.log('Created superadmin:', result.insertedId);
      console.log('Email: superadmin@diabeetech.net');
      console.log('Password: Db#SuperAdmin2025!Secure');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkSuperAdmin();