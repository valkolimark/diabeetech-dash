#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const https = require('https');

// API Secret
const API_SECRET = 'GodIsSoGood2Me23!';
const hashedSecret = crypto.createHash('sha1').update(API_SECRET).digest('hex');

console.log('Testing direct profile access with API Secret...\n');

// Helper function
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'clinic2.diabeetech.net',
      path: path,
      method: method,
      headers: {
        'api-secret': hashedSecret,
        'Content-Type': 'application/json'
      }
    };
    
    console.log(`${method} ${path}`);
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        if (body) {
          try {
            const parsed = JSON.parse(body);
            console.log('Response:', JSON.stringify(parsed, null, 2));
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            console.log('Response:', body);
            resolve({ status: res.statusCode, data: body });
          }
        } else {
          resolve({ status: res.statusCode, data: null });
        }
        console.log('---\n');
      });
    });
    
    req.on('error', (err) => {
      console.error('Request error:', err);
      reject(err);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  try {
    // Test 1: Status endpoint
    console.log('1. Testing status endpoint...');
    await makeRequest('/api/v1/status.json');
    
    // Test 2: Entries endpoint (to verify data access)
    console.log('2. Testing entries endpoint...');
    await makeRequest('/api/v1/entries.json?count=1');
    
    // Test 3: Try different profile endpoints
    console.log('3. Testing profile endpoints...');
    
    // Try the profile list endpoint
    await makeRequest('/api/v1/profile.json');
    await makeRequest('/api/v1/profiles');
    await makeRequest('/api/v1/profile/list');
    
    // Test 4: Try creating a minimal profile
    console.log('4. Attempting to create a minimal profile...');
    const minimalProfile = {
      "dia": 4,
      "carbratio": [{"time": "00:00", "value": 10}],
      "sens": [{"time": "00:00", "value": 50}],
      "basal": [{"time": "00:00", "value": 1.0}],
      "target_low": [{"time": "00:00", "value": 80}],
      "target_high": [{"time": "00:00", "value": 120}],
      "units": "mg/dl",
      "timezone": "UTC"
    };
    
    await makeRequest('/api/v1/profile', 'POST', minimalProfile);
    
    // Test 5: Try with a different structure
    console.log('5. Trying profile with store structure...');
    const profileWithStore = {
      "defaultProfile": "Default",
      "store": {
        "Default": minimalProfile
      },
      "startDate": new Date().toISOString(),
      "mills": Date.now()
    };
    
    await makeRequest('/api/v1/profile', 'POST', profileWithStore);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

runTests();