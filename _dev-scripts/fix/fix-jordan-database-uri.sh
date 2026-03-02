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
    
    console.log('Found Jordan tenant');
    console.log('API Secret:', jordan.apiSecret);
    
    // Add database URI
    const dbUri = MASTER_DB_URI.replace('/nightscout-master', '/nightscout_' + jordan.tenantId);
    
    // Update tenant with missing fields
    const updateResult = await db.collection('tenants').updateOne(
      { _id: jordan._id },
      { 
        $set: { 
          databaseUri: dbUri,
          databaseName: 'nightscout_' + jordan.tenantId
        }
      }
    );
    
    console.log('\nAdded database URI');
    console.log('Database name:', 'nightscout_' + jordan.tenantId);
    
    // Create admin user if missing
    const existingUser = await db.collection('users').findOne({ tenantId: jordan.tenantId });
    
    if (!existingUser) {
      console.log('\nCreating admin user...');
      const hashedPassword = await bcryptjs.hash('Camzack23', 10);
      
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
      console.log('Admin user created');
    } else {
      console.log('\nAdmin user already exists:', existingUser.email);
    }
    
    console.log('\nJordan tenant is now properly configured:');
    console.log('- URL: https://jordan.diabeetech.net');
    console.log('- API Secret:', jordan.apiSecret);
    console.log('- Database URI: configured');
    console.log('- Admin Email: jordan@p5400.com');
    console.log('- Admin Password: Camzack23');
    
  } finally {
    await client.close();
  }
})();
EOF