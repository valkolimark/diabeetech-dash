# Heroku-Compliant Admin Dashboard Deployment Guide

This guide ensures the admin dashboard deployment complies with Heroku's ephemeral filesystem and platform requirements.

## 🚨 Heroku Filesystem Considerations

### Key Constraints:
1. **Ephemeral filesystem** - Files written at runtime are lost on dyno restart
2. **Read-only slug** - Cannot write to application directories after build
3. **Build happens during deployment** - All compilation must occur in build phase
4. **No persistent storage** - Must use external services (MongoDB Atlas, S3, etc.)

## 📁 Heroku-Safe File Structure

```
nightscout/
├── admin-dashboard/          # ✅ Source files (built during deployment)
│   ├── src/                 
│   ├── package.json         
│   └── webpack.config.js    
├── lib/
│   └── api/
│       └── admin/           # ✅ API routes (no filesystem writes)
├── static/
│   └── admin/               # ✅ Build output (created during build)
├── views/
│   └── admin-dashboard.html # ✅ Static template
└── package.json             # ✅ With heroku-postbuild script
```

## 🔧 Heroku-Specific Configuration

### 1. Update package.json for Heroku Build

```json
{
  "scripts": {
    "start": "node lib/server/server.js",
    "heroku-postbuild": "npm run build:admin || echo 'Admin build optional'",
    "build:admin": "cd admin-dashboard && npm install --production=false && npm run build && cd .."
  },
  "engines": {
    "node": "20.x",
    "npm": "10.x"
  }
}
```

### 2. Update webpack.config.js for Heroku

```javascript
// admin-dashboard/webpack.config.js
const path = require('path');

module.exports = {
  output: {
    // Ensure output goes to the correct location
    path: path.resolve(__dirname, '../static/admin'),
    filename: 'js/bundle.[contenthash].js',
    clean: true // Clean directory before build
  },
  // ... rest of config
};
```

### 3. Environment Variables for Heroku

```bash
# Required MongoDB (use MongoDB Atlas for Heroku)
heroku config:set MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/nightscout" --app your-app-name

# Feature flags (disabled by default)
heroku config:set FEATURE_ADMIN_DASHBOARD=false --app your-app-name
heroku config:set FEATURE_USER_MGMT=false --app your-app-name
heroku config:set FEATURE_TENANT_MGMT=false --app your-app-name

# Node environment
heroku config:set NODE_ENV=production --app your-app-name
heroku config:set NPM_CONFIG_PRODUCTION=false --app your-app-name
```

## 🚀 Deployment Process

### Step 1: Prepare Repository

```bash
# 1. Remove files that write to filesystem at runtime
rm -f scripts/backup-database.js  # Would fail on Heroku
rm -f admin-server*.js            # Not needed
rm -rf backups/                   # Can't write backups on Heroku

# 2. Update .gitignore
echo "static/admin/js/*" >> .gitignore
echo "!static/admin/js/.gitkeep" >> .gitignore

# 3. Create placeholder for build directory
mkdir -p static/admin/js
touch static/admin/js/.gitkeep
git add static/admin/js/.gitkeep
```

### Step 2: Add Heroku-Specific Scripts

Create `scripts/heroku-setup.js`:

```javascript
// scripts/heroku-setup.js
const { MongoClient } = require('mongodb');

// This runs on Heroku after deployment
async function setupHeroku() {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Create indexes
    await db.collection('admin_audit').createIndex({ timestamp: -1 });
    await db.collection('admin_audit').createIndex({ user: 1 });
    
    console.log('✅ Heroku setup complete');
  } catch (error) {
    console.error('Setup failed:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  setupHeroku();
}
```

### Step 3: Create Procfile

```
web: node lib/server/server.js
release: node scripts/heroku-setup.js
```

### Step 4: Deploy to Heroku

```bash
# 1. Add Heroku remote if not exists
heroku git:remote -a your-app-name

# 2. Set buildpacks
heroku buildpacks:set heroku/nodejs --app your-app-name

# 3. Deploy
git add .
git commit -m "Add admin dashboard (Heroku-compliant)"
git push heroku main

# 4. Run one-time setup
heroku run node setup-superadmin.js --app your-app-name
```

## 🔍 Heroku-Specific Verifications

### Check Build Success
```bash
heroku builds:info --app your-app-name
```

### Monitor Logs
```bash
heroku logs --tail --app your-app-name | grep -E "(admin|dashboard)"
```

### Verify Memory Usage
```bash
heroku ps --app your-app-name
```

## ⚠️ Heroku Limitations & Solutions

### 1. File Uploads
**Problem:** Can't store uploaded files on Heroku
**Solution:** Use S3 or Cloudinary for file storage

### 2. Database Backups
**Problem:** Can't write backup files locally
**Solution:** Use MongoDB Atlas automated backups or Heroku Postgres backups

### 3. Logs
**Problem:** Heroku only keeps recent logs
**Solution:** Use Papertrail or Loggly add-on:
```bash
heroku addons:create papertrail --app your-app-name
```

### 4. Session Storage
**Problem:** In-memory sessions lost on restart
**Solution:** Already using MongoDB for sessions (cookies)

## 🏗️ Build Optimization for Heroku

### 1. Reduce Slug Size
```bash
# Check current slug size
heroku apps:info --app your-app-name

# Add .slugignore file
echo "admin-dashboard/node_modules" > .slugignore
echo "admin-dashboard/src" >> .slugignore
echo "*.md" >> .slugignore
echo "docs/" >> .slugignore
```

### 2. Cache Dependencies
Heroku automatically caches `node_modules` between builds.

### 3. Production Build Only
```javascript
// webpack.config.js
module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  // ... rest of config
};
```

## 🚨 Emergency Procedures

### Quick Disable
```bash
# Disable admin features without redeployment
heroku config:set FEATURE_ADMIN_DASHBOARD=false --app your-app-name
heroku ps:restart --app your-app-name
```

### Rollback Deployment
```bash
heroku releases --app your-app-name
heroku rollback v123 --app your-app-name
```

### Scale Down if Issues
```bash
heroku ps:scale web=0 --app your-app-name  # Stop
heroku ps:scale web=1 --app your-app-name  # Restart
```

## ✅ Heroku Deployment Checklist

- [ ] MongoDB Atlas connection string configured
- [ ] Environment variables set (features disabled)
- [ ] package.json has heroku-postbuild script
- [ ] No filesystem writes in application code
- [ ] Build process creates all needed files
- [ ] .slugignore configured to reduce size
- [ ] Procfile created with web process
- [ ] Node version specified in package.json
- [ ] All paths use `path.join(__dirname, ...)` for portability

## 📊 Post-Deployment Monitoring

```bash
# Check metrics
heroku metrics --app your-app-name

# Check dyno status
heroku ps --app your-app-name

# View recent errors
heroku logs --tail --app your-app-name | grep ERROR
```

---

This deployment is fully Heroku-compliant with no filesystem dependencies and proper build configuration!