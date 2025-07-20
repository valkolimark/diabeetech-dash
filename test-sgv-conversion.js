#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function testSGVConversion() {
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
    
    // Load entries as the websocket would
    const entries = await tenantDb.collection('entries')
      .find({})
      .sort({ date: -1 })
      .limit(10)
      .toArray();
    
    console.log('\nOriginal entries:', entries.length);
    if (entries.length > 0) {
      console.log('\nFirst entry (original):');
      console.log(JSON.stringify(entries[0], null, 2));
    }
    
    // Process entries to add mills property
    const processedEntries = entries.map(entry => {
      const processedEntry = Object.assign({}, entry);
      // Add mills property from date field
      if (entry.date && !entry.mills) {
        processedEntry.mills = entry.date;
      }
      // Also add mgdl property from sgv if needed
      if (entry.sgv && !entry.mgdl) {
        processedEntry.mgdl = entry.sgv;
      }
      return processedEntry;
    });
    
    console.log('\nProcessed entries:', processedEntries.length);
    if (processedEntries.length > 0) {
      console.log('\nFirst entry (processed):');
      console.log(JSON.stringify(processedEntries[0], null, 2));
      
      // Check the properties
      console.log('\nProperty check for first entry:');
      console.log('Has mills:', 'mills' in processedEntries[0]);
      console.log('mills value:', processedEntries[0].mills);
      console.log('mills type:', typeof processedEntries[0].mills);
      console.log('Has mgdl:', 'mgdl' in processedEntries[0]);
      console.log('mgdl value:', processedEntries[0].mgdl);
      console.log('mgdl type:', typeof processedEntries[0].mgdl);
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await masterClient.close();
  }
}

testSGVConversion();