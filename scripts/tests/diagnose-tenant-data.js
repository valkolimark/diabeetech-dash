const { MongoClient } = require('mongodb');
require('dotenv').config();

async function diagnoseTenantData(subdomain) {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_CONNECTION || process.env.MONGOLAB_URI;
  
  if (!mongoUri) {
    console.error('No MongoDB URI found in environment');
    return;
  }

  const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log(`\n=== Diagnosing Tenant: ${subdomain} ===\n`);
    
    const db = client.db();
    
    // 1. Check if tenant exists
    console.log('1. Checking tenant record...');
    const tenant = await db.collection('tenants').findOne({ 
      subdomain: subdomain.toLowerCase() 
    });
    
    if (!tenant) {
      console.log(`❌ No tenant found with subdomain: ${subdomain}`);
      return;
    }
    
    console.log('✅ Tenant found:');
    console.log('   - Tenant ID:', tenant.tenantId);
    console.log('   - Tenant Name:', tenant.tenantName);
    console.log('   - Database Name:', tenant.databaseName);
    console.log('   - Is Active:', tenant.isActive);
    console.log('   - Features:', tenant.features);
    
    // 2. Check tenant settings (Dexcom/bridge configuration)
    console.log('\n2. Checking tenant settings...');
    const settings = await db.collection('tenant_settings').findOne({ 
      tenantId: tenant.tenantId 
    });
    
    if (settings) {
      console.log('✅ Tenant settings found:');
      
      // Check Dexcom bridge
      if (settings.bridge) {
        console.log('   Dexcom Bridge:');
        console.log('   - Enabled:', settings.bridge.enable);
        console.log('   - Username:', settings.bridge.userName ? '***' : 'NOT SET');
        console.log('   - Interval:', settings.bridge.interval, 'ms');
        console.log('   - Last Success:', settings.bridge.lastSuccess || 'Never');
        console.log('   - Last Failure:', settings.bridge.lastFailure || 'Never');
        console.log('   - Failure Count:', settings.bridge.failureCount || 0);
      } else {
        console.log('   ❌ No Dexcom bridge configuration');
      }
      
      // Check MiniMed Connect
      if (settings.mmconnect) {
        console.log('   MiniMed Connect:');
        console.log('   - Enabled:', settings.mmconnect.enable);
        console.log('   - Username:', settings.mmconnect.userName ? '***' : 'NOT SET');
      }
    } else {
      console.log('❌ No tenant settings found');
    }
    
    // 3. Connect to tenant database
    console.log('\n3. Checking tenant database...');
    const tenantDbName = tenant.databaseName || `nightscout-tenant-${tenant.tenantId}`;
    const tenantDb = client.db(tenantDbName);
    
    // Check collections
    const collections = await tenantDb.listCollections().toArray();
    console.log(`✅ Tenant database has ${collections.length} collections`);
    
    // 4. Check recent entries (CGM data)
    console.log('\n4. Checking recent CGM entries...');
    const entries = await tenantDb.collection('entries')
      .find({})
      .sort({ date: -1 })
      .limit(5)
      .toArray();
    
    if (entries.length > 0) {
      console.log(`✅ Found ${entries.length} recent entries:`);
      entries.forEach((entry, i) => {
        const date = new Date(entry.date);
        const age = Math.floor((Date.now() - date.getTime()) / 1000 / 60); // minutes
        console.log(`   ${i + 1}. ${date.toISOString()} - SGV: ${entry.sgv} (${age} minutes ago)`);
      });
      
      // Check if data is stale
      const latestEntry = entries[0];
      const latestDate = new Date(latestEntry.date);
      const minutesOld = Math.floor((Date.now() - latestDate.getTime()) / 1000 / 60);
      
      if (minutesOld > 10) {
        console.log(`\n   ⚠️  WARNING: Latest data is ${minutesOld} minutes old!`);
        console.log('   This suggests the data source (Dexcom/CGM) is not updating.');
      }
    } else {
      console.log('❌ No CGM entries found in tenant database');
    }
    
    // 5. Check recent treatments
    console.log('\n5. Checking recent treatments...');
    const treatments = await tenantDb.collection('treatments')
      .find({})
      .sort({ created_at: -1 })
      .limit(3)
      .toArray();
    
    if (treatments.length > 0) {
      console.log(`✅ Found ${treatments.length} recent treatments`);
    } else {
      console.log('ℹ️  No treatments found (this may be normal)');
    }
    
    // 6. Check device status
    console.log('\n6. Checking device status...');
    const devicestatus = await tenantDb.collection('devicestatus')
      .find({})
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (devicestatus.length > 0) {
      const status = devicestatus[0];
      const created = new Date(status.created_at);
      const age = Math.floor((Date.now() - created.getTime()) / 1000 / 60);
      console.log(`✅ Latest device status: ${age} minutes ago`);
      if (status.pump) {
        console.log('   - Pump data present');
      }
      if (status.uploader) {
        console.log('   - Uploader:', status.uploader.battery + '%');
      }
    } else {
      console.log('ℹ️  No device status found');
    }
    
    // 7. Check for bridge failures
    console.log('\n7. Checking for bridge errors...');
    const bridgeFailures = await db.collection('bridge_failures').find({
      tenantId: tenant.tenantId
    }).sort({ timestamp: -1 }).limit(5).toArray();
    
    if (bridgeFailures.length > 0) {
      console.log(`⚠️  Found ${bridgeFailures.length} recent bridge failures:`);
      bridgeFailures.forEach((failure, i) => {
        console.log(`   ${i + 1}. ${failure.timestamp}: ${failure.error}`);
      });
    } else {
      console.log('✅ No recent bridge failures');
    }
    
    // Summary
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    if (!tenant.isActive) {
      console.log('❌ TENANT IS INACTIVE - This is likely why no data is flowing');
    } else if (!settings || !settings.bridge || !settings.bridge.enable) {
      console.log('❌ DEXCOM BRIDGE NOT CONFIGURED - Configure in settings');
    } else if (entries.length === 0) {
      console.log('❌ NO CGM DATA - Check Dexcom credentials and connection');
    } else if (entries.length > 0) {
      const latestDate = new Date(entries[0].date);
      const minutesOld = Math.floor((Date.now() - latestDate.getTime()) / 1000 / 60);
      if (minutesOld > 10) {
        console.log(`⚠️  STALE DATA (${minutesOld} min old) - Check Dexcom connection`);
      } else {
        console.log('✅ DATA IS FLOWING NORMALLY');
      }
    }
    
  } catch (error) {
    console.error('Error during diagnosis:', error);
  } finally {
    await client.close();
    console.log('\n=== Diagnosis Complete ===');
  }
}

// Get subdomain from command line argument
const subdomain = process.argv[2] || 'arigold';
diagnoseTenantData(subdomain);