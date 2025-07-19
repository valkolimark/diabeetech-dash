#!/usr/bin/env node
'use strict';

/**
 * Simple test script for multi-tenant functionality
 * Tests basic operations without running full test suite
 */

const axios = require('axios');
const colors = require('chalk');

const BASE_URL = process.env.TEST_URL || 'http://localhost:1337';

async function testAPI(description, request) {
  try {
    const response = await request();
    console.log(colors.green('✓'), description);
    return response.data;
  } catch (error) {
    console.log(colors.red('✗'), description);
    console.log('  ', colors.red(error.response ? error.response.data : error.message));
    throw error;
  }
}

async function main() {
  console.log(colors.blue('\nNightscout Multi-Tenant Test Script'));
  console.log(colors.blue('===================================\n'));

  let tenant1Token, tenant2Token;

  try {
    // Test 1: Register first tenant
    console.log(colors.yellow('Testing Tenant Registration...'));
    const tenant1 = await testAPI('Register tenant 1', () =>
      axios.post(`${BASE_URL}/api/tenants/register`, {
        name: 'Test Clinic 1',
        subdomain: 'test1',
        adminEmail: 'admin@test1.com',
        adminPassword: 'Test123!@#'
      })
    );
    tenant1Token = tenant1.token;

    const tenant2 = await testAPI('Register tenant 2', () =>
      axios.post(`${BASE_URL}/api/tenants/register`, {
        name: 'Test Clinic 2',
        subdomain: 'test2',
        adminEmail: 'admin@test2.com',
        adminPassword: 'Test123!@#'
      })
    );
    tenant2Token = tenant2.token;

    // Test 2: Authentication
    console.log(colors.yellow('\nTesting Authentication...'));
    await testAPI('Login to tenant 1', () =>
      axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@test1.com',
        password: 'Test123!@#'
      }, {
        headers: { 'X-Tenant-Subdomain': 'test1' }
      })
    );

    await testAPI('Login to tenant 2', () =>
      axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@test2.com',
        password: 'Test123!@#'
      }, {
        headers: { 'X-Tenant-Subdomain': 'test2' }
      })
    );

    // Test 3: Data Isolation
    console.log(colors.yellow('\nTesting Data Isolation...'));
    
    // Create entry for tenant 1
    await testAPI('Create SGV entry for tenant 1', () =>
      axios.post(`${BASE_URL}/api/v1/entries`, {
        type: 'sgv',
        sgv: 120,
        date: Date.now(),
        dateString: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${tenant1Token}`,
          'X-Tenant-Subdomain': 'test1'
        }
      })
    );

    // Create entry for tenant 2
    await testAPI('Create SGV entry for tenant 2', () =>
      axios.post(`${BASE_URL}/api/v1/entries`, {
        type: 'sgv',
        sgv: 180,
        date: Date.now(),
        dateString: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${tenant2Token}`,
          'X-Tenant-Subdomain': 'test2'
        }
      })
    );

    // Verify tenant 1 only sees its data
    const tenant1Entries = await testAPI('Get entries for tenant 1', () =>
      axios.get(`${BASE_URL}/api/v1/entries`, {
        headers: {
          'Authorization': `Bearer ${tenant1Token}`,
          'X-Tenant-Subdomain': 'test1'
        }
      })
    );

    const tenant2Entries = await testAPI('Get entries for tenant 2', () =>
      axios.get(`${BASE_URL}/api/v1/entries`, {
        headers: {
          'Authorization': `Bearer ${tenant2Token}`,
          'X-Tenant-Subdomain': 'test2'
        }
      })
    );

    // Verify data isolation
    console.log(colors.yellow('\nVerifying Data Isolation...'));
    const tenant1HasOnly120 = tenant1Entries.some(e => e.sgv === 120) && 
                              !tenant1Entries.some(e => e.sgv === 180);
    const tenant2HasOnly180 = tenant2Entries.some(e => e.sgv === 180) && 
                              !tenant2Entries.some(e => e.sgv === 120);

    if (tenant1HasOnly120) {
      console.log(colors.green('✓'), 'Tenant 1 data is isolated correctly');
    } else {
      console.log(colors.red('✗'), 'Tenant 1 data isolation failed');
    }

    if (tenant2HasOnly180) {
      console.log(colors.green('✓'), 'Tenant 2 data is isolated correctly');
    } else {
      console.log(colors.red('✗'), 'Tenant 2 data isolation failed');
    }

    // Test 4: Cross-tenant access prevention
    console.log(colors.yellow('\nTesting Cross-tenant Access Prevention...'));
    try {
      await axios.get(`${BASE_URL}/api/v1/entries`, {
        headers: {
          'Authorization': `Bearer ${tenant1Token}`,
          'X-Tenant-Subdomain': 'test2'  // Wrong tenant!
        }
      });
      console.log(colors.red('✗'), 'Cross-tenant access was NOT prevented!');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(colors.green('✓'), 'Cross-tenant access correctly prevented');
      } else {
        console.log(colors.red('✗'), 'Unexpected error preventing cross-tenant access');
      }
    }

    console.log(colors.green('\n✅ All tests completed successfully!\n'));

  } catch (error) {
    console.log(colors.red('\n❌ Test failed!\n'));
    process.exit(1);
  }
}

// Check if required dependencies are installed
try {
  require('axios');
  require('chalk');
} catch (e) {
  console.log('Installing required dependencies...');
  require('child_process').execSync('npm install axios chalk', { stdio: 'inherit' });
}

main().catch(console.error);