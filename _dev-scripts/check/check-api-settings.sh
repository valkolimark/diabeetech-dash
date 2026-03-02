#!/bin/bash

heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Check both tenants
    const arimarco = await db.collection('tenants').findOne({ subdomain: 'arimarco' });
    const jordan = await db.collection('tenants').findOne({ subdomain: 'jordan' });
    
    console.log('=== API Configuration Check ===\n');
    
    if (arimarco) {
      console.log('ARIMARCO:');
      console.log('- API Secret:', arimarco.apiSecret || 'NOT SET');
      console.log('- Settings.authDefaultRoles:', arimarco.settings?.authDefaultRoles);
      console.log('- Settings.api_secret:', arimarco.settings?.api_secret || 'NOT SET');
      console.log('- Settings.apiSecret:', arimarco.settings?.apiSecret || 'NOT SET');
    }
    
    console.log('\n');
    
    if (jordan) {
      console.log('JORDAN:');
      console.log('- API Secret:', jordan.apiSecret || 'NOT SET');
      console.log('- Settings.authDefaultRoles:', jordan.settings?.authDefaultRoles);
      console.log('- Settings.api_secret:', jordan.settings?.api_secret || 'NOT SET');
      console.log('- Settings.apiSecret:', jordan.settings?.apiSecret || 'NOT SET');
    }
    
    console.log('\n\nNote: The API secret might need to be in settings.api_secret');
    
  } finally {
    await client.close();
  }
})();
EOF