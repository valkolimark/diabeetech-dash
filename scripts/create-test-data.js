#!/usr/bin/env node
'use strict';

/**
 * Create test glucose data for a tenant
 * Usage: node create-test-data.js <tenant-subdomain>
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

async function createTestData() {
  const tenantSubdomain = process.argv[2];
  
  if (!tenantSubdomain) {
    console.error('Usage: node create-test-data.js <tenant-subdomain>');
    process.exit(1);
  }
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nightscout-multitenant';
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const masterDb = client.db();
    
    // Find tenant
    const tenant = await masterDb.collection('tenants').findOne({ subdomain: tenantSubdomain });
    if (!tenant) {
      throw new Error(`Tenant ${tenantSubdomain} not found`);
    }
    
    const tenantDbName = tenant.databaseName || `nightscout-tenant-${tenantSubdomain}`;
    const tenantDb = client.db(tenantDbName);
    
    console.log(`Creating test data for tenant: ${tenant.name}`);
    
    // Create glucose entries (SGV - sensor glucose values)
    const entries = [];
    const now = new Date();
    
    // Generate 24 hours of data (5-minute intervals)
    for (let i = 0; i < 288; i++) {
      const date = new Date(now.getTime() - (i * 5 * 60 * 1000));
      const bgValue = 100 + Math.sin(i / 20) * 30 + Math.random() * 20;
      
      entries.push({
        _id: crypto.randomBytes(12).toString('hex'),
        device: 'xDrip-DexcomG6',
        date: date.getTime(),
        dateString: date.toISOString(),
        sgv: Math.round(bgValue),
        delta: i === 0 ? 0 : Math.round((bgValue - (100 + Math.sin((i-1) / 20) * 30)) / 5),
        direction: getDirection(i),
        type: 'sgv',
        filtered: Math.round(bgValue * 1000),
        unfiltered: Math.round(bgValue * 1000),
        rssi: 100,
        noise: 1,
        sysTime: date.toISOString(),
        utcOffset: 0,
        tenantId: tenant.tenantId
      });
    }
    
    console.log(`Inserting ${entries.length} glucose entries...`);
    await tenantDb.collection('entries').insertMany(entries);
    
    // Create some treatments
    const treatments = [
      {
        _id: crypto.randomBytes(12).toString('hex'),
        eventType: 'Correction Bolus',
        created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        insulin: 2.5,
        notes: 'Correction for high BG',
        tenantId: tenant.tenantId
      },
      {
        _id: crypto.randomBytes(12).toString('hex'),
        eventType: 'Meal Bolus',
        created_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        insulin: 8.0,
        carbs: 60,
        notes: 'Lunch',
        tenantId: tenant.tenantId
      },
      {
        _id: crypto.randomBytes(12).toString('hex'),
        eventType: 'Temp Basal',
        created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        duration: 30,
        percent: -50,
        notes: 'Exercise',
        tenantId: tenant.tenantId
      }
    ];
    
    console.log('Inserting treatments...');
    await tenantDb.collection('treatments').insertMany(treatments);
    
    // Create device status
    const devicestatus = {
      _id: crypto.randomBytes(12).toString('hex'),
      device: 'openaps://raspberrypi',
      created_at: new Date().toISOString(),
      pump: {
        battery: {
          status: 'normal',
          voltage: 1.52
        },
        reservoir: 205.4,
        clock: new Date().toISOString()
      },
      uploader: {
        battery: 85
      },
      tenantId: tenant.tenantId
    };
    
    console.log('Inserting device status...');
    await tenantDb.collection('devicestatus').insertOne(devicestatus);
    
    // Create a profile
    const profile = {
      _id: crypto.randomBytes(12).toString('hex'),
      defaultProfile: 'Default',
      store: {
        Default: {
          dia: '4',
          carbratio: [{
            time: '00:00',
            value: '10'
          }],
          carbs_hr: '20',
          delay: '20',
          sens: [{
            time: '00:00',
            value: '40'
          }],
          timezone: 'UTC',
          basal: [{
            time: '00:00',
            value: '1.0'
          }],
          target_low: [{
            time: '00:00',
            value: '80'
          }],
          target_high: [{
            time: '00:00',
            value: '180'
          }],
          units: 'mg/dL'
        }
      },
      startDate: new Date().toISOString(),
      mills: new Date().getTime(),
      units: 'mg/dL',
      tenantId: tenant.tenantId
    };
    
    console.log('Inserting profile...');
    await tenantDb.collection('profile').insertOne(profile);
    
    // Create indexes
    console.log('Creating indexes...');
    await tenantDb.collection('entries').createIndex({ date: -1 });
    await tenantDb.collection('entries').createIndex({ dateString: -1 });
    await tenantDb.collection('treatments').createIndex({ created_at: -1 });
    await tenantDb.collection('devicestatus').createIndex({ created_at: -1 });
    
    console.log('✓ Test data created successfully!');
    
  } catch (error) {
    console.error('Error creating test data:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

function getDirection(index) {
  const directions = ['DoubleUp', 'SingleUp', 'FortyFiveUp', 'Flat', 'FortyFiveDown', 'SingleDown', 'DoubleDown'];
  const trend = Math.sin(index / 20);
  
  if (trend > 0.5) return 'DoubleUp';
  if (trend > 0.3) return 'SingleUp';
  if (trend > 0.1) return 'FortyFiveUp';
  if (trend > -0.1) return 'Flat';
  if (trend > -0.3) return 'FortyFiveDown';
  if (trend > -0.5) return 'SingleDown';
  return 'DoubleDown';
}

createTestData().catch(console.error);