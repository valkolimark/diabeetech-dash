#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

// MongoDB connection URL for clinic2
const MONGO_URL = process.env.MONGODB_URI || 'mongodb+srv://itfluxdev:m0r3vfSxoSiqT5g@cluster1.5iyw2.mongodb.net/';
const dbName = 'nightscout_clinic2';

async function testProfiles() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Test different collection name variations
    console.log('\nTesting collection names...');
    
    // Test lowercase 'profile'
    const profileLower = await db.collection('profile').find({}).toArray();
    console.log(`\nCollection 'profile' (lowercase): ${profileLower.length} documents`);
    if (profileLower.length > 0) {
      console.log('Sample:', JSON.stringify(profileLower[0], null, 2));
    }
    
    // Test uppercase 'Profile'
    const profileUpper = await db.collection('Profile').find({}).toArray();
    console.log(`\nCollection 'Profile' (uppercase): ${profileUpper.length} documents`);
    if (profileUpper.length > 0) {
      console.log('Sample:', JSON.stringify(profileUpper[0], null, 2));
    }
    
    // List all collections
    console.log('\nAll collections in database:');
    const collections = await db.listCollections().toArray();
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Check specific profile with _id
    console.log('\nChecking for specific profile with _id "defaultProfile":');
    const defaultProfile = await db.collection('profile').findOne({ _id: 'defaultProfile' });
    if (defaultProfile) {
      console.log('Found default profile:', JSON.stringify(defaultProfile, null, 2));
    } else {
      console.log('Default profile not found in lowercase collection');
      
      // Try uppercase
      const defaultProfileUpper = await db.collection('Profile').findOne({ _id: 'defaultProfile' });
      if (defaultProfileUpper) {
        console.log('Found default profile in uppercase collection:', JSON.stringify(defaultProfileUpper, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

testProfiles();