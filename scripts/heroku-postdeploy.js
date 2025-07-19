#!/usr/bin/env node
'use strict';

/**
 * Heroku post-deployment script for Nightscout Multi-Tenant
 * Initializes the database and creates initial tenants
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;

// Configuration from environment
const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'diabeetech.com';
const ADMIN_EMAIL = 'mark@p5400.com';

// Initial tenants to create
const INITIAL_TENANTS = [
  {
    name: 'Clinic One',
    subdomain: 'clinic1',
    adminEmail: 'admin@clinic1.diabeetech.com',
    adminPassword: generateSecurePassword(),
    adminName: 'Clinic One Admin'
  },
  {
    name: 'Clinic Two',
    subdomain: 'clinic2',
    adminEmail: 'admin@clinic2.diabeetech.com',
    adminPassword: generateSecurePassword(),
    adminName: 'Clinic Two Admin'
  }
];

function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function createIndexes(db) {
  console.log('Creating indexes...');
  
  // Tenants collection indexes
  await db.collection('tenants').createIndex({ subdomain: 1 }, { unique: true });
  await db.collection('tenants').createIndex({ tenantId: 1 }, { unique: true });
  await db.collection('tenants').createIndex({ isActive: 1 });
  
  // Users collection indexes
  await db.collection('users').createIndex({ email: 1, tenantId: 1 }, { unique: true });
  await db.collection('users').createIndex({ tenantId: 1 });
  await db.collection('users').createIndex({ userId: 1 }, { unique: true });
  
  console.log('Indexes created successfully');
}

async function createTenant(client, masterDb, tenantData) {
  console.log(`\nCreating tenant: ${tenantData.name} (${tenantData.subdomain})`);
  
  const tenantsCollection = masterDb.collection('tenants');
  const usersCollection = masterDb.collection('users');
  
  // Check if tenant already exists
  const existingTenant = await tenantsCollection.findOne({ subdomain: tenantData.subdomain });
  if (existingTenant) {
    console.log(`  Tenant ${tenantData.subdomain} already exists, skipping...`);
    return existingTenant;
  }
  
  // Create tenant
  const tenantId = uuidv4();
  const tenant = {
    tenantId: tenantId,
    name: tenantData.name,
    subdomain: tenantData.subdomain,
    settings: {
      units: 'mg/dl',
      timeFormat: 12,
      theme: 'colors',
      alarmTypes: ['simple'],
      enabledPlugins: ['careportal', 'iob', 'cob', 'bwp', 'cage', 'sage', 'iage', 'treatmentnotify', 'basal', 'dbsize']
    },
    features: {
      maxUsers: 50,
      dataRetentionDays: 365,
      realtimeData: true,
      reports: true,
      predictions: true
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await tenantsCollection.insertOne(tenant);
  console.log(`  Created tenant: ${tenantId}`);
  
  // Create admin user
  const adminPassword = await bcrypt.hash(tenantData.adminPassword, 10);
  const adminUser = {
    userId: uuidv4(),
    tenantId: tenantId,
    email: tenantData.adminEmail,
    password: adminPassword,
    name: tenantData.adminName,
    role: 'admin',
    permissions: ['*'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await usersCollection.insertOne(adminUser);
  console.log(`  Created admin user: ${tenantData.adminEmail}`);
  
  // Create tenant database
  const tenantDbName = `nightscout-tenant-${tenantData.subdomain}`;
  console.log(`  Creating tenant database: ${tenantDbName}`);
  
  const tenantDb = client.db(tenantDbName);
  
  // Create collections with indexes
  const collections = ['entries', 'treatments', 'devicestatus', 'profile', 'food', 'activity'];
  for (const collectionName of collections) {
    await tenantDb.createCollection(collectionName);
  }
  
  // Create indexes for tenant collections
  await tenantDb.collection('entries').createIndex({ date: -1 });
  await tenantDb.collection('entries').createIndex({ type: 1 });
  await tenantDb.collection('treatments').createIndex({ created_at: -1 });
  await tenantDb.collection('treatments').createIndex({ eventType: 1 });
  await tenantDb.collection('devicestatus').createIndex({ created_at: -1 });
  await tenantDb.collection('profile').createIndex({ startDate: -1 });
  
  console.log(`  Tenant database initialized`);
  
  return { tenant, adminPassword: tenantData.adminPassword };
}

async function main() {
  console.log('Nightscout Multi-Tenant Post-Deployment Script');
  console.log('==============================================');
  
  if (!MASTER_DB_URI) {
    console.error('ERROR: MASTER_MONGODB_URI environment variable is not set!');
    process.exit(1);
  }
  
  const client = new MongoClient(MASTER_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const masterDb = client.db();
    
    // Create indexes
    await createIndexes(masterDb);
    
    // Create initial tenants
    const createdTenants = [];
    for (const tenantData of INITIAL_TENANTS) {
      const result = await createTenant(client, masterDb, tenantData);
      if (result && result.adminPassword) {
        createdTenants.push({
          ...tenantData,
          password: result.adminPassword
        });
      }
    }
    
    // Output summary
    console.log('\n========================================');
    console.log('✅ Post-deployment setup completed!');
    console.log('========================================\n');
    
    console.log('Your Nightscout Multi-Tenant instance is ready!');
    console.log(`Base URL: https://btech-d038118b5224.herokuapp.com`);
    console.log(`Domain: ${BASE_DOMAIN}\n`);
    
    if (createdTenants.length > 0) {
      console.log('Initial Tenants Created:');
      console.log('------------------------');
      for (const tenant of createdTenants) {
        console.log(`\n${tenant.name}:`);
        console.log(`  URL: https://${tenant.subdomain}.${BASE_DOMAIN}`);
        console.log(`  Admin Email: ${tenant.adminEmail}`);
        console.log(`  Admin Password: ${tenant.password}`);
      }
      
      console.log('\n⚠️  IMPORTANT: Save these passwords securely!');
      console.log('Admin users can change their passwords after first login.\n');
    }
    
    console.log('Master Admin Email:', ADMIN_EMAIL);
    console.log('\n📧 An email with credentials will be sent to', ADMIN_EMAIL);
    
    // Send email with credentials (if email is configured)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      
      const emailContent = `
        <h2>Your Nightscout Multi-Tenant Instance is Ready!</h2>
        <p>Your deployment to Heroku has completed successfully.</p>
        
        <h3>Access Information:</h3>
        <ul>
          <li>Base URL: <a href="https://btech-d038118b5224.herokuapp.com">https://btech-d038118b5224.herokuapp.com</a></li>
          <li>Domain: ${BASE_DOMAIN}</li>
        </ul>
        
        <h3>Initial Tenants:</h3>
        ${createdTenants.map(tenant => `
          <h4>${tenant.name}</h4>
          <ul>
            <li>URL: <a href="https://${tenant.subdomain}.${BASE_DOMAIN}">https://${tenant.subdomain}.${BASE_DOMAIN}</a></li>
            <li>Admin Email: ${tenant.adminEmail}</li>
            <li>Admin Password: <code>${tenant.password}</code></li>
          </ul>
        `).join('')}
        
        <p><strong>⚠️ Important:</strong> Please save these passwords securely and change them after first login.</p>
        
        <h3>Next Steps:</h3>
        <ol>
          <li>Configure DNS wildcards in GoDaddy (*.diabeetech.com → btech-d038118b5224.herokuapp.com)</li>
          <li>Test login to each tenant</li>
          <li>Create additional users as needed</li>
          <li>Configure CGM data sources</li>
        </ol>
      `;
      
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: ADMIN_EMAIL,
          subject: 'Nightscout Multi-Tenant Deployment Successful',
          html: emailContent
        });
        console.log('✅ Credential email sent successfully');
      } catch (error) {
        console.log('⚠️  Could not send email:', error.message);
      }
    }
    
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;