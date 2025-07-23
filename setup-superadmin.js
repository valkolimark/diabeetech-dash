#!/usr/bin/env node

/**
 * Setup SuperAdmin User for Diabeetech Multi-tenant
 * Creates or updates a superadmin user with the specified credentials
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');

// Environment configuration
const MONGODB_URI = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI || 'mongodb://localhost:27017/nightscout';

// SuperAdmin credentials from NEXT-SESSION-ADMIN-DASHBOARD.md
const DEFAULT_SUPERADMIN = {
  email: 'superadmin@diabeetech.net',
  password: 'Db#SuperAdmin2025!Secure',
  name: 'Super Admin'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupSuperAdmin() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🚀 Diabeetech SuperAdmin Setup');
    console.log('==============================\n');
    
    // Connect to MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Check if we're using defaults or custom
    console.log('\nDefault SuperAdmin credentials:');
    console.log(`  Email: ${DEFAULT_SUPERADMIN.email}`);
    console.log(`  Password: ${DEFAULT_SUPERADMIN.password}`);
    
    const useDefaults = await question('\nUse default credentials? (y/N): ');
    
    let email, password, name;
    
    if (useDefaults.toLowerCase() === 'y') {
      email = DEFAULT_SUPERADMIN.email;
      password = DEFAULT_SUPERADMIN.password;
      name = DEFAULT_SUPERADMIN.name;
    } else {
      email = await question('Enter SuperAdmin email: ');
      password = await question('Enter SuperAdmin password: ');
      name = await question('Enter SuperAdmin name: ');
      
      // Validate inputs
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Password strength check
      if (password.length < 12) {
        console.warn('⚠️  Warning: Password should be at least 12 characters for security');
        const proceed = await question('Continue anyway? (y/N): ');
        if (proceed.toLowerCase() !== 'y') {
          throw new Error('Setup cancelled');
        }
      }
    }
    
    // Check if superadmin already exists
    const existingAdmin = await usersCollection.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingAdmin) {
      console.log('\n⚠️  User with this email already exists');
      const update = await question('Update existing user to SuperAdmin? (y/N): ');
      
      if (update.toLowerCase() !== 'y') {
        console.log('Setup cancelled');
        return;
      }
      
      // Update existing user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await usersCollection.updateOne(
        { _id: existingAdmin._id },
        {
          $set: {
            role: 'superadmin',
            password: hashedPassword,
            name: name || existingAdmin.name,
            updatedAt: new Date(),
            emailVerified: true,
            status: 'active'
          }
        }
      );
      
      console.log(`\n✅ Updated existing user to SuperAdmin`);
      
    } else {
      // Create new superadmin
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const superadmin = {
        _id: uuidv4(),
        email: email.toLowerCase(),
        username: email.toLowerCase(),
        password: hashedPassword,
        name: name || 'Super Admin',
        role: 'superadmin',
        tenant: null, // SuperAdmin is not tied to any tenant
        status: 'active',
        emailVerified: true,
        createdAt: new Date(),
        lastLogin: null,
        settings: {
          theme: 'light',
          notifications: true,
          dashboardLayout: 'default'
        }
      };
      
      await usersCollection.insertOne(superadmin);
      
      console.log(`\n✅ Created new SuperAdmin user`);
    }
    
    // Create admin_audit collection if it doesn't exist
    const collections = await db.listCollections({ name: 'admin_audit' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('admin_audit');
      await db.collection('admin_audit').createIndex({ timestamp: -1 });
      await db.collection('admin_audit').createIndex({ user: 1 });
      await db.collection('admin_audit').createIndex({ action: 1 });
      console.log('✅ Created admin_audit collection');
    }
    
    // Log the setup action
    await db.collection('admin_audit').insertOne({
      action: 'superadmin.setup',
      user: 'system',
      userEmail: 'system',
      target: email,
      details: {
        setupType: existingAdmin ? 'update' : 'create',
        setupBy: process.env.USER || 'unknown'
      },
      timestamp: new Date()
    });
    
    // Display summary
    console.log('\n📊 Setup Summary:');
    console.log('================');
    console.log(`  Email: ${email}`);
    console.log(`  Role: superadmin`);
    console.log(`  Status: active`);
    console.log('\n🔐 Security Notes:');
    console.log('  - Change the password after first login');
    console.log('  - Enable 2FA for additional security');
    console.log('  - Keep credentials secure');
    
    // Test authentication
    const testUser = await usersCollection.findOne({ email: email.toLowerCase() });
    const authTest = await bcrypt.compare(password, testUser.password);
    
    if (authTest) {
      console.log('\n✅ Authentication test passed');
    } else {
      console.log('\n❌ Authentication test failed - please check setup');
    }
    
    // Environment setup reminder
    console.log('\n📝 Next Steps:');
    console.log('1. Enable admin dashboard in .env:');
    console.log('   FEATURE_ADMIN_DASHBOARD=true');
    console.log('   FEATURE_USER_MGMT=true');
    console.log('   FEATURE_TENANT_MGMT=true');
    console.log('\n2. Restart Diabeetech');
    console.log('\n3. Access admin dashboard at:');
    console.log('   /admin or /api/v1/admin');
    
    console.log('\n✅ SuperAdmin setup completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await client.close();
  }
}

// Add command line argument parsing
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Diabeetech SuperAdmin Setup Script

Usage: node setup-superadmin.js [options]

Options:
  --help, -h     Show this help message
  --default      Use default credentials without prompting
  
Environment Variables:
  MONGODB_URI    MongoDB connection string (default: mongodb://localhost:27017/nightscout)

Default Credentials:
  Email: ${DEFAULT_SUPERADMIN.email}
  Password: ${DEFAULT_SUPERADMIN.password}

Example:
  node setup-superadmin.js
  node setup-superadmin.js --default
  MONGODB_URI=mongodb://user:pass@host:port/db node setup-superadmin.js
`);
  process.exit(0);
}

// Quick setup with --default flag
if (process.argv.includes('--default')) {
  setupSuperAdminQuick();
} else {
  setupSuperAdmin();
}

async function setupSuperAdminQuick() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    const hashedPassword = await bcrypt.hash(DEFAULT_SUPERADMIN.password, 10);
    
    await db.collection('users').updateOne(
      { email: DEFAULT_SUPERADMIN.email.toLowerCase() },
      {
        $set: {
          _id: uuidv4(),
          email: DEFAULT_SUPERADMIN.email.toLowerCase(),
          username: DEFAULT_SUPERADMIN.email.toLowerCase(),
          password: hashedPassword,
          name: DEFAULT_SUPERADMIN.name,
          role: 'superadmin',
          tenant: null,
          status: 'active',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log('✅ SuperAdmin created/updated with default credentials');
    console.log(`   Email: ${DEFAULT_SUPERADMIN.email}`);
    console.log(`   Password: ${DEFAULT_SUPERADMIN.password}`);
    
  } catch (error) {
    console.error('❌ Quick setup failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}