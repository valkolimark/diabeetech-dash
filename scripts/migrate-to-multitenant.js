#!/usr/bin/env node
'use strict';

/**
 * Migration script to convert single-tenant Nightscout to multi-tenant
 * 
 * Usage: node scripts/migrate-to-multitenant.js
 * 
 * This script will:
 * 1. Create a default tenant
 * 2. Create an admin user for the tenant
 * 3. Copy existing data to the tenant database
 * 4. Update configuration
 */

const MongoClient = require('mongodb').MongoClient;
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function migrate() {
  console.log('Nightscout Multi-Tenant Migration Tool');
  console.log('=====================================\n');
  
  try {
    // Get MongoDB URI
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_CONNECTION || 
                    await prompt('Enter MongoDB URI: ');
    
    if (!mongoUri) {
      throw new Error('MongoDB URI is required');
    }
    
    // Get tenant information
    console.log('\nTenant Configuration:');
    const tenantName = await prompt('Enter tenant name (e.g., "My Clinic"): ');
    const subdomain = await prompt('Enter subdomain (e.g., "myclinic"): ');
    const adminEmail = await prompt('Enter admin email: ');
    const adminPassword = await prompt('Enter admin password (min 8 chars): ');
    
    if (!tenantName || !subdomain || !adminEmail || !adminPassword) {
      throw new Error('All fields are required');
    }
    
    if (adminPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain)) {
      throw new Error('Invalid subdomain format');
    }
    
    console.log('\nConnecting to MongoDB...');
    const client = new MongoClient(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await client.connect();
    console.log('Connected successfully');
    
    // Get original database name
    const originalDbName = client.s.options.dbName;
    const originalDb = client.db(originalDbName);
    
    // Create master database
    const masterDbName = 'nightscout-master';
    const masterDb = client.db(masterDbName);
    
    console.log(`\nCreating master database: ${masterDbName}`);
    
    // Create tenant
    const tenantsCollection = masterDb.collection('tenants');
    const tenant = {
      tenantId: crypto.randomUUID(),
      tenantName: tenantName,
      subdomain: subdomain.toLowerCase(),
      databaseName: `nightscout-tenant-${subdomain.toLowerCase()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      settings: {},
      contactEmail: adminEmail,
      maxUsers: 50,
      features: ['core']
    };
    
    await tenantsCollection.insertOne(tenant);
    console.log('Tenant created:', tenant.tenantId);
    
    // Create indexes
    await tenantsCollection.createIndex({ subdomain: 1 }, { unique: true });
    await tenantsCollection.createIndex({ tenantId: 1 }, { unique: true });
    
    // Create admin user
    const usersCollection = masterDb.collection('users');
    const adminUser = {
      userId: crypto.randomUUID(),
      tenantId: tenant.tenantId,
      email: adminEmail.toLowerCase(),
      passwordHash: crypto.createHash('sha1').update(adminPassword).digest('hex'),
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      profile: {
        displayName: 'Administrator',
        units: 'mg/dl'
      },
      permissions: ['*'],
      emailVerified: true
    };
    
    await usersCollection.insertOne(adminUser);
    console.log('Admin user created:', adminUser.email);
    
    // Create indexes
    await usersCollection.createIndex({ tenantId: 1, email: 1 }, { unique: true });
    await usersCollection.createIndex({ userId: 1 }, { unique: true });
    
    // Create tenant database
    console.log(`\nCreating tenant database: ${tenant.databaseName}`);
    const tenantDb = client.db(tenant.databaseName);
    
    // Collections to migrate
    const collections = [
      'entries',
      'treatments', 
      'devicestatus',
      'profile',
      'food',
      'activity',
      'settings'
    ];
    
    // Copy data from original database
    const copyData = await prompt('\nCopy existing data to tenant database? (yes/no): ');
    
    if (copyData.toLowerCase() === 'yes') {
      console.log('\nMigrating data...');
      
      for (const collName of collections) {
        try {
          const sourceCollection = originalDb.collection(collName);
          const targetCollection = tenantDb.collection(collName);
          
          const count = await sourceCollection.countDocuments();
          if (count > 0) {
            console.log(`Copying ${count} documents from ${collName}...`);
            
            const documents = await sourceCollection.find({}).toArray();
            await targetCollection.insertMany(documents);
            
            // Copy indexes
            const indexes = await sourceCollection.indexes();
            for (const index of indexes) {
              if (index.name !== '_id_') {
                delete index.v;
                delete index.ns;
                await targetCollection.createIndex(index.key, {
                  name: index.name,
                  ...index
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error migrating ${collName}:`, err.message);
        }
      }
      
      console.log('Data migration completed');
    }
    
    // Generate environment configuration
    console.log('\n=== Configuration ===');
    console.log('\nAdd these environment variables to enable multi-tenant mode:\n');
    console.log(`MULTI_TENANT_ENABLED=true`);
    console.log(`MASTER_MONGODB_URI=${mongoUri.replace(originalDbName, masterDbName)}`);
    console.log(`TENANT_DB_PREFIX=nightscout-tenant-`);
    console.log(`JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`);
    console.log(`BASE_DOMAIN=your-domain.com`);
    console.log(`DEFAULT_TENANT=${subdomain}`);
    console.log('\n=== Access Information ===');
    console.log(`\nTenant URL: https://${subdomain}.your-domain.com`);
    console.log(`Admin Email: ${adminEmail}`);
    console.log(`Admin Password: [as entered]`);
    console.log('\n=== Next Steps ===');
    console.log('1. Update your environment variables as shown above');
    console.log('2. Restart your Nightscout server');
    console.log('3. Access your tenant at the URL shown above');
    console.log('4. Login with the admin credentials');
    
    await client.close();
    console.log('\nMigration completed successfully!');
    
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run migration
migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});