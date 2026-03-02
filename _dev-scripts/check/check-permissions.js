#!/usr/bin/env node
'use strict';

/**
 * Check user permissions and attempt to create a profile
 */

const https = require('https');

// Login credentials
const credentials = {
  email: 'admin@clinic2.diabeetech.com',
  password: '3kK3PkCtH$FUdrsm'
};

// Helper function to make HTTPS requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}`);
        console.log(`Response headers:`, res.headers);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject({
            statusCode: res.statusCode,
            headers: res.headers,
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

async function checkPermissions() {
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
    
    console.log('Login successful');
    console.log('User info:', {
      email: loginResponse.user?.email,
      role: loginResponse.user?.role,
      permissions: loginResponse.user?.permissions
    });
    
    // Step 2: Try to verify auth
    console.log('\nVerifying authentication...');
    const verifyOptions = {
      hostname: 'clinic2.diabeetech.net',
      path: '/api/v1/verifyauth',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    };
    
    try {
      const verifyResponse = await makeRequest(verifyOptions);
      console.log('Auth verification response:', verifyResponse);
    } catch (error) {
      console.log('Auth verification failed:', error);
    }
    
    // Step 3: Try to get current profile
    console.log('\nGetting current profile...');
    const profileOptions = {
      hostname: 'clinic2.diabeetech.net',
      path: '/api/v1/profile/current',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    };
    
    try {
      const profileResponse = await makeRequest(profileOptions);
      console.log('Current profile:', profileResponse);
    } catch (error) {
      console.log('Failed to get current profile:', error.statusCode, error.body);
    }
    
    // Step 4: Check if we need API_SECRET
    console.log('\nChecking if API_SECRET is needed...');
    console.log('The application might be configured to require API_SECRET for profile creation.');
    console.log('You may need to:');
    console.log('1. Add api:profile:create permission to the user');
    console.log('2. Or use API_SECRET in the request headers');
    console.log('3. Or modify the server configuration to allow profile creation for authenticated users');
    
  } catch (error) {
    console.error('Error:', error);
    if (error.body) {
      console.error('Response body:', error.body);
    }
  }
}

checkPermissions();