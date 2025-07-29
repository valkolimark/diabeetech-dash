#!/bin/bash

heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Check Jordan tenant data
    const jordan = await db.collection('tenants').findOne({ subdomain: 'jordan' });
    
    if (jordan) {
      console.log('Jordan tenant found:');
      console.log(JSON.stringify(jordan, null, 2));
      
      // Check for admin user
      const adminUser = await db.collection('users').findOne({ tenantId: jordan.tenantId });
      console.log('\nAdmin user found:', adminUser ? 'YES' : 'NO');
      if (adminUser) {
        console.log('User email:', adminUser.email || adminUser.username);
      }
      
    } else {
      console.log('Jordan tenant NOT FOUND');
    }
    
  } finally {
    await client.close();
  }
})();
EOF