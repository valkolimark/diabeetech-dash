#!/usr/bin/env node

/**
 * Dexcom Bridge Diagnostic Tool for Btech
 * Checks the status and configuration of Dexcom bridges for all tenants
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nightscout';
const API_SECRET = process.env.API_SECRET || 'MySecret';

// Generate API secret hash
function generateApiSecretHash(secret) {
  return crypto.createHash('sha1').update(secret).digest('hex');
}

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Check tenant Dexcom bridge configuration
async function checkTenantBridge(tenantDb) {
  const db = mongoose.connection.useDb(tenantDb);
  
  // Define profile schema
  const ProfileSchema = new mongoose.Schema({}, { collection: 'profile', strict: false });
  const Profile = db.model('Profile', ProfileSchema);
  
  // Define entries schema
  const EntriesSchema = new mongoose.Schema({
    date: Number,
    dateString: String,
    sgv: Number,
    direction: String,
    type: String
  }, { collection: 'entries' });
  const Entries = db.model('Entries', EntriesSchema);
  
  try {
    // Get bridge configuration
    const profiles = await Profile.find({}).lean();
    let bridgeConfig = null;
    
    for (const profile of profiles) {
      if (profile.bridge && profile.bridge.userName) {
        bridgeConfig = profile.bridge;
        break;
      }
    }
    
    // Get recent entries
    const recentEntries = await Entries.find({})
      .sort({ date: -1 })
      .limit(5)
      .lean();
    
    const totalEntries = await Entries.countDocuments();
    
    // Calculate data freshness
    let dataFreshness = 'No data';
    if (recentEntries.length > 0) {
      const lastEntryDate = new Date(recentEntries[0].date);
      const now = new Date();
      const minutesAgo = Math.floor((now - lastEntryDate) / 1000 / 60);
      dataFreshness = `${minutesAgo} minutes ago`;
    }
    
    return {
      database: tenantDb,
      bridgeConfig: bridgeConfig,
      totalEntries: totalEntries,
      latestEntry: recentEntries[0] || null,
      dataFreshness: dataFreshness,
      recentEntries: recentEntries
    };
  } catch (error) {
    console.error(`Error checking tenant ${tenantDb}:`, error);
    return {
      database: tenantDb,
      error: error.message
    };
  }
}

// Main diagnostic function
async function runDiagnostics() {
  await connectDB();
  
  console.log('=== Btech Dexcom Bridge Diagnostics ===');
  console.log(`API Secret Hash: ${generateApiSecretHash(API_SECRET)}`);
  console.log('');
  
  // Get all tenant databases
  const admin = mongoose.connection.db.admin();
  const dbList = await admin.listDatabases();
  const tenantDbs = dbList.databases
    .map(db => db.name)
    .filter(name => name.startsWith('nightscout-tenant-') || name.startsWith('nightscout_'));
  
  console.log(`Found ${tenantDbs.length} tenant databases`);
  console.log('');
  
  // Check each tenant
  for (const tenantDb of tenantDbs) {
    console.log(`=== Checking ${tenantDb} ===`);
    const result = await checkTenantBridge(tenantDb);
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else {
      console.log(`Bridge Configuration:`);
      if (result.bridgeConfig) {
        console.log(`  - Username: ${result.bridgeConfig.userName || 'Not set'}`);
        console.log(`  - Password: ${result.bridgeConfig.password ? 'SET' : 'NOT SET'}`);
        console.log(`  - Enabled: ${result.bridgeConfig.enable || false}`);
        console.log(`  - Interval: ${result.bridgeConfig.interval || 'Not set'} minutes`);
      } else {
        console.log(`  ❌ No bridge configuration found`);
      }
      
      console.log(`\nData Status:`);
      console.log(`  - Total entries: ${result.totalEntries}`);
      console.log(`  - Data freshness: ${result.dataFreshness}`);
      
      if (result.latestEntry) {
        console.log(`  - Latest SGV: ${result.latestEntry.sgv} mg/dL`);
        console.log(`  - Direction: ${result.latestEntry.direction}`);
        console.log(`  - Time: ${new Date(result.latestEntry.date).toLocaleString()}`);
      }
    }
    console.log('');
  }
  
  // Check bridge manager status
  console.log('=== Bridge Manager Status ===');
  console.log('To check if bridge manager is running on Heroku:');
  console.log('  heroku ps -a btech');
  console.log('  heroku logs --tail -a btech | grep bridge');
  
  mongoose.connection.close();
}

// Run diagnostics
runDiagnostics().catch(console.error);