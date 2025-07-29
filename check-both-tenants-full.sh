#!/bin/bash

heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('=== Checking Tenant Configurations ===\n');
    
    // Check both tenants
    const tenants = ['arimarco', 'jordan'];
    
    for (const subdomain of tenants) {
      const tenant = await db.collection('tenants').findOne({ subdomain });
      
      if (tenant) {
        console.log('\n=== ' + tenant.name + ' (' + subdomain + ') ===');
        console.log('Tenant ID:', tenant.tenantId);
        console.log('API Secret:', tenant.apiSecret ? 'SET' : 'NOT SET');
        console.log('Database URI:', tenant.databaseUri ? 'SET' : 'NOT SET');
        console.log('Database Name:', tenant.databaseName || 'NOT SET');
        console.log('Bridge enabled:', tenant.bridge ? tenant.bridge.enable : false);
        console.log('Bridge username:', tenant.bridge ? tenant.bridge.userName : 'NOT SET');
        console.log('Bridge password:', tenant.bridge && tenant.bridge.password ? 'SET' : 'NOT SET');
        
        // Check for admin user
        const user = await db.collection('users').findOne({ tenantId: tenant.tenantId });
        console.log('Admin user:', user ? user.email : 'NOT FOUND');
        
        // Check tenant database for data
        if (tenant.databaseUri || tenant.databaseName) {
          const tenantDbName = tenant.databaseName || 'nightscout_' + tenant.tenantId;
          const tenantDb = client.db(tenantDbName);
          
          try {
            const entriesCount = await tenantDb.collection('entries').countDocuments();
            console.log('Glucose entries:', entriesCount);
            
            // Get latest entry
            const latestEntry = await tenantDb.collection('entries').findOne({}, { sort: { date: -1 } });
            if (latestEntry) {
              const age = Math.round((Date.now() - latestEntry.date) / 60000);
              console.log('Latest entry:', age + ' minutes ago');
            }
          } catch (dbErr) {
            console.log('Glucose entries: ERROR accessing database');
          }
        }
      } else {
        console.log('\n=== ' + subdomain + ' ===');
        console.log('TENANT NOT FOUND');
      }
    }
    
    console.log('\n\n=== Summary ===');
    console.log('- Both tenants should have API Secret, Database URI, and Admin User');
    console.log('- Bridge should be enabled with credentials');
    console.log('- URL format: https://[subdomain].diabeetech.net');
    console.log('- API Secret is used in the URL to bypass authentication');
    
  } finally {
    await client.close();
  }
})();
EOF