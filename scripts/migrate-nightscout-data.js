#!/usr/bin/env node
'use strict';

/**
 * Diabeetech Data Migration Script
 * Migrates data from a single-tenant Diabeetech instance to multi-tenant
 * 
 * Usage: node migrate-nightscout-data.js <source-mongo-uri> <tenant-subdomain> [options]
 * 
 * Options:
 *   --days <number>    Number of days of data to migrate (default: 30)
 *   --all              Migrate all data (overrides --days)
 *   --dry-run          Show what would be migrated without actually doing it
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

async function migrate() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node migrate-nightscout-data.js <source-mongo-uri> <tenant-subdomain> [options]');
    console.error('Example: node migrate-nightscout-data.js "mongodb://source.com/nightscout" clinic1 --days 30');
    process.exit(1);
  }
  
  const sourceUri = args[0];
  const tenantSubdomain = args[1];
  
  // Parse options
  const options = {
    days: 30,
    all: false,
    dryRun: false
  };
  
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      options.days = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--all') {
      options.all = true;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }
  
  console.log('Migration options:', options);
  
  // Target database configuration from environment
  const targetUri = process.env.MONGODB_URI;
  
  if (!targetUri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }
  
  // Connect to both databases
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  
  try {
    console.log('Connecting to source database...');
    await sourceClient.connect();
    const sourceDb = sourceClient.db();
    
    console.log('Connecting to target database...');
    await targetClient.connect();
    const masterDb = targetClient.db();
    
    // Find the tenant
    const tenantsCollection = masterDb.collection('tenants');
    const tenant = await tenantsCollection.findOne({ subdomain: tenantSubdomain });
    
    if (!tenant) {
      throw new Error(`Tenant with subdomain '${tenantSubdomain}' not found`);
    }
    
    console.log(`Found tenant: ${tenant.name} (${tenant.tenantId})`);
    
    // Connect to tenant database
    const tenantDbName = tenant.databaseName || `nightscout-tenant-${tenantSubdomain}`;
    const tenantDb = targetClient.db(tenantDbName);
    
    // Calculate date filter
    let dateFilter = {};
    if (!options.all) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.days);
      dateFilter = { 
        $or: [
          { date: { $gte: cutoffDate.getTime() } },
          { created_at: { $gte: cutoffDate.toISOString() } },
          { createdAt: { $gte: cutoffDate } }
        ]
      };
      console.log(`Migrating data from last ${options.days} days (since ${cutoffDate.toISOString()})`);
    } else {
      console.log('Migrating all data');
    }
    
    // Collections to migrate
    const collections = [
      {
        name: 'entries',
        transform: (doc) => ({
          ...doc,
          tenantId: tenant.tenantId,
          migratedAt: new Date()
        })
      },
      {
        name: 'treatments',
        transform: (doc) => ({
          ...doc,
          tenantId: tenant.tenantId,
          migratedAt: new Date()
        })
      },
      {
        name: 'devicestatus',
        transform: (doc) => ({
          ...doc,
          tenantId: tenant.tenantId,
          migratedAt: new Date()
        })
      },
      {
        name: 'profile',
        transform: (doc) => ({
          ...doc,
          tenantId: tenant.tenantId,
          migratedAt: new Date()
        })
      },
      {
        name: 'food',
        transform: (doc) => ({
          ...doc,
          tenantId: tenant.tenantId,
          migratedAt: new Date()
        })
      },
      {
        name: 'activity',
        transform: (doc) => ({
          ...doc,
          tenantId: tenant.tenantId,
          migratedAt: new Date()
        })
      }
    ];
    
    // Migrate each collection
    for (const collection of collections) {
      console.log(`\nMigrating ${collection.name}...`);
      
      try {
        const sourceCollection = sourceDb.collection(collection.name);
        const targetCollection = tenantDb.collection(collection.name);
        
        // Count documents
        const filter = collection.name === 'profile' || collection.name === 'food' ? {} : dateFilter;
        const count = await sourceCollection.countDocuments(filter);
        console.log(`Found ${count} documents to migrate`);
        
        if (count === 0) {
          console.log(`No documents found in ${collection.name}`);
          continue;
        }
        
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate ${count} documents from ${collection.name}`);
          
          // Show sample document
          const sample = await sourceCollection.findOne(filter);
          if (sample) {
            console.log('Sample document:', JSON.stringify(collection.transform(sample), null, 2));
          }
          continue;
        }
        
        // Migrate in batches
        const batchSize = 1000;
        let migrated = 0;
        
        const cursor = sourceCollection.find(filter);
        
        while (await cursor.hasNext()) {
          const batch = [];
          
          for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
            const doc = await cursor.next();
            batch.push(collection.transform(doc));
          }
          
          if (batch.length > 0) {
            await targetCollection.insertMany(batch, { ordered: false });
            migrated += batch.length;
            console.log(`Migrated ${migrated}/${count} documents...`);
          }
        }
        
        console.log(`✓ Migrated ${migrated} documents from ${collection.name}`);
        
      } catch (err) {
        console.error(`Error migrating ${collection.name}:`, err.message);
      }
    }
    
    // Create indexes
    if (!options.dryRun) {
      console.log('\nCreating indexes...');
      
      await tenantDb.collection('entries').createIndex({ date: -1 });
      await tenantDb.collection('entries').createIndex({ dateString: -1 });
      await tenantDb.collection('treatments').createIndex({ created_at: -1 });
      await tenantDb.collection('treatments').createIndex({ eventType: 1 });
      await tenantDb.collection('devicestatus').createIndex({ created_at: -1 });
      
      console.log('✓ Indexes created');
    }
    
    // Create a default user for the migrated data
    if (!options.dryRun) {
      console.log('\nCreating default user...');
      
      const usersCollection = tenantDb.collection('users');
      const existingUser = await usersCollection.findOne({ email: 'admin@' + tenantSubdomain + '.local' });
      
      if (!existingUser) {
        const bcrypt = require('bcryptjs');
        const defaultPassword = crypto.randomBytes(12).toString('hex');
        
        await usersCollection.insertOne({
          userId: crypto.randomUUID(),
          tenantId: tenant.tenantId,
          email: 'admin@' + tenantSubdomain + '.local',
          passwordHash: await bcrypt.hash(defaultPassword, 10),
          role: 'admin',
          isActive: true,
          profile: {
            displayName: 'Migrated Admin',
            timezone: 'UTC'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log('✓ Created admin user:');
        console.log(`  Email: admin@${tenantSubdomain}.local`);
        console.log(`  Password: ${defaultPassword}`);
        console.log('  (Please change this password after first login)');
      }
    }
    
    console.log('\n✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

// Run migration
migrate().catch(console.error);