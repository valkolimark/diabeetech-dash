#!/bin/bash

heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Define the correct API secrets as specified in the document
    const tenantSecrets = {
      'arimarco': 'bc0d339f49c44d4cd6844ed7d437e0bd',
      'jordan': '1e46e3b0df8b64ab9f4ad49bc6cd44ed'
    };
    
    console.log('=== Fixing Tenant API Authentication ===\n');
    
    for (const [subdomain, apiSecret] of Object.entries(tenantSecrets)) {
      const tenant = await db.collection('tenants').findOne({ subdomain });
      
      if (!tenant) {
        console.log(`Tenant ${subdomain} not found!`);
        continue;
      }
      
      console.log(`\nProcessing ${subdomain}:`);
      console.log(`Current apiSecret: ${tenant.apiSecret}`);
      console.log(`Current apiSecretHash: ${tenant.apiSecretHash || 'NOT SET'}`);
      console.log(`Expected apiSecret: ${apiSecret}`);
      
      // Generate SHA-1 hash
      const apiSecretHash = crypto.createHash('sha1').update(apiSecret).digest('hex').toLowerCase();
      console.log(`Generated apiSecretHash: ${apiSecretHash}`);
      
      // Update the tenant with correct API secret and hash
      const updateResult = await db.collection('tenants').updateOne(
        { subdomain },
        { 
          $set: { 
            apiSecret: apiSecret,
            apiSecretHash: apiSecretHash,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`Update result: ${updateResult.modifiedCount} document(s) modified`);
      
      // Also ensure settings.api_secret is set
      const settingsUpdate = await db.collection('tenants').updateOne(
        { subdomain },
        { 
          $set: { 
            'settings.api_secret': apiSecret,
            'settings.authDefaultRoles': 'readable'
          }
        }
      );
      
      console.log(`Settings update: ${settingsUpdate.modifiedCount} document(s) modified`);
    }
    
    console.log('\n=== Verification ===');
    
    // Verify the updates
    for (const subdomain of Object.keys(tenantSecrets)) {
      const tenant = await db.collection('tenants').findOne({ subdomain });
      console.log(`\n${subdomain.toUpperCase()}:`);
      console.log(`- apiSecret: ${tenant.apiSecret}`);
      console.log(`- apiSecretHash: ${tenant.apiSecretHash}`);
      console.log(`- settings.api_secret: ${tenant.settings?.api_secret || 'NOT SET'}`);
      console.log(`- settings.authDefaultRoles: ${tenant.settings?.authDefaultRoles || 'NOT SET'}`);
    }
    
    console.log('\n=== Fix Complete ===');
    console.log('\nTest with:');
    console.log('curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=bc0d339f49c44d4cd6844ed7d437e0bd"');
    console.log('curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=1e46e3b0df8b64ab9f4ad49bc6cd44ed"');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
})();
EOF