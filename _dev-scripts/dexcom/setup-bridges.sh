#!/bin/bash
cat << 'SCRIPT' | heroku run node -a btech --no-tty
const { MongoClient } = require('mongodb');

async function setupBridges() {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  // Define tenants and their Dexcom credentials
  const tenantConfigs = [
    {
      subdomain: 'arimarco',
      dexcomUsername: 'ari@p5400.com',
      dexcomPassword: 'CamZack23!'
    },
    {
      subdomain: 'jordan',
      dexcomUsername: 'jordanmarco2323',
      dexcomPassword: 'Camzack23'
    }
  ];
  
  try {
    await client.connect();
    const db = client.db();
    
    for (const config of tenantConfigs) {
      // Find tenant
      const tenant = await db.collection('tenants').findOne({ subdomain: config.subdomain });
      
      if (!tenant) {
        console.log('Tenant not found:', config.subdomain);
        continue;
      }
      
      console.log('\\nConfiguring bridge for:', tenant.name || config.subdomain);
      
      // Bridge settings
      const bridgeSettings = {
        enable: true,
        userName: config.dexcomUsername,
        password: config.dexcomPassword,
        interval: 150000, // 2.5 minutes
        maxCount: 1,
        minutes: 1440,
        maxFailures: 3,
        firstFetchCount: 3
      };
      
      // Update tenant
      const result = await db.collection('tenants').updateOne(
        { _id: tenant._id },
        { 
          $set: { 
            bridge: bridgeSettings,
            bridgeUsername: config.dexcomUsername,
            bridgePassword: config.dexcomPassword,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.modifiedCount === 1) {
        console.log('✅ Bridge configured successfully');
        console.log('   URL: https://' + config.subdomain + '.diabeetech.net');
        console.log('   Dexcom Username:', config.dexcomUsername);
      } else {
        console.log('⚠️  Failed to update bridge settings');
      }
    }
    
    console.log('\\n=== Bridge setup complete ===');
    console.log('The bridges should start fetching data within 2-3 minutes.');
    
  } finally {
    await client.close();
  }
}

setupBridges().catch(console.error);
SCRIPT