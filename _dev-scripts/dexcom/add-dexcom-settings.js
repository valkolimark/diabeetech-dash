#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// Encryption functions
const algorithm = 'aes-256-cbc';
const secretKey = process.env.TENANT_SETTINGS_KEY || process.env.API_SECRET || 'default-key-change-me';
const key = crypto.createHash('sha256').update(String(secretKey)).digest('base64').substr(0, 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function addDexcomSettings() {
  const tenantEmail = process.argv[2];
  const dexcomUsername = process.argv[3];
  const dexcomPassword = process.argv[4];
  
  if (!tenantEmail || !dexcomUsername || !dexcomPassword) {
    console.error('Usage: node add-dexcom-settings.js <tenant-email> <dexcom-username> <dexcom-password>');
    process.exit(1);
  }
  
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
    if (!tenant) {
      console.error('Tenant not found for user');
      process.exit(1);
    }
    
    console.log('Found tenant:', tenant.subdomain);
    
    // Create or update tenant settings
    const settingsCollection = masterDb.collection('tenant_settings');
    
    const bridgeSettings = {
      enable: true,
      userName: dexcomUsername,
      password: encrypt(dexcomPassword),
      interval: 150000,  // 2.5 minutes
      minutes: 1440,
      maxCount: 1,
      maxFailures: 3,
      firstFetchCount: 3
    };
    
    const result = await settingsCollection.updateOne(
      { tenantId: tenant.tenantId },
      { 
        $set: { 
          tenantId: tenant.tenantId,
          bridge: bridgeSettings,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log('Bridge settings saved:', result.upsertedCount > 0 ? 'Created new' : 'Updated existing');
    console.log('Bridge configuration:');
    console.log('  Username:', dexcomUsername);
    console.log('  Interval:', bridgeSettings.interval, 'ms');
    console.log('  Enabled:', bridgeSettings.enable);
    
    // Also need to restart the bridge on Heroku - output instructions
    console.log('\nNOTE: You need to restart the Heroku app for the bridge to pick up these settings:');
    console.log('  heroku restart');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await masterClient.close();
  }
}

addDexcomSettings();