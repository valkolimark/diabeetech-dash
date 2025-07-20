#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function checkDexcomData() {
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
    if (!tenant) {
      console.error('Tenant not found for user');
      process.exit(1);
    }
    
    console.log('Found tenant:', tenant.subdomain);
    console.log('Tenant ID:', tenant.tenantId);
    
    // Connect to tenant database
    const tenantDbName = `nightscout-tenant-${tenant.tenantId}`;
    const tenantDb = masterClient.db(tenantDbName);
    
    // Check tenant settings for bridge configuration
    const settings = await masterDb.collection('tenant_settings').findOne({ tenantId: tenant.tenantId });
    console.log('\nBridge settings:');
    if (settings && settings.bridge) {
      console.log('  Enabled:', settings.bridge.enable);
      console.log('  Username:', settings.bridge.userName);
      console.log('  Interval:', settings.bridge.interval, 'ms');
      console.log('  Max failures:', settings.bridge.maxFailures);
    } else {
      console.log('  No bridge settings found');
    }
    
    // Check for entries (CGM data)
    const entriesCollection = tenantDb.collection('entries');
    const totalEntries = await entriesCollection.countDocuments();
    console.log('\nTotal entries in database:', totalEntries);
    
    // Get recent entries
    const recentEntries = await entriesCollection
      .find({})
      .sort({ dateString: -1 })
      .limit(5)
      .toArray();
    
    console.log('\nMost recent entries:');
    recentEntries.forEach(entry => {
      console.log('  -', new Date(entry.dateString).toLocaleString(), 
                  'SGV:', entry.sgv, 
                  'Direction:', entry.direction,
                  'Type:', entry.type);
    });
    
    // Check treatments
    const treatmentsCollection = tenantDb.collection('treatments');
    const totalTreatments = await treatmentsCollection.countDocuments();
    console.log('\nTotal treatments:', totalTreatments);
    
    // Check device status
    const devicestatusCollection = tenantDb.collection('devicestatus');
    const totalDeviceStatus = await devicestatusCollection.countDocuments();
    console.log('Total device status entries:', totalDeviceStatus);
    
    // Check for bridge-specific entries
    const bridgeEntries = await entriesCollection
      .find({ device: 'dexcom' })
      .sort({ dateString: -1 })
      .limit(5)
      .toArray();
    
    console.log('\nDexcom bridge entries:', bridgeEntries.length);
    if (bridgeEntries.length > 0) {
      console.log('Most recent Dexcom entry:', new Date(bridgeEntries[0].dateString).toLocaleString());
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await masterClient.close();
  }
}

checkDexcomData();