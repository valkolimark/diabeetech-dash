#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function fixProfileStructure() {
  const tenantEmail = process.argv[2];
  
  if (!tenantEmail) {
    console.error('Usage: node fix-profile-structure.js <tenant-email>');
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
    
    // Connect to tenant database
    const tenantDbName = `nightscout-tenant-${tenant.tenantId}`;
    const tenantDb = masterClient.db(tenantDbName);
    
    // Get current profile
    const profileCollection = tenantDb.collection('profile');
    const currentProfile = await profileCollection.findOne({ _id: 'defaultProfile' });
    
    if (!currentProfile) {
      console.log('No profile found for tenant, checking all profiles...');
      const allProfiles = await profileCollection.find({}).toArray();
      console.log('All profiles in collection:', allProfiles);
      
      if (allProfiles.length === 0) {
        console.log('No profiles found, creating default profile...');
        // Create new profile with correct structure
        const newProfile = {
          _id: 'defaultProfile',
          defaultProfile: 'Default',
          startDate: new Date().toISOString(),
          mills: Date.now(),
          units: 'mg/dl',
          store: {
            'Default': {
              dia: 4,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              basal: [{ time: '00:00', value: 1.0 }],
              carbratio: [{ time: '00:00', value: 10 }],
              sens: [{ time: '00:00', value: 50 }],
              target_low: [{ time: '00:00', value: 80 }],
              target_high: [{ time: '00:00', value: 120 }],
              carbs_hr: 20,
              delay: 20,
              units: 'mg/dl'
            }
          }
        };
        
        await profileCollection.insertOne(newProfile);
        console.log('Created new profile with correct structure');
        process.exit(0);
      }
      process.exit(1);
    }
    
    console.log('Current profile structure:', JSON.stringify(currentProfile, null, 2));
    
    // Check if profile already has correct structure
    if (currentProfile.store && currentProfile.store.Default) {
      console.log('Profile already has correct structure');
      process.exit(0);
    }
    
    // Fix profile structure
    const updatedProfile = {
      _id: currentProfile._id,
      defaultProfile: 'Default',
      startDate: currentProfile.startDate,
      mills: currentProfile.mills,
      units: currentProfile.units,
      store: {
        'Default': {
          dia: currentProfile.dia,
          timezone: currentProfile.timezone,
          basal: currentProfile.basal,
          carbratio: currentProfile.carbratio,
          sens: currentProfile.sens,
          target_low: currentProfile.target_low,
          target_high: currentProfile.target_high,
          carbs_hr: currentProfile.carbs_hr,
          delay: currentProfile.delay,
          units: currentProfile.units
        }
      }
    };
    
    // Update profile
    await profileCollection.replaceOne(
      { _id: 'defaultProfile' },
      updatedProfile
    );
    
    console.log('Profile structure fixed successfully');
    console.log('Updated profile:', JSON.stringify(updatedProfile, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await masterClient.close();
  }
}

fixProfileStructure();