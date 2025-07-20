#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function debugDataQuery() {
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
    
    // Get current time and simulate query
    const now = Date.now();
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    
    console.log('\nTime information:');
    console.log('Current time (server):', new Date(now).toISOString());
    console.log('Current timestamp:', now);
    
    // Simulate the query that WebSocket would make
    const dateRange = {
      $gte: now - TWO_DAYS
    };
    
    console.log('\nQuery date range:');
    console.log('From:', new Date(dateRange.$gte).toISOString());
    console.log('To: current time');
    
    // Check entries with this query
    const entriesCollection = tenantDb.collection('entries');
    const entries = await entriesCollection
      .find({ date: dateRange })
      .sort({ date: -1 })
      .limit(10)
      .toArray();
    
    console.log('\nEntries found with query:', entries.length);
    
    if (entries.length > 0) {
      console.log('\nFirst few entries:');
      entries.slice(0, 5).forEach(entry => {
        console.log('  Date field:', entry.date, 'Type:', typeof entry.date);
        console.log('  DateString:', entry.dateString);
        console.log('  SGV:', entry.sgv, 'Direction:', entry.direction);
        console.log('  ---');
      });
    }
    
    // Now let's check ALL entries to see what's there
    const allEntries = await entriesCollection
      .find({})
      .sort({ date: -1 })
      .limit(10)
      .toArray();
    
    console.log('\nALL entries (no date filter):', allEntries.length);
    if (allEntries.length > 0) {
      console.log('\nFirst few entries (unfiltered):');
      allEntries.slice(0, 5).forEach(entry => {
        console.log('  Date field:', entry.date, 'Type:', typeof entry.date);
        console.log('  DateString:', entry.dateString);
        console.log('  SGV:', entry.sgv, 'Direction:', entry.direction);
        console.log('  ---');
      });
    }
    
    // Check date field types
    const sampleEntry = await entriesCollection.findOne({});
    if (sampleEntry) {
      console.log('\nSample entry structure:');
      console.log('Date field type:', typeof sampleEntry.date);
      console.log('Date field value:', sampleEntry.date);
      console.log('DateString field:', sampleEntry.dateString);
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await masterClient.close();
  }
}

debugDataQuery();