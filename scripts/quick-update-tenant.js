const crypto = require('crypto');
const MongoClient = require('mongodb').MongoClient;

const uri = process.env.MONGODB_URI;
const apiSecret = 'GodIsSoGood2Me23!';
const apiSecretHash = crypto.createHash('sha1').update(apiSecret).digest('hex').toLowerCase();

console.log('Connecting to MongoDB...');

MongoClient.connect(uri, { useUnifiedTopology: true }, async (err, client) => {
  if (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
  
  try {
    const db = client.db();
    const result = await db.collection('tenants').updateOne(
      { subdomain: 'onepanman' },
      { 
        $set: { 
          apiSecret: apiSecret,
          apiSecretHash: apiSecretHash,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('Update result:', JSON.stringify(result));
    console.log('API Secret:', apiSecret);
    console.log('API Secret Hash:', apiSecretHash);
    
    // Verify the update
    const tenant = await db.collection('tenants').findOne({ subdomain: 'onepanman' });
    console.log('Tenant after update:', JSON.stringify(tenant, null, 2));
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    client.close();
    process.exit(0);
  }
});