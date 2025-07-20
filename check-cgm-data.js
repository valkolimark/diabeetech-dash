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

async function checkCGMData() {
  console.log('Checking for CGM/glucose data...\n');
  
  // Check for entries (glucose data)
  console.log('1. Checking recent entries/SGV data...');
  const entriesOptions = {
    hostname: 'clinic2.diabeetech.net',
    path: '/api/v1/entries.json?count=10',
    method: 'GET',
    headers: {
      'api-secret': hashedSecret
    }
  };
  
  try {
    const entries = await makeRequest(entriesOptions);
    console.log('Found', entries.length, 'entries');
    if (entries.length > 0) {
      console.log('\nMost recent entry:');
      const recent = entries[0];
      console.log('- Date:', new Date(recent.date || recent.dateString));
      console.log('- SGV:', recent.sgv, 'mg/dL');
      console.log('- Direction:', recent.direction);
      console.log('- Device:', recent.device);
      console.log('- Type:', recent.type);
      
      console.log('\nEntry age:', Math.round((Date.now() - (recent.date || new Date(recent.dateString).getTime())) / 60000), 'minutes ago');
    }
  } catch (error) {
    console.error('Error checking entries:', error);
  }
  
  // Check device status
  console.log('\n2. Checking device status...');
  const deviceOptions = {
    hostname: 'clinic2.diabeetech.net',
    path: '/api/v1/devicestatus.json?count=5',
    method: 'GET',
    headers: {
      'api-secret': hashedSecret
    }
  };
  
  try {
    const devices = await makeRequest(deviceOptions);
    console.log('Found', devices.length, 'device status records');
    if (devices.length > 0) {
      console.log('\nMost recent device status:');
      const recent = devices[0];
      console.log('- Created:', new Date(recent.created_at));
      console.log('- Device:', recent.device);
      if (recent.uploader) {
        console.log('- Uploader battery:', recent.uploader.battery);
      }
    }
  } catch (error) {
    console.error('Error checking device status:', error);
  }
  
  // Check treatments
  console.log('\n3. Checking treatments...');
  const treatmentOptions = {
    hostname: 'clinic2.diabeetech.net',
    path: '/api/v1/treatments.json?count=5',
    method: 'GET',
    headers: {
      'api-secret': hashedSecret
    }
  };
  
  try {
    const treatments = await makeRequest(treatmentOptions);
    console.log('Found', treatments.length, 'treatments');
    if (treatments.length > 0) {
      console.log('Most recent treatment:', treatments[0].eventType, 'at', new Date(treatments[0].created_at));
    }
  } catch (error) {
    console.error('Error checking treatments:', error);
  }
  
  // Check if bridge is enabled
  console.log('\n4. Checking server configuration...');
  const statusOptions = {
    hostname: 'clinic2.diabeetech.net',
    path: '/api/v1/status.json',
    method: 'GET',
    headers: {
      'api-secret': hashedSecret
    }
  };
  
  try {
    const status = await makeRequest(statusOptions);
    console.log('\nEnabled features:', status.settings.enable);
    console.log('\nExtended settings keys:', Object.keys(status.extendedSettings));
    
    if (status.extendedSettings.bridge) {
      console.log('\nDexcom Bridge settings found:');
      console.log('- Enabled:', !!status.extendedSettings.bridge.userName);
      console.log('- Interval:', status.extendedSettings.bridge.interval);
      console.log('- Minutes:', status.extendedSettings.bridge.minutes);
    } else {
      console.log('\nNo Dexcom Bridge configuration found');
    }
    
    if (status.extendedSettings.mmconnect) {
      console.log('\nMiniMed Connect settings found:');
      console.log('- Enabled:', !!status.extendedSettings.mmconnect.userName);
    } else {
      console.log('\nNo MiniMed Connect configuration found');
    }
  } catch (error) {
    console.error('Error checking status:', error);
  }
}

checkCGMData();