#!/usr/bin/env node
'use strict';

/**
 * Script to populate test data for multi-tenant Nightscout
 * Creates multiple tenants with sample users and CGM data
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;

// Configuration
const MASTER_DB_URI = process.env.MASTER_MONGODB_URI || 'mongodb://localhost:27017/nightscout_master';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'nightscout.local';

// Test data configuration
const TEST_TENANTS = [
  {
    name: 'Demo Clinic 1',
    subdomain: 'demo1',
    adminEmail: 'admin@demo1.com',
    adminPassword: 'Demo123!@#',
    users: [
      { email: 'nurse@demo1.com', password: 'Demo123!@#', name: 'Nurse Jane', role: 'caregiver' },
      { email: 'doctor@demo1.com', password: 'Demo123!@#', name: 'Dr. Smith', role: 'viewer' }
    ]
  },
  {
    name: 'Demo Clinic 2',
    subdomain: 'demo2',
    adminEmail: 'admin@demo2.com',
    adminPassword: 'Demo123!@#',
    users: [
      { email: 'nurse@demo2.com', password: 'Demo123!@#', name: 'Nurse Bob', role: 'caregiver' },
      { email: 'family@demo2.com', password: 'Demo123!@#', name: 'Family Member', role: 'viewer' }
    ]
  }
];

// Generate sample CGM data
function generateCGMData(hours = 24) {
  const data = [];
  const now = Date.now();
  const interval = 5 * 60 * 1000; // 5 minutes
  
  let lastSgv = 120;
  
  for (let i = 0; i < hours * 12; i++) {
    const time = now - (i * interval);
    
    // Add some realistic variation
    const change = (Math.random() - 0.5) * 20;
    lastSgv = Math.max(40, Math.min(400, lastSgv + change));
    
    // Determine direction
    let direction;
    if (change > 10) direction = 'DoubleUp';
    else if (change > 5) direction = 'SingleUp';
    else if (change > 2) direction = 'FortyFiveUp';
    else if (change < -10) direction = 'DoubleDown';
    else if (change < -5) direction = 'SingleDown';
    else if (change < -2) direction = 'FortyFiveDown';
    else direction = 'Flat';
    
    data.push({
      _id: new mongodb.ObjectID(),
      type: 'sgv',
      sgv: Math.round(lastSgv),
      date: time,
      dateString: new Date(time).toISOString(),
      direction: direction,
      device: 'Demo CGM',
      filtered: Math.round(lastSgv * 1000),
      unfiltered: Math.round(lastSgv * 1000),
      rssi: 100,
      noise: 1
    });
  }
  
  return data.reverse();
}

// Generate sample treatment data
function generateTreatments(hours = 24) {
  const treatments = [];
  const now = Date.now();
  
  // Add some meals
  const mealTimes = [8, 12, 18]; // breakfast, lunch, dinner
  for (let day = 0; day < Math.ceil(hours / 24); day++) {
    for (let mealTime of mealTimes) {
      const time = now - (day * 24 * 60 * 60 * 1000) - ((24 - mealTime) * 60 * 60 * 1000);
      treatments.push({
        _id: new mongodb.ObjectID(),
        eventType: 'Meal Bolus',
        created_at: new Date(time).toISOString(),
        carbs: 30 + Math.floor(Math.random() * 40),
        insulin: 2 + Math.floor(Math.random() * 6),
        notes: `${mealTime === 8 ? 'Breakfast' : mealTime === 12 ? 'Lunch' : 'Dinner'}`
      });
    }
  }
  
  // Add some corrections
  for (let i = 0; i < hours / 8; i++) {
    const time = now - (Math.random() * hours * 60 * 60 * 1000);
    treatments.push({
      _id: new mongodb.ObjectID(),
      eventType: 'Correction Bolus',
      created_at: new Date(time).toISOString(),
      insulin: 0.5 + Math.floor(Math.random() * 2),
      notes: 'Correction'
    });
  }
  
  return treatments;
}

async function main() {
  console.log('Multi-tenant Test Data Population Script');
  console.log('========================================');
  console.log(`Master DB: ${MASTER_DB_URI}`);
  console.log(`Base Domain: ${BASE_DOMAIN}`);
  console.log('');
  
  // Connect to master database
  const client = new MongoClient(MASTER_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  try {
    await client.connect();
    console.log('Connected to master database');
    
    const masterDb = client.db();
    const tenantsCollection = masterDb.collection('tenants');
    const usersCollection = masterDb.collection('users');
    
    // Create each test tenant
    for (const testTenant of TEST_TENANTS) {
      console.log(`\nCreating tenant: ${testTenant.name} (${testTenant.subdomain})`);
      
      // Check if tenant already exists
      const existingTenant = await tenantsCollection.findOne({ subdomain: testTenant.subdomain });
      if (existingTenant) {
        console.log(`  Tenant ${testTenant.subdomain} already exists, skipping...`);
        continue;
      }
      
      // Create tenant
      const tenantId = uuidv4();
      const tenant = {
        tenantId: tenantId,
        name: testTenant.name,
        subdomain: testTenant.subdomain,
        settings: {
          units: 'mg/dl',
          timeFormat: 24,
          theme: 'default',
          alarmTypes: ['simple'],
          enabledPlugins: ['careportal', 'iob', 'cob', 'bwp', 'cage', 'sage', 'iage', 'treatmentnotify']
        },
        features: {
          maxUsers: 10,
          dataRetentionDays: 90,
          realtimeData: true,
          reports: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await tenantsCollection.insertOne(tenant);
      console.log(`  Created tenant: ${tenantId}`);
      
      // Create admin user
      const adminPassword = await bcrypt.hash(testTenant.adminPassword, 10);
      const adminUser = {
        userId: uuidv4(),
        tenantId: tenantId,
        email: testTenant.adminEmail,
        password: adminPassword,
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await usersCollection.insertOne(adminUser);
      console.log(`  Created admin user: ${testTenant.adminEmail}`);
      
      // Create additional users
      for (const user of testTenant.users) {
        const userPassword = await bcrypt.hash(user.password, 10);
        const newUser = {
          userId: uuidv4(),
          tenantId: tenantId,
          email: user.email,
          password: userPassword,
          name: user.name,
          role: user.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await usersCollection.insertOne(newUser);
        console.log(`  Created ${user.role} user: ${user.email}`);
      }
      
      // Create tenant database and populate with sample data
      const tenantDbName = `nightscout_tenant_${testTenant.subdomain}`;
      console.log(`  Creating tenant database: ${tenantDbName}`);
      
      const tenantDb = client.db(tenantDbName);
      
      // Create collections
      const entriesCollection = tenantDb.collection('entries');
      const treatmentsCollection = tenantDb.collection('treatments');
      const devicestatusCollection = tenantDb.collection('devicestatus');
      const profileCollection = tenantDb.collection('profile');
      
      // Generate and insert CGM data
      const cgmData = generateCGMData(48); // 48 hours of data
      await entriesCollection.insertMany(cgmData);
      console.log(`  Inserted ${cgmData.length} CGM entries`);
      
      // Generate and insert treatments
      const treatments = generateTreatments(48);
      await treatmentsCollection.insertMany(treatments);
      console.log(`  Inserted ${treatments.length} treatments`);
      
      // Add a sample profile
      const profile = {
        _id: new mongodb.ObjectID(),
        defaultProfile: 'Default',
        store: {
          'Default': {
            dia: 4,
            carbratio: [{
              time: '00:00',
              value: 10
            }],
            carbs_hr: 20,
            delay: 20,
            sens: [{
              time: '00:00',
              value: 50
            }],
            timezone: 'UTC',
            basal: [{
              time: '00:00',
              value: 1.0
            }],
            target_low: [{
              time: '00:00',
              value: 80
            }],
            target_high: [{
              time: '00:00',
              value: 120
            }],
            units: 'mg/dl'
          }
        },
        startDate: new Date().toISOString(),
        mills: Date.now(),
        units: 'mg/dl',
        created_at: new Date().toISOString()
      };
      
      await profileCollection.insertOne(profile);
      console.log('  Inserted profile');
      
      // Add device status
      const deviceStatus = {
        _id: new mongodb.ObjectID(),
        device: 'Demo Pump',
        created_at: new Date().toISOString(),
        pump: {
          battery: {
            percent: 75
          },
          reservoir: 150,
          status: {
            status: 'normal',
            timestamp: new Date().toISOString()
          }
        }
      };
      
      await devicestatusCollection.insertOne(deviceStatus);
      console.log('  Inserted device status');
      
      // Create indexes
      await entriesCollection.createIndex({ date: -1 });
      await treatmentsCollection.createIndex({ created_at: -1 });
      await devicestatusCollection.createIndex({ created_at: -1 });
      console.log('  Created indexes');
    }
    
    console.log('\n✅ Test data population completed!');
    console.log('\nYou can now test with these credentials:');
    for (const tenant of TEST_TENANTS) {
      console.log(`\n${tenant.name}:`);
      console.log(`  URL: http://${tenant.subdomain}.${BASE_DOMAIN}`);
      console.log(`  Admin: ${tenant.adminEmail} / ${tenant.adminPassword}`);
      for (const user of tenant.users) {
        console.log(`  ${user.role}: ${user.email} / ${user.password}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
main().catch(console.error);