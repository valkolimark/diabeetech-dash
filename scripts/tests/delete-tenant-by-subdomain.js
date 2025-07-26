const { MongoClient } = require('mongodb');
require('dotenv').config();

async function deleteTenantBySubdomain(subdomain) {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
  
  if (!mongoUri) {
    console.error('No MongoDB URI found in environment');
    return;
  }

  const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // First, find the tenant
    console.log(`\nSearching for tenant with subdomain: ${subdomain}`);
    const tenant = await db.collection('tenants').findOne({ 
      subdomain: subdomain.toLowerCase() 
    });
    
    if (!tenant) {
      console.log(`No tenant found with subdomain: ${subdomain}`);
      return;
    }
    
    console.log('Found tenant:');
    console.log('- Tenant ID:', tenant.tenantId);
    console.log('- Tenant Name:', tenant.tenantName);
    console.log('- Subdomain:', tenant.subdomain);
    console.log('- Database Name:', tenant.databaseName);
    console.log('- Created At:', tenant.createdAt);
    console.log('- Is Active:', tenant.isActive);
    
    // Ask for confirmation
    console.log('\nWARNING: This will permanently delete the tenant record!');
    console.log('To confirm deletion, run this script with CONFIRM=true environment variable');
    console.log('Example: CONFIRM=true node scripts/tests/delete-tenant-by-subdomain.js');
    
    if (process.env.CONFIRM === 'true') {
      console.log('\nDeleting tenant...');
      
      // Delete the tenant
      const result = await db.collection('tenants').deleteOne({ 
        subdomain: subdomain.toLowerCase() 
      });
      
      if (result.deletedCount > 0) {
        console.log('✅ Tenant deleted successfully');
        
        // Also check for any users associated with this tenant
        const tenantUsers = await db.collection('users').find({ 
          tenant: tenant.tenantId 
        }).toArray();
        
        if (tenantUsers.length > 0) {
          console.log(`\nFound ${tenantUsers.length} users associated with this tenant:`);
          tenantUsers.forEach(user => {
            console.log(`- ${user.email} (${user.name || 'No name'})`);
          });
          console.log('\nNote: These users were NOT deleted. Delete them separately if needed.');
        }
      } else {
        console.log('❌ Failed to delete tenant');
      }
    } else {
      console.log('\nNo action taken. Tenant NOT deleted.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Get subdomain from command line argument
const subdomain = process.argv[2] || 'arigold';
deleteTenantBySubdomain(subdomain);