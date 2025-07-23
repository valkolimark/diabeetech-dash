#!/usr/bin/env node
'use strict';

/**
 * Script to display API_SECRETs for all tenants
 * Useful after running migration to see what was generated
 * 
 * Usage:
 *   node scripts/display-tenant-api-secrets.js
 *   node scripts/display-tenant-api-secrets.js --subdomain=onepanman
 *   node scripts/display-tenant-api-secrets.js --format=csv
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

const filterSubdomain = argMap.subdomain;
const format = argMap.format || 'table';

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
  
  // Get tenant model
  const tenantModel = require('../lib/models/tenant')(env, ctx);
  
  async function displayTenants() {
    try {
      let tenants;
      
      if (filterSubdomain) {
        const tenant = await tenantModel.findBySubdomain(filterSubdomain);
        if (!tenant) {
          console.error(`Tenant with subdomain '${filterSubdomain}' not found`);
          process.exit(1);
        }
        tenants = [tenant];
      } else {
        tenants = await tenantModel.listActive(1000);
      }
      
      console.log(`Found ${tenants.length} tenant(s)\n`);
      
      if (format === 'csv') {
        // CSV format for easy import
        console.log('subdomain,tenantId,apiSecret,apiSecretHash,url');
        tenants.forEach(tenant => {
          const url = `https://${tenant.subdomain}.${env.BASE_DOMAIN || 'diabeetech.net'}`;
          console.log(`${tenant.subdomain},${tenant.tenantId},${tenant.apiSecret || 'NOT_SET'},${tenant.apiSecretHash || 'NOT_SET'},${url}`);
        });
      } else if (format === 'json') {
        // JSON format
        const output = tenants.map(tenant => ({
          subdomain: tenant.subdomain,
          tenantId: tenant.tenantId,
          apiSecret: tenant.apiSecret || 'NOT_SET',
          apiSecretHash: tenant.apiSecretHash || 'NOT_SET',
          url: `https://${tenant.subdomain}.${env.BASE_DOMAIN || 'diabeetech.net'}`
        }));
        console.log(JSON.stringify(output, null, 2));
      } else {
        // Table format (default)
        console.log('='.repeat(120));
        console.log('TENANT API SECRETS');
        console.log('='.repeat(120));
        
        tenants.forEach(tenant => {
          console.log(`\nTenant: ${tenant.tenantName}`);
          console.log(`Subdomain: ${tenant.subdomain}`);
          console.log(`URL: https://${tenant.subdomain}.${env.BASE_DOMAIN || 'diabeetech.net'}`);
          console.log(`Tenant ID: ${tenant.tenantId}`);
          
          if (tenant.apiSecret && tenant.apiSecretHash) {
            console.log(`API Secret (plain): ${tenant.apiSecret}`);
            console.log(`API Secret (SHA-1): ${tenant.apiSecretHash}`);
            console.log('\nAuthentication examples:');
            console.log(`  Header: -H "api-secret: ${tenant.apiSecret}"`);
            console.log(`  Header: -H "api-secret: ${tenant.apiSecretHash}"`);
            console.log(`  Query:  ?secret=${tenant.apiSecret}`);
            console.log(`  Query:  ?secret=${tenant.apiSecretHash}`);
          } else {
            console.log('API Secret: NOT CONFIGURED');
            console.log('Run migration script to generate: node scripts/add-tenant-api-secret.js');
          }
          console.log('-'.repeat(120));
        });
      }
      
      // Summary
      if (!filterSubdomain) {
        const configured = tenants.filter(t => t.apiSecretHash).length;
        const notConfigured = tenants.length - configured;
        
        console.log('\nSummary:');
        console.log(`Total tenants: ${tenants.length}`);
        console.log(`With API_SECRET: ${configured}`);
        console.log(`Without API_SECRET: ${notConfigured}`);
        
        if (notConfigured > 0) {
          console.log('\nTo generate API_SECRETs for remaining tenants:');
          console.log('  node scripts/add-tenant-api-secret.js --generate-random');
        }
      }
      
      process.exit(0);
    } catch (err) {
      console.error('Error:', err);
      process.exit(1);
    }
  }
  
  displayTenants();
});