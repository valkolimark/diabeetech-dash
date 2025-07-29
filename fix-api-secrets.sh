#!/bin/bash

heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('=== Fixing API Secrets in Settings ===\n');
    
    // Fix Arimarco
    const arimarco = await db.collection('tenants').findOne({ subdomain: 'arimarco' });
    if (arimarco) {
      const settings = arimarco.settings || {};
      settings.api_secret = arimarco.apiSecret;
      settings.authDefaultRoles = 'readable';
      
      await db.collection('tenants').updateOne(
        { _id: arimarco._id },
        { $set: { settings: settings } }
      );
      console.log('Fixed arimarco - Added API secret to settings');
    }
    
    // Fix Jordan
    const jordan = await db.collection('tenants').findOne({ subdomain: 'jordan' });
    if (jordan) {
      const settings = jordan.settings || {};
      settings.api_secret = jordan.apiSecret;
      settings.authDefaultRoles = 'readable';
      
      await db.collection('tenants').updateOne(
        { _id: jordan._id },
        { $set: { settings: settings } }
      );
      console.log('Fixed jordan - Added API secret to settings');
    }
    
    console.log('\n=== Both tenants fixed! ===');
    console.log('\nYou can now access data using:');
    console.log('- Arimarco: https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=' + arimarco.apiSecret);
    console.log('- Jordan: https://jordan.diabeetech.net/api/v1/entries/current.json?secret=' + jordan.apiSecret);
    
  } finally {
    await client.close();
  }
})();
EOF