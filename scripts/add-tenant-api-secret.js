#!/usr/bin/env node
'use strict';

/**
 * Migration script to add API_SECRET to existing tenants
 * This is safe to run multiple times - it will only update tenants that don't have an API secret
 * 
 * Usage:
 *   node scripts/add-tenant-api-secret.js
 *   
 * To add API_SECRET to a specific tenant:
 *   node scripts/add-tenant-api-secret.js --subdomain=onepanman --secret="GodIsSoGood2Me23!"
 *   
 * To generate random secrets for all tenants without one:
 *   node scripts/add-tenant-api-secret.js --generate-random
 */

const crypto = require('crypto');

// Parse command line arguments
const args = process.argv.slice(2);
const argMap = {};
args.forEach(arg => {
  const [key, value] = arg.split('=');
  argMap[key.replace('--', '')] = value || true;
});

const subdomain = argMap.subdomain;
const apiSecret = argMap.secret;
const generateRandom = argMap['generate-random'];

console.log('Loading Nightscout environment...');
const env = require('../lib/server/env')();

console.log('Initializing boot environment...');
const fs = require('fs');
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

  console.log('Boot completed successfully');
  
  // Get tenant model
  const tenantModel = require('../lib/models/tenant')(env, ctx);
  
  async function updateTenant(tenant, newApiSecret) {
    try {
      console.log(`\nUpdating tenant: ${tenant.subdomain} (${tenant.tenantId})`);
      
      if (tenant.apiSecretHash) {
        console.log('  - Tenant already has an API secret, skipping...');
        return;
      }
      
      const success = await tenantModel.updateApiSecret(tenant.tenantId, newApiSecret);
      if (success) {
        const hash = tenantModel.hashApiSecret(newApiSecret);
        console.log('  ✓ API secret added successfully');
        console.log('  - Plain text: ' + newApiSecret);
        console.log('  - SHA-1 hash: ' + hash);
      } else {
        console.log('  ✗ Failed to update tenant');
      }
    } catch (err) {
      console.error(`  ✗ Error updating tenant ${tenant.subdomain}:`, err);
    }
  }
  
  async function run() {
    try {
      if (subdomain) {
        // Update specific tenant
        const tenant = await tenantModel.findBySubdomain(subdomain);
        if (!tenant) {
          console.error(`Tenant with subdomain '${subdomain}' not found`);
          process.exit(1);
        }
        
        if (!apiSecret) {
          console.error('--secret is required when updating a specific tenant');
          process.exit(1);
        }
        
        await updateTenant(tenant, apiSecret);
      } else {
        // Update all tenants
        console.log('Fetching all active tenants...');
        const tenants = await tenantModel.listActive(1000);
        console.log(`Found ${tenants.length} active tenants`);
        
        for (const tenant of tenants) {
          let tenantApiSecret;
          
          if (tenant.apiSecretHash) {
            console.log(`\nSkipping ${tenant.subdomain} - already has API secret`);
            continue;
          }
          
          if (generateRandom) {
            // Generate a random 32-character API secret
            tenantApiSecret = crypto.randomBytes(16).toString('hex');
          } else {
            // For onepanman specifically, use the known API secret
            if (tenant.subdomain === 'onepanman') {
              tenantApiSecret = 'GodIsSoGood2Me23!';
            } else {
              console.log(`\nSkipping ${tenant.subdomain} - no API secret provided`);
              continue;
            }
          }
          
          await updateTenant(tenant, tenantApiSecret);
        }
      }
      
      console.log('\nMigration completed!');
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  }
  
  run();
});