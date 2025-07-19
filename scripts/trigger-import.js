#!/usr/bin/env node
'use strict';

/**
 * Trigger data import via API
 * Usage: node trigger-import.js
 */

const axios = require('axios');

async function triggerImport() {
  try {
    // First, login to get token
    console.log('Logging in...');
    const loginResponse = await axios.post('https://clinic2.diabeetech.net/api/auth/login', {
      email: 'admin@clinic2.com',
      password: 'SecureAdminPass456!'  // Use the password you created for this user
    });
    
    const token = loginResponse.data.accessToken;
    console.log('Login successful');
    
    // Trigger import
    console.log('Starting import...');
    const importResponse = await axios.post(
      'https://clinic2.diabeetech.net/api/import/import',
      {
        sourceUri: 'mongodb+srv://arigold:yvJp2VbaeoShpSX3@nightscoutcluster.nkz27.mongodb.net/?retryWrites=true&w=majority&appName=ari-cluster',
        days: 30,
        collections: ['entries', 'treatments', 'devicestatus', 'profile', 'food']
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Import completed:', importResponse.data);
    
  } catch (error) {
    console.error('Import failed:', error.response?.data || error.message);
  }
}

triggerImport();