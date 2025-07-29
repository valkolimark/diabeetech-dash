#!/bin/bash

heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');
const bcryptjs = require('bcryptjs');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Get Jordan tenant
    const jordan = await db.collection('tenants').findOne({ subdomain: 'jordan' });
    
    if (!jordan) {
      console.log('Jordan tenant not found!');
      return;
    }
    
    console.log('Found Jordan tenant with API secret:', jordan.apiSecret);
    
    // Add database URI if missing
    if (!jordan.databaseUri) {
      const dbUri = MASTER_DB_URI.replace('/nightscout-master', '/nightscout_' + jordan.tenantId);
      await db.collection('tenants').updateOne(
        { _id: jordan._id },
        { $set: { databaseUri: dbUri } }
      );
      console.log('Added database URI');
    }
    
    // Create admin user
    const hashedPassword = await bcryptjs.hash('Camzack23', 10);
    
    // First, delete any existing users for this tenant
    await db.collection('users').deleteMany({ tenantId: jordan.tenantId });
    
    const adminUser = {
      tenantId: jordan.tenantId,
      username: 'jordan@p5400.com',
      email: 'jordan@p5400.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('users').insertOne(adminUser);
    console.log('Admin user created successfully');
    
    console.log('\nJordan tenant is now properly configured:');
    console.log('- URL: https://jordan.diabeetech.net');
    console.log('- API Secret:', jordan.apiSecret);
    console.log('- Admin Email: jordan@p5400.com');
    console.log('- Admin Password: Camzack23');
    console.log('\nDexcom Bridge:');
    console.log('- Username: jordanmarco2323');
    console.log('- Password: Camzack23');
    
  } finally {
    await client.close();
  }
})();
EOF