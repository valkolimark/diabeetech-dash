#!/bin/bash

heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');
const bcryptjs = require('bcryptjs');
const crypto = require('crypto');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('=== Fixing Both Tenants ===\n');
    
    // Fix Arimarco - add database URI
    const arimarco = await db.collection('tenants').findOne({ subdomain: 'arimarco' });
    if (arimarco && !arimarco.databaseUri) {
      const dbUri = MASTER_DB_URI.replace('/nightscout-master', '/nightscout-tenant-arimarco');
      await db.collection('tenants').updateOne(
        { _id: arimarco._id },
        { $set: { databaseUri: dbUri } }
      );
      console.log('Fixed arimarco: Added database URI');
      
      // Also get the API secret
      console.log('Arimarco API Secret:', arimarco.apiSecret);
    }
    
    // Fix Jordan - add admin user
    const jordan = await db.collection('tenants').findOne({ subdomain: 'jordan' });
    if (jordan) {
      console.log('\nJordan API Secret:', jordan.apiSecret);
      
      // Check if user exists
      const existingUser = await db.collection('users').findOne({ 
        tenantId: jordan.tenantId 
      });
      
      if (!existingUser) {
        // Create user with unique userId
        const hashedPassword = await bcryptjs.hash('Camzack23', 10);
        const userId = crypto.randomBytes(12).toString('hex');
        
        const adminUser = {
          userId: userId,
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
        console.log('Fixed jordan: Created admin user');
      }
    }
    
    console.log('\n=== Summary ===');
    console.log('Both tenants should now be properly configured.');
    console.log('\nAccess URLs:');
    console.log('- Arimarco: https://arimarco.diabeetech.net');
    console.log('- Jordan: https://jordan.diabeetech.net');
    console.log('\nUse the API secrets shown above to bypass authentication');
    console.log('by adding ?secret=API_SECRET to the URL');
    
  } finally {
    await client.close();
  }
})();
EOF