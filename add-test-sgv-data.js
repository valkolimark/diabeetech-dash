#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function addTestSGVData() {
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
    const entriesCollection = tenantDb.collection('entries');
    
    // Generate test data for the last 3 hours
    const now = new Date();
    const testEntries = [];
    
    // Create entries every 5 minutes for 3 hours
    for (let i = 0; i < 36; i++) {
      const time = new Date(now.getTime() - (i * 5 * 60 * 1000));
      const sgv = 100 + Math.floor(Math.random() * 50); // Random between 100-150
      
      const entry = {
        _id: `test_${time.getTime()}`,
        sgv: sgv,
        date: time.getTime(),
        dateString: time.toISOString(),
        trend: 4, // Flat
        direction: 'Flat',
        device: 'share2', // Simulate Dexcom
        type: 'sgv',
        utcOffset: 0,
        sysTime: time.toISOString()
      };
      
      testEntries.push(entry);
    }
    
    console.log(`\nInserting ${testEntries.length} test entries...`);
    
    // Insert test data
    try {
      const result = await entriesCollection.insertMany(testEntries, { ordered: false });
      console.log(`Successfully inserted ${result.insertedCount} entries`);
    } catch (err) {
      if (err.code === 11000) {
        console.log('Some entries already exist, continuing...');
      } else {
        throw err;
      }
    }
    
    // Show recent entries
    const recentEntries = await entriesCollection
      .find({})
      .sort({ date: -1 })
      .limit(5)
      .toArray();
    
    console.log('\nMost recent entries:');
    recentEntries.forEach(entry => {
      console.log(`- ${new Date(entry.date).toLocaleString()} - SGV: ${entry.sgv}`);
    });
    
    console.log('\nTest data added successfully!');
    console.log('Refresh your Nightscout page to see the data.');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await masterClient.close();
  }
}

addTestSGVData();