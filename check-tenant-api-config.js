const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Check both tenants
    const arimarco = await db.collection('tenants').findOne({ subdomain: 'arimarco' });
    const jordan = await db.collection('tenants').findOne({ subdomain: 'jordan' });
    
    console.log('=== API Configuration Check ===\n');
    
    if (arimarco) {
      console.log('ARIMARCO:');
      console.log('- API Secret:', arimarco.apiSecret || 'NOT SET');
      console.log('- Settings:', JSON.stringify(arimarco.settings, null, 2));
      console.log('- Full tenant doc:', JSON.stringify(arimarco, null, 2));
    }
    
    if (jordan) {
      console.log('\nJORDAN:');
      console.log('- API Secret:', jordan.apiSecret || 'NOT SET');
      console.log('- Settings:', JSON.stringify(jordan.settings, null, 2));
      console.log('- Full tenant doc:', JSON.stringify(jordan, null, 2));
    }
    
  } finally {
    await client.close();
  }
})();