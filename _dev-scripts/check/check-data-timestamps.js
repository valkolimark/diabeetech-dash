#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function checkDataTimestamps() {
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
    
    // Connect to tenant database
    const tenantDbName = `nightscout-tenant-${tenant.tenantId}`;
    const tenantDb = masterClient.db(tenantDbName);
    
    // Get entries with timestamps
    const entriesCollection = tenantDb.collection('entries');
    const entries = await entriesCollection
      .find({})
      .sort({ dateString: -1 })
      .limit(20)
      .toArray();
    
    console.log('\nCurrent time:', new Date().toISOString());
    console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    console.log('\nEntry timestamps:');
    entries.forEach(entry => {
      const entryDate = new Date(entry.dateString);
      const now = new Date();
      const hoursAgo = (now - entryDate) / (1000 * 60 * 60);
      
      console.log(`- ${entry.dateString} (${entryDate.toLocaleString()}) - ${hoursAgo.toFixed(1)} hours ago`);
      console.log(`  SGV: ${entry.sgv}, Direction: ${entry.direction}, Device: ${entry.device}`);
      console.log(`  Date field: ${entry.date}, Type: ${entry.type}`);
      console.log(`  Is future: ${entryDate > now}`);
    });
    
    // Check for any entries within last 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentEntries = await entriesCollection
      .find({ dateString: { $gte: sixHoursAgo.toISOString() } })
      .count();
    
    console.log(`\nEntries in last 6 hours: ${recentEntries}`);
    
    // Check if bridge is creating new entries
    const newestEntry = entries[0];
    if (newestEntry) {
      const age = (new Date() - new Date(newestEntry.dateString)) / (1000 * 60);
      console.log(`\nNewest entry age: ${age.toFixed(1)} minutes`);
      console.log('Bridge should run every 2.5 minutes (150000ms)');
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await masterClient.close();
  }
}

checkDataTimestamps();