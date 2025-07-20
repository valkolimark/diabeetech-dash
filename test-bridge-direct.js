#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');
const engine = require('share2nightscout-bridge');

async function testBridgeDirect() {
  const tenantEmail = process.argv[2] || 'mark@markmireles.com';
  
  const masterUri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI || 'mongodb+srv://markt:xebkaW-kaqmu4-wynkor@nightscout-master.nkz27.mongodb.net/nightscout-master?retryWrites=true&w=majority&appName=nightscout-master';
  const masterClient = new MongoClient(masterUri);
  
  try {
    await masterClient.connect();
    console.log('Connected to master database');
    
    // Find tenant
    const masterDb = masterClient.db('nightscout-master');
    const user = await masterDb.collection('users').findOne({ email: tenantEmail });
    
    if (!user) {
      console.error('User not found:', tenantEmail);
      process.exit(1);
    }
    
    const tenant = await masterDb.collection('tenants').findOne({ tenantId: user.tenantId });
    console.log('Found tenant:', tenant.subdomain);
    
    // Get tenant settings
    const settings = await masterDb.collection('tenant_settings').findOne({ tenantId: tenant.tenantId });
    
    if (!settings || !settings.bridge) {
      console.error('No bridge settings found for tenant');
      process.exit(1);
    }
    
    // Decrypt password
    const crypto = require('crypto');
    const algorithm = 'aes-256-cbc';
    const secretKey = process.env.TENANT_SETTINGS_KEY || process.env.API_SECRET || 'default-key-change-me';
    const key = crypto.createHash('sha256').update(String(secretKey)).digest('base64').substr(0, 32);
    
    function decrypt(text) {
      try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
      } catch (err) {
        console.error('Failed to decrypt:', err);
        return null;
      }
    }
    
    const password = decrypt(settings.bridge.password);
    
    console.log('\nBridge settings:');
    console.log('  Username:', settings.bridge.userName);
    console.log('  Password:', password ? '[DECRYPTED]' : '[FAILED TO DECRYPT]');
    console.log('  Interval:', settings.bridge.interval);
    
    // Test Dexcom connection directly
    console.log('\nTesting Dexcom connection...');
    
    const opts = {
      login: {
        accountName: settings.bridge.userName,
        password: password
      },
      interval: 60000,
      fetch: {
        maxCount: 3,
        minutes: 60
      },
      nightscout: {},
      maxFailures: 3,
      firstFetchCount: 3
    };
    
    // Create callback to handle data
    opts.callback = function(err, glucose) {
      if (err) {
        console.error('Bridge error:', err);
        console.error('Error details:', err.message);
        if (err.stack) console.error(err.stack);
      } else {
        console.log('\nSuccess! Received', glucose ? glucose.length : 0, 'glucose entries');
        if (glucose && glucose.length > 0) {
          console.log('\nFirst entry:');
          console.log(JSON.stringify(glucose[0], null, 2));
          console.log('\nLast entry:');
          console.log(JSON.stringify(glucose[glucose.length - 1], null, 2));
        }
      }
      
      // Close connection and exit
      masterClient.close();
      process.exit(0);
    };
    
    // Run the bridge once
    console.log('\nRunning bridge fetch...');
    const bridgeInstance = engine(opts);
    
    // Give it some time to complete
    setTimeout(() => {
      console.log('\nTimeout reached, exiting...');
      masterClient.close();
      process.exit(1);
    }, 30000);
    
  } catch (err) {
    console.error('Error:', err);
    masterClient.close();
    process.exit(1);
  }
}

testBridgeDirect();