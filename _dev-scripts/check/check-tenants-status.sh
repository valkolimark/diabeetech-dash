#!/bin/bash

heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('=== Checking Tenant Status ===\n');
    
    // Check arimarco
    const arimarco = await db.collection('tenants').findOne({ subdomain: 'arimarco' });
    if (arimarco) {
      console.log('ARIMARCO:');
      console.log('- URL: https://arimarco.diabeetech.net');
      console.log('- Bridge enabled:', arimarco.bridge ? arimarco.bridge.enable : false);
      console.log('- Bridge username:', arimarco.bridge ? arimarco.bridge.userName : 'NOT SET');
      console.log('- Dexcom configured:', arimarco.bridge && arimarco.bridge.userName ? 'YES' : 'NO');
    } else {
      console.log('ARIMARCO: NOT FOUND');
    }
    
    console.log('');
    
    // Check jordan
    const jordan = await db.collection('tenants').findOne({ subdomain: 'jordan' });
    if (jordan) {
      console.log('JORDAN:');
      console.log('- URL: https://jordan.diabeetech.net');
      console.log('- Bridge enabled:', jordan.bridge ? jordan.bridge.enable : false);
      console.log('- Bridge username:', jordan.bridge ? jordan.bridge.userName : 'NOT SET');
      console.log('- Dexcom configured:', jordan.bridge && jordan.bridge.userName ? 'YES' : 'NO');
    } else {
      console.log('JORDAN: NOT FOUND');
    }
    
    console.log('\n=== Summary ===');
    console.log('Both tenants should have Dexcom bridge enabled and configured.');
    console.log('The bridges should start fetching data within 2-3 minutes.');
    
  } finally {
    await client.close();
  }
})();
EOF