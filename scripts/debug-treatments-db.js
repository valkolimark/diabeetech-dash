#!/usr/bin/env node
'use strict';

/**
 * Script to debug treatments database collection for tenants
 * Checks database connectivity and collection setup
 * 
 * Usage:
 *   node scripts/debug-treatments-db.js --subdomain=onepanman
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const argMap = {};
args.forEach(arg => {
  const [key, value] = arg.split('=');
  argMap[key.replace('--', '')] = value || true;
});

const subdomain = argMap.subdomain || 'onepanman';

console.log('Loading Nightscout environment...');
const env = require('../lib/server/env')();

console.log('Initializing boot environment...');
const language = require('../lib/language')(fs);
const ctx = {
  store: null,
  bootErrors: []
};

const boot = require('../lib/server/bootevent-multitenant')(env, language);

// Boot sequence
boot.boot(ctx, function booted() {
  if (ctx.bootErrors && ctx.bootErrors.length > 0) {
    console.error('Boot errors:', ctx.bootErrors);
    process.exit(1);
  }

  console.log('Boot completed successfully\n');
  
  // Get tenant model and connection manager
  const tenantModel = require('../lib/models/tenant')(env, ctx);
  const connectionManager = require('../lib/utils/connectionManager')(env);
  
  async function debugTreatments() {
    try {
      console.log('='.repeat(80));
      console.log('TREATMENTS DATABASE DEBUG');
      console.log('='.repeat(80));
      
      // Find tenant
      console.log(`\n1. Finding tenant: ${subdomain}`);
      const tenant = await tenantModel.findBySubdomain(subdomain);
      
      if (!tenant) {
        console.error(`✗ Tenant '${subdomain}' not found`);
        process.exit(1);
      }
      
      console.log('✓ Tenant found:');
      console.log(`  - Name: ${tenant.tenantName}`);
      console.log(`  - ID: ${tenant.tenantId}`);
      console.log(`  - Subdomain: ${tenant.subdomain}`);
      console.log(`  - Database: ${tenant.dbName}`);
      console.log(`  - API Secret: ${tenant.apiSecret ? 'SET' : 'NOT SET'}`);
      
      // Get tenant database connection
      console.log('\n2. Getting tenant database connection...');
      const tenantDb = await connectionManager.getTenantDb(tenant);
      console.log('✓ Database connection established');
      
      // Check treatments collection
      const collectionName = env.treatments_collection || 'treatments';
      console.log(`\n3. Checking treatments collection: ${collectionName}`);
      
      // List all collections
      const collections = await tenantDb.listCollections().toArray();
      console.log('\nAvailable collections:');
      collections.forEach(col => {
        console.log(`  - ${col.name}`);
      });
      
      // Get treatments collection
      const treatmentsCol = tenantDb.collection(collectionName);
      
      // Count documents
      const count = await treatmentsCol.countDocuments();
      console.log(`\n4. Treatments count: ${count}`);
      
      // Test insertion
      console.log('\n5. Testing treatment insertion...');
      const testTreatment = {
        eventType: 'Debug Test',
        created_at: new Date().toISOString(),
        notes: 'Debug test treatment',
        enteredBy: 'Debug Script'
      };
      
      try {
        const result = await treatmentsCol.insertOne(testTreatment);
        console.log('✓ Test insertion successful');
        console.log(`  - Inserted ID: ${result.insertedId}`);
        
        // Remove test document
        await treatmentsCol.deleteOne({ _id: result.insertedId });
        console.log('✓ Test document removed');
      } catch (err) {
        console.error('✗ Insertion failed:', err.message);
      }
      
      // Create tenant context for treatments module
      console.log('\n6. Testing treatments module...');
      const tenantCtx = {
        store: {
          db: tenantDb,
          collection: function(name) {
            return tenantDb.collection(name);
          }
        },
        bus: ctx.bus,
        ddata: ctx.ddata
      };
      
      // Initialize treatments module
      const treatments = require('../lib/server/treatments')(env, tenantCtx);
      
      // Test list function
      console.log('\n7. Testing treatments.list()...');
      treatments.list({ count: 5 }, function(err, results) {
        if (err) {
          console.error('✗ List failed:', err);
        } else {
          console.log('✓ List successful');
          console.log(`  - Found ${results.length} treatments`);
        }
        
        // Test create function
        console.log('\n8. Testing treatments.create()...');
        const newTreatment = {
          eventType: 'Carb Correction',
          carbs: 20,
          created_at: new Date().toISOString(),
          notes: 'Debug test via treatments module',
          enteredBy: 'Debug Script'
        };
        
        treatments.create(newTreatment, function(err, created) {
          if (err) {
            console.error('✗ Create failed:', err);
            console.error('Error details:', JSON.stringify(err, null, 2));
          } else {
            console.log('✓ Create successful');
            console.log('Created treatment:', JSON.stringify(created, null, 2));
            
            // Clean up
            if (created && created[0] && created[0]._id) {
              treatments.remove({ find: { _id: created[0]._id } }, function(err) {
                if (!err) {
                  console.log('✓ Test treatment removed');
                }
                process.exit(0);
              });
            } else {
              process.exit(0);
            }
          }
        });
      });
      
    } catch (err) {
      console.error('\nError:', err);
      console.error('Stack:', err.stack);
      process.exit(1);
    }
  }
  
  debugTreatments();
});