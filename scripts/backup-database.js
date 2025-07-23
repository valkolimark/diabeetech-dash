#!/usr/bin/env node

/**
 * Database Backup Script for Diabeetech Multi-tenant
 * Creates a complete backup of the MongoDB database before making changes
 * 
 * Usage: node scripts/backup-database.js [backup-name]
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Load environment variables
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nightscout';
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const backupName = process.argv[2] || `backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;

async function ensureBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
}

async function backupWithMongodump() {
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  try {
    console.log('🔄 Starting database backup with mongodump...');
    
    // Parse MongoDB URI to get database name
    const dbName = MONGODB_URI.split('/').pop().split('?')[0];
    
    const command = `mongodump --uri="${MONGODB_URI}" --out="${backupPath}"`;
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('done dumping')) {
      console.error('⚠️  Mongodump warnings:', stderr);
    }
    
    console.log(`✅ Database backed up to: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('❌ Mongodump failed:', error.message);
    console.log('🔄 Falling back to manual backup...');
    return null;
  }
}

async function backupManually() {
  const client = new MongoClient(MONGODB_URI);
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    
    // Create metadata file
    const metadata = {
      timestamp: new Date().toISOString(),
      database: db.databaseName,
      collections: collections.map(c => c.name),
      version: process.version,
      mongodbUri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@') // Hide credentials
    };
    
    fs.writeFileSync(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Backup each collection
    for (const collInfo of collections) {
      const collName = collInfo.name;
      console.log(`📁 Backing up collection: ${collName}`);
      
      const collection = db.collection(collName);
      const documents = await collection.find({}).toArray();
      
      const filePath = path.join(backupPath, `${collName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
      
      console.log(`  ✅ Saved ${documents.length} documents`);
    }
    
    // Create restore script
    const restoreScript = `#!/usr/bin/env node
// Auto-generated restore script for backup: ${backupName}
// Run: node restore.js

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || '${MONGODB_URI}';

async function restore() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    const metadata = JSON.parse(fs.readFileSync('./metadata.json', 'utf8'));
    
    console.log('🔄 Starting restore from backup:', metadata.timestamp);
    
    for (const collName of metadata.collections) {
      console.log(\`📁 Restoring collection: \${collName}\`);
      
      const data = JSON.parse(fs.readFileSync(\`./\${collName}.json\`, 'utf8'));
      
      if (data.length > 0) {
        await db.collection(collName).deleteMany({});
        await db.collection(collName).insertMany(data);
        console.log(\`  ✅ Restored \${data.length} documents\`);
      }
    }
    
    console.log('✅ Restore completed successfully!');
  } catch (error) {
    console.error('❌ Restore failed:', error);
  } finally {
    await client.close();
  }
}

restore();
`;
    
    fs.writeFileSync(path.join(backupPath, 'restore.js'), restoreScript);
    fs.chmodSync(path.join(backupPath, 'restore.js'), '755');
    
    console.log(`✅ Manual backup completed: ${backupPath}`);
    return backupPath;
    
  } catch (error) {
    console.error('❌ Manual backup failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

async function createBackupInfo(backupPath) {
  const info = {
    name: backupName,
    path: backupPath,
    timestamp: new Date().toISOString(),
    size: getDirectorySize(backupPath),
    type: backupPath.includes('dump') ? 'mongodump' : 'manual',
    gitCommit: await getGitCommit(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      mongodbUri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')
    }
  };
  
  const infoPath = path.join(BACKUP_DIR, 'backup-log.json');
  let backupLog = [];
  
  if (fs.existsSync(infoPath)) {
    backupLog = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  }
  
  backupLog.push(info);
  fs.writeFileSync(infoPath, JSON.stringify(backupLog, null, 2));
  
  return info;
}

async function getGitCommit() {
  try {
    const { stdout } = await execPromise('git rev-parse HEAD');
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

function getDirectorySize(dir) {
  let size = 0;
  
  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath);
      } else {
        size += stat.size;
      }
    }
  }
  
  walk(dir);
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  try {
    console.log('🚀 Diabeetech Database Backup Tool');
    console.log('==================================');
    
    await ensureBackupDirectory();
    
    // Try mongodump first, fall back to manual if it fails
    let backupPath = await backupWithMongodump();
    if (!backupPath) {
      backupPath = await backupManually();
    }
    
    const backupInfo = await createBackupInfo(backupPath);
    
    console.log('\n📊 Backup Summary:');
    console.log(`  Name: ${backupInfo.name}`);
    console.log(`  Path: ${backupInfo.path}`);
    console.log(`  Size: ${backupInfo.size}`);
    console.log(`  Type: ${backupInfo.type}`);
    console.log(`  Commit: ${backupInfo.gitCommit}`);
    
    console.log('\n✅ Backup completed successfully!');
    console.log(`\n💡 To restore from this backup:`);
    console.log(`   cd ${backupPath}`);
    console.log(`   node restore.js`);
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { backupWithMongodump, backupManually, createBackupInfo };