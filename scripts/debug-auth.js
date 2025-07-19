#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function debugAuth() {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  
  const client = new MongoClient(MASTER_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('\n=== Authentication Debug ===\n');
    
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users\n`);
    
    for (const user of users) {
      console.log(`User: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  TenantId: ${user.tenantId}`);
      console.log(`  Active: ${user.isActive}`);
      console.log(`  Has password: ${!!user.password}`);
      console.log(`  Password length: ${user.password ? user.password.length : 0}`);
      
      // Get tenant info
      const tenant = await db.collection('tenants').findOne({ tenantId: user.tenantId });
      if (tenant) {
        console.log(`  Tenant: ${tenant.name} (${tenant.subdomain})`);
      } else {
        console.log(`  Tenant: NOT FOUND`);
      }
      
      // Test password verification
      const testPassword = 'vp8g9GBLeomRKJxa'; // The password we set for clinic1
      if (user.email === 'admin@clinic1.diabeetech.com') {
        const match = await bcrypt.compare(testPassword, user.password);
        console.log(`  Password test with '${testPassword}': ${match ? 'MATCH' : 'NO MATCH'}`);
      }
      
      console.log('');
    }
    
    // Check if login endpoint exists
    console.log('\n=== Checking Auth Endpoints ===');
    console.log('Auth API should be at: /api/auth/login');
    console.log('Login page should be at: /login');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  debugAuth().catch(console.error);
}