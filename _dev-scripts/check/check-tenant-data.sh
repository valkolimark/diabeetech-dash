#!/bin/bash
cat << 'SCRIPT' | heroku run node -a btech --no-tty
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const masterDb = client.db();
    
    // Get tenants
    const tenants = await masterDb.collection('tenants').find({
      subdomain: { $in: ['onepanman', 'arimarco'] }
    }).toArray();
    
    for (const tenant of tenants) {
      console.log('\\n=== ' + tenant.subdomain + ' ===');
      
      // Check tenant database
      const tenantDbName = 'nightscout_' + tenant.tenantId;
      const tenantDb = client.db(tenantDbName);
      
      // Count entries
      const entriesCount = await tenantDb.collection('entries').countDocuments();
      console.log('Total entries:', entriesCount);
      
      // Get latest entry
      const latestEntry = await tenantDb.collection('entries').findOne(
        {},
        { sort: { dateString: -1 } }
      );
      
      if (latestEntry) {
        console.log('Latest entry date:', latestEntry.dateString);
        console.log('Entry type:', latestEntry.type);
        console.log('SGV:', latestEntry.sgv);
        const entryDate = new Date(latestEntry.date);
        const now = new Date();
        const ageMinutes = Math.round((now - entryDate) / 60000);
        console.log('Age:', ageMinutes, 'minutes');
      } else {
        console.log('No entries found');
      }
      
      // Check treatments
      const treatmentsCount = await tenantDb.collection('treatments').countDocuments();
      console.log('Total treatments:', treatmentsCount);
    }
    
  } finally {
    await client.close();
  }
})();
SCRIPT