#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const https = require('https');

// API Secret
const API_SECRET = 'GodIsSoGood2Me23!';
const hashedSecret = crypto.createHash('sha1').update(API_SECRET).digest('hex');

// Helper function to make HTTPS requests
function makeRequest(options) {
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
    req.end();
  });
}

async function checkProfiles() {
  console.log('Using hashed API secret:', hashedSecret);
  
  // Check current profiles
  console.log('\nChecking existing profiles...');
  const profileOptions = {
    hostname: 'clinic2.diabeetech.net',
    path: '/api/v1/profile?count=10',
    method: 'GET',
    headers: {
      'api-secret': hashedSecret
    }
  };
  
  try {
    const profiles = await makeRequest(profileOptions);
    console.log('Existing profiles:', JSON.stringify(profiles, null, 2));
    
    if (profiles && profiles.length > 0) {
      console.log('\nProfile already exists! You can access the main page at:');
      console.log('https://clinic2.diabeetech.net/');
    } else {
      console.log('\nNo profiles found. Will attempt to create one.');
    }
  } catch (error) {
    console.error('Error checking profiles:', error);
  }
  
  // Also check the current profile endpoint
  console.log('\nChecking current profile...');
  const currentOptions = {
    hostname: 'clinic2.diabeetech.net',
    path: '/api/v1/profile/current',
    method: 'GET',
    headers: {
      'api-secret': hashedSecret
    }
  };
  
  try {
    const current = await makeRequest(currentOptions);
    console.log('Current profile:', JSON.stringify(current, null, 2));
  } catch (error) {
    console.error('Error checking current profile:', error);
  }
}

checkProfiles();