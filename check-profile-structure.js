#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function checkProfileStructure() {
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
    
    // Get profiles
    const profileCollection = tenantDb.collection('profile');
    const profiles = await profileCollection.find({}).toArray();
    
    console.log('\n=== Profile Data Structure ===');
    console.log('Total profiles:', profiles.length);
    
    profiles.forEach((profile, index) => {
      console.log(`\nProfile ${index + 1}:`);
      console.log('Keys:', Object.keys(profile));
      console.log('Has defaultProfile?', !!profile.defaultProfile);
      console.log('Has store?', !!profile.store);
      console.log('startDate:', profile.startDate);
      
      if (profile.store) {
        console.log('Store keys:', Object.keys(profile.store));
        const firstStoreKey = Object.keys(profile.store)[0];
        if (firstStoreKey) {
          const profileData = profile.store[firstStoreKey];
          console.log(`\nProfile "${firstStoreKey}" structure:`);
          console.log('  Keys:', Object.keys(profileData));
          if (profileData.basal) console.log('  Basal entries:', profileData.basal.length);
          if (profileData.carbratio) console.log('  Carb ratio entries:', profileData.carbratio.length);
          if (profileData.sens) console.log('  Sensitivity entries:', profileData.sens.length);
          console.log('  Units:', profileData.units);
          console.log('  Timezone:', profileData.timezone);
        }
      }
      
      console.log('\nFull structure:', JSON.stringify(profile, null, 2));
    });
    
    // Check for the activeProfileToTime issue
    console.log('\n=== Checking Profile Usage ===');
    const treatments = await tenantDb.collection('treatments').find({ eventType: 'Profile Switch' }).sort({ created_at: -1 }).limit(5).toArray();
    console.log('Recent profile switches:', treatments.length);
    treatments.forEach((t, i) => {
      console.log(`\nProfile Switch ${i + 1}:`);
      console.log('  Profile:', t.profile);
      console.log('  Created:', t.created_at);
    });
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await masterClient.close();
  }
}

checkProfileStructure();