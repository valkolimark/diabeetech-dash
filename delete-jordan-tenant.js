#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function deleteTenant() {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const subdomain = 'jordan';
  
  const client = new MongoClient(MASTER_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  try {
    await client.connect();
    const db = client.db();
    
    // Find tenant
    const tenant = await db.collection('tenants').findOne({ subdomain });
    
    if (!tenant) {
      console.log(`Tenant with subdomain "${subdomain}" not found`);
      process.exit(1);
    }
    
    console.log(`Found tenant: ${tenant.name} (subdomain: ${tenant.subdomain})`);
    console.log(`Tenant ID: ${tenant.tenantId}`);
    
    // Delete all users associated with this tenant
    const usersResult = await db.collection('users').deleteMany({ 
      tenantId: tenant.tenantId 
    });
    console.log(`✅ Deleted ${usersResult.deletedCount} users`);
    
    // Delete the tenant
    const tenantResult = await db.collection('tenants').deleteOne({ 
      _id: tenant._id 
    });
    console.log(`✅ Deleted tenant: ${tenant.name}`);
    
    // Drop the tenant's database if it exists
    try {
      const tenantDbName = `nightscout_${tenant.tenantId}`;
      const adminDb = client.db().admin();
      await adminDb.dropDatabase(tenantDbName);
      console.log(`✅ Dropped database: ${tenantDbName}`);
    } catch (error) {
      console.log('⚠️  Could not drop tenant database (may not exist)');
    }
    
    console.log('\n=== Tenant Deletion Complete ===');
    console.log(`Deleted: ${tenant.name} (${subdomain}.diabeetech.net)`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  deleteTenant().catch(console.error);
}