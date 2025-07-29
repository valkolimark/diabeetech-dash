#!/bin/bash
cat << 'SCRIPT' | heroku run node -a btech --no-tty
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const subdomain = 'jordan';
  
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    const tenant = await db.collection('tenants').findOne({ subdomain });
    
    if (!tenant) {
      console.log('Tenant jordan not found');
      process.exit(1);
    }
    
    console.log('Found tenant:', tenant.name);
    console.log('Tenant ID:', tenant.tenantId);
    
    const usersResult = await db.collection('users').deleteMany({ 
      tenantId: tenant.tenantId 
    });
    console.log('Deleted users:', usersResult.deletedCount);
    
    const tenantResult = await db.collection('tenants').deleteOne({ 
      _id: tenant._id 
    });
    console.log('Deleted tenant:', tenantResult.deletedCount);
    
    console.log('\\nJordan Marco tenant has been deleted successfully');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
})();
SCRIPT