#!/usr/bin/env node
'use strict';

/**
 * Script to directly insert treatments into tenant database
 * Bypasses API to test database connectivity
 * 
 * Usage:
 *   node scripts/insert-treatments-direct.js --subdomain=onepanman
 *   node scripts/insert-treatments-direct.js --subdomain=onepanman --clean
 */

const { MongoClient } = require('mongodb');
const moment = require('moment');
const crypto = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);
const argMap = {};
args.forEach(arg => {
  const [key, value] = arg.split('=');
  argMap[key.replace('--', '')] = value || true;
});

const subdomain = argMap.subdomain || 'onepanman';
const cleanOnly = argMap.clean === true;

// Load environment
const env = require('../lib/server/env')();

// MongoDB connection URL
const mongoUrl = env.MONGODB_URI || 'mongodb://localhost:27017/nightscout';

console.log('Connecting to MongoDB...');
console.log('Target subdomain:', subdomain);

// Sample treatments to insert
const sampleTreatments = [
  {
    eventType: 'Carb Correction',
    carbs: 15,
    notes: 'Morning snack - apple',
    created_at: moment().subtract(4, 'hours').toISOString(),
    enteredBy: 'Direct Insert Script',
    utcOffset: 0
  },
  {
    eventType: 'Meal Bolus',
    carbs: 45,
    insulin: 4.5,
    notes: 'Lunch - sandwich and salad',
    created_at: moment().subtract(3, 'hours').toISOString(),
    enteredBy: 'Direct Insert Script',
    utcOffset: 0
  },
  {
    eventType: 'Correction Bolus',
    insulin: 1.0,
    glucose: 185,
    glucoseType: 'Finger',
    units: 'mg/dl',
    notes: 'High BG correction',
    created_at: moment().subtract(2, 'hours').toISOString(),
    enteredBy: 'Direct Insert Script',
    utcOffset: 0
  },
  {
    eventType: 'Exercise',
    duration: 30,
    notes: '30 minute walk',
    created_at: moment().subtract(1.5, 'hours').toISOString(),
    enteredBy: 'Direct Insert Script',
    utcOffset: 0
  },
  {
    eventType: 'Carb Correction',
    carbs: 20,
    notes: 'Post-exercise snack',
    created_at: moment().subtract(1, 'hours').toISOString(),
    enteredBy: 'Direct Insert Script',
    utcOffset: 0
  },
  {
    eventType: 'Note',
    notes: 'Feeling good after exercise',
    created_at: moment().subtract(45, 'minutes').toISOString(),
    enteredBy: 'Direct Insert Script',
    utcOffset: 0
  },
  {
    eventType: 'Temp Basal',
    percent: -20,
    duration: 60,
    notes: 'Reduced basal for upcoming activity',
    created_at: moment().subtract(30, 'minutes').toISOString(),
    enteredBy: 'Direct Insert Script',
    utcOffset: 0
  },
  {
    eventType: 'Site Change',
    notes: 'Changed infusion site - left abdomen',
    created_at: moment().subtract(15, 'minutes').toISOString(),
    enteredBy: 'Direct Insert Script',
    utcOffset: 0
  }
];

async function run() {
  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('✓ Connected to MongoDB');
    
    // Get master database
    const masterDb = client.db();
    
    // Find tenant
    const tenantsCollection = masterDb.collection('tenants');
    const tenant = await tenantsCollection.findOne({ subdomain: subdomain });
    
    if (!tenant) {
      console.error(`✗ Tenant '${subdomain}' not found`);
      process.exit(1);
    }
    
    console.log('✓ Found tenant:', tenant.tenantName);
    console.log('  Database:', tenant.dbName);
    
    // Connect to tenant database
    const tenantDb = client.db(tenant.dbName);
    const treatmentsCollection = tenantDb.collection('treatments');
    
    if (cleanOnly) {
      // Clean up mode - remove test data
      console.log('\nCleaning up test treatments...');
      const result = await treatmentsCollection.deleteMany({
        enteredBy: 'Direct Insert Script'
      });
      console.log(`✓ Removed ${result.deletedCount} test treatments`);
    } else {
      // First, show current count
      const currentCount = await treatmentsCollection.countDocuments();
      console.log(`\nCurrent treatments count: ${currentCount}`);
      
      // Clean up old test data first
      const cleanResult = await treatmentsCollection.deleteMany({
        enteredBy: 'Direct Insert Script'
      });
      if (cleanResult.deletedCount > 0) {
        console.log(`✓ Cleaned up ${cleanResult.deletedCount} old test treatments`);
      }
      
      // Insert sample treatments
      console.log(`\nInserting ${sampleTreatments.length} sample treatments...`);
      
      const result = await treatmentsCollection.insertMany(sampleTreatments);
      console.log(`✓ Inserted ${result.insertedCount} treatments`);
      
      // Verify insertion
      const newCount = await treatmentsCollection.countDocuments();
      console.log(`\nNew treatments count: ${newCount}`);
      
      // Show sample of inserted data
      console.log('\nSample of inserted treatments:');
      const samples = await treatmentsCollection
        .find({ enteredBy: 'Direct Insert Script' })
        .sort({ created_at: -1 })
        .limit(3)
        .toArray();
      
      samples.forEach(treatment => {
        console.log(`  - ${treatment.eventType}: ${treatment.notes} (${moment(treatment.created_at).fromNow()})`);
      });
      
      // Test API access
      console.log('\n' + '='.repeat(60));
      console.log('Testing API access to verify treatments are readable...');
      console.log('='.repeat(60));
      
      const https = require('https');
      const apiSecretHash = crypto.createHash('sha1').update(tenant.apiSecret || 'GodIsSoGood2Me23!').digest('hex');
      const url = `https://${subdomain}.diabeetech.net/api/v1/treatments?count=5`;
      
      https.get(url, {
        headers: {
          'api-secret': apiSecretHash,
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const treatments = JSON.parse(data);
            console.log(`\n✓ API returned ${treatments.length} treatments`);
            if (treatments.length > 0) {
              console.log('\nFirst treatment from API:');
              console.log(JSON.stringify(treatments[0], null, 2));
            }
          } catch (e) {
            console.error('✗ Failed to parse API response:', data);
          }
          
          console.log('\n' + '='.repeat(60));
          console.log('Direct insertion completed successfully!');
          console.log('Treatments are now available via the API.');
          console.log('='.repeat(60));
          
          process.exit(0);
        });
      }).on('error', (err) => {
        console.error('✗ API test failed:', err.message);
        process.exit(1);
      });
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    if (client && cleanOnly) {
      await client.close();
      process.exit(0);
    }
  }
}

run();