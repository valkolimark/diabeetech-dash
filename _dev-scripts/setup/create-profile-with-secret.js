#!/usr/bin/env node
'use strict';

/**
 * Create a default profile using API_SECRET
 */

const crypto = require('crypto');
const https = require('https');

// API Secret
const API_SECRET = 'GodIsSoGood2Me23!';

// Hash the API secret using SHA-1 (Nightscout standard)
const hashedSecret = crypto.createHash('sha1').update(API_SECRET).digest('hex');
console.log('Hashed API Secret:', hashedSecret);

// Default profile data
const defaultProfile = {
  "_id": "defaultProfile",
  "defaultProfile": "Default",
  "startDate": new Date().toISOString(),
  "mills": Date.now(),
  "units": "mg/dl",
  "dia": 4,
  "timezone": "America/Chicago",
  "basal": [{"time": "00:00", "value": 1.0}],
  "carbratio": [{"time": "00:00", "value": 10}],
  "sens": [{"time": "00:00", "value": 50}],
  "target_low": [{"time": "00:00", "value": 80}],
  "target_high": [{"time": "00:00", "value": 120}],
  "carbs_hr": 20,
  "delay": 20
};

// Helper function to make HTTPS requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject({
            statusCode: res.statusCode,
            body: body
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function createProfile() {
  try {
    // First, let's test the API secret by getting status
    console.log('\nTesting API secret with status endpoint...');
    const statusOptions = {
      hostname: 'clinic2.diabeetech.net',
      path: '/api/v1/status.json',
      method: 'GET',
      headers: {
        'api-secret': hashedSecret
      }
    };
    
    try {
      const statusResponse = await makeRequest(statusOptions);
      console.log('Status check successful:', statusResponse.name);
    } catch (error) {
      console.log('Status check failed:', error);
    }
    
    // Now try to create the profile
    console.log('\nCreating default profile...');
    const profileOptions = {
      hostname: 'clinic2.diabeetech.net',
      path: '/api/v1/profile',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-secret': hashedSecret
      }
    };
    
    const profileResponse = await makeRequest(profileOptions, defaultProfile);
    console.log('Profile created successfully!');
    console.log('Response:', profileResponse);
    
    console.log('\nSuccess! You should now be able to access the main page at:');
    console.log('https://clinic2.diabeetech.net/');
    console.log('\nThe hashed API secret has been saved. You can also use it in the browser.');
    console.log('Store this in localStorage: apisecrethash=' + hashedSecret);
    
  } catch (error) {
    console.error('\nError:', error);
    if (error.body) {
      console.error('Response body:', error.body);
    }
    
    // If profile already exists, that's OK
    if (error.body && error.body.includes('duplicate')) {
      console.log('\nProfile may already exist. Try accessing the main page:');
      console.log('https://clinic2.diabeetech.net/');
    }
  }
}

// Also create a simple test to verify the secret works
async function testSecret() {
  console.log('Testing API_SECRET: ' + API_SECRET);
  console.log('SHA-1 Hash: ' + hashedSecret);
  
  // Test with verifyauth endpoint
  console.log('\nTesting authentication...');
  const authOptions = {
    hostname: 'clinic2.diabeetech.net', 
    path: '/api/v1/verifyauth',
    method: 'GET',
    headers: {
      'api-secret': hashedSecret
    }
  };
  
  try {
    const authResponse = await makeRequest(authOptions);
    console.log('Auth test response:', authResponse);
  } catch (error) {
    console.log('Auth test failed:', error);
  }
}

// Run the test first, then create profile
testSecret().then(() => createProfile());