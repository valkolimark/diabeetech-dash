#!/bin/bash

# Delete Jordan tenant
echo "Deleting Jordan tenant..."
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
    
    // Find and delete Jordan tenants
    const tenants = await db.collection('tenants').find({}).toArray();
    let deleted = false;
    
    for (const tenant of tenants) {
      if (tenant.subdomain && tenant.subdomain.toLowerCase().includes('jordan') ||
          tenant.name && tenant.name.toLowerCase().includes('jordan') ||
          tenant.email && tenant.email.toLowerCase().includes('jordan')) {
        
        console.log('Deleting tenant:', tenant.name || tenant.subdomain);
        
        // Delete users
        await db.collection('users').deleteMany({ tenantId: tenant.tenantId });
        
        // Delete tenant
        await db.collection('tenants').deleteOne({ _id: tenant._id });
        
        deleted = true;
      }
    }
    
    if (deleted) {
      console.log('Jordan tenant(s) deleted.');
    } else {
      console.log('No Jordan tenant found to delete.');
    }
    
  } finally {
    await client.close();
  }
})();
EOF

echo ""
echo "Creating new Jordan tenant..."

# Create Jordan tenant
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
    
    // Generate tenant ID
    const tenantId = crypto.randomBytes(12).toString('hex');
    
    // Create tenant
    const tenant = {
      tenantId: tenantId,
      name: 'Jordan Marco',
      subdomain: 'jordan',
      email: 'jordan@p5400.com',
      apiSecret: crypto.randomBytes(32).toString('hex'),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Add Dexcom bridge settings
      bridge: {
        enable: true,
        userName: 'jordanmarco2323',
        password: 'Camzack23',
        interval: 150000,
        maxCount: 1,
        minutes: 1440,
        maxFailures: 3,
        firstFetchCount: 3
      },
      bridgeUsername: 'jordanmarco2323',
      bridgePassword: 'Camzack23'
    };
    
    await db.collection('tenants').insertOne(tenant);
    console.log('Tenant created:', tenant.name);
    
    // Create admin user
    const hashedPassword = await bcryptjs.hash('Camzack23', 10);
    const adminUser = {
      tenantId: tenantId,
      username: 'jordan@p5400.com',
      email: 'jordan@p5400.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('users').insertOne(adminUser);
    console.log('Admin user created:', adminUser.email);
    
    console.log('\nJordan tenant setup complete:');
    console.log('- URL: https://jordan.diabeetech.net');
    console.log('- Email: jordan@p5400.com');
    console.log('- Password: Camzack23');
    console.log('- Dexcom Username: jordanmarco2323');
    console.log('- Dexcom Password: Camzack23');
    console.log('\nDexcom bridge is enabled and will start fetching data shortly.');
    
  } finally {
    await client.close();
  }
})();
EOF