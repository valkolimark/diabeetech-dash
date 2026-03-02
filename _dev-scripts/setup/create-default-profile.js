#!/usr/bin/env node
'use strict';

/**
 * Create a default profile via API
 * This script creates a basic profile to get Nightscout running
 */

const https = require('https');

// Login credentials
const credentials = {
  email: 'admin@clinic2.diabeetech.com',
  password: '3kK3PkCtH$FUdrsm'
};

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
    // Step 1: Login to get JWT token
    console.log('Logging in...');
    const loginOptions = {
      hostname: 'clinic2.diabeetech.net',
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const loginResponse = await makeRequest(loginOptions, credentials);
    const token = loginResponse.accessToken || loginResponse.token;
    
    if (!token) {
      throw new Error('No token received from login');
    }
    
    console.log('Login successful, token received');
    
    // Step 2: Create the profile
    console.log('Creating default profile...');
    const profileOptions = {
      hostname: 'clinic2.diabeetech.net',
      path: '/api/v1/profile',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    };
    
    const profileResponse = await makeRequest(profileOptions, defaultProfile);
    console.log('Profile created successfully:', profileResponse);
    
    console.log('\nSuccess! You should now be able to access the main page at:');
    console.log('https://clinic2.diabeetech.net/');
    
  } catch (error) {
    console.error('Error:', error);
    if (error.body) {
      console.error('Response body:', error.body);
    }
    
    console.log('\nIf the profile already exists, try accessing the main page directly:');
    console.log('https://clinic2.diabeetech.net/');
  }
}

createProfile();