#!/bin/bash
cat << 'SCRIPT' | heroku run node -a btech --no-tty
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Get tenant configurations
    const tenants = await db.collection('tenants').find({
      subdomain: { $in: ['onepanman', 'arimarco'] }
    }).toArray();
    
    console.log('Comparing tenant configurations:\\n');
    
    tenants.forEach(tenant => {
      console.log('\\n=== ' + tenant.name + ' (' + tenant.subdomain + ') ===');
      console.log('Bridge Username:', tenant.bridgeUsername || 'NOT SET');
      console.log('Bridge Password:', tenant.bridgePassword ? 'SET' : 'NOT SET');
      console.log('Bridge Server:', tenant.bridgeServer || 'NOT SET');
      console.log('API Secret:', tenant.apiSecret ? 'SET' : 'NOT SET');
      console.log('Created:', tenant.createdAt);
      console.log('Updated:', tenant.updatedAt);
      console.log('Active:', tenant.isActive);
      console.log('Settings:', JSON.stringify(tenant.settings || {}, null, 2));
    });
    
  } finally {
    await client.close();
  }
})();
SCRIPT