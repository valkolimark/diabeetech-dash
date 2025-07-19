#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

async function fixTenantDatabaseNames() {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  
  if (!MASTER_DB_URI) {
    console.error('MASTER_MONGODB_URI not set');
    process.exit(1);
  }

  const client = new MongoClient(MASTER_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const tenantsCollection = db.collection('tenants');
    
    // Get all tenants
    const tenants = await tenantsCollection.find({}).toArray();
    console.log(`Found ${tenants.length} tenants`);
    
    // Update each tenant with the databaseName field
    for (const tenant of tenants) {
      if (!tenant.databaseName) {
        const databaseName = `nightscout-tenant-${tenant.subdomain}`;
        console.log(`Updating tenant ${tenant.name} (${tenant.subdomain}) with databaseName: ${databaseName}`);
        
        await tenantsCollection.updateOne(
          { _id: tenant._id },
          { 
            $set: { 
              databaseName: databaseName,
              updatedAt: new Date()
            }
          }
        );
      } else {
        console.log(`Tenant ${tenant.name} already has databaseName: ${tenant.databaseName}`);
      }
    }
    
    console.log('\n✅ All tenants updated successfully!');
    
    // Verify the updates
    const updatedTenants = await tenantsCollection.find({}).toArray();
    console.log('\nVerification:');
    updatedTenants.forEach(tenant => {
      console.log(`- ${tenant.name}: ${tenant.databaseName}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  fixTenantDatabaseNames().catch(console.error);
}