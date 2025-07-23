# Diabeetech Multi-tenant Rollback Procedure

This document outlines the rollback procedures to safely revert changes if issues arise during the admin dashboard implementation.

## 🛡️ Pre-Implementation Safety Measures

### 1. Create Database Backup
```bash
# Create a timestamped backup before any changes
node scripts/backup-database.js pre-admin-dashboard

# Verify backup was created
ls -la backups/
```

### 2. Tag Current Stable Version
```bash
# Create a git tag for the current working version
git tag -a v1.0-stable-pre-admin -m "Stable version before admin dashboard implementation"
git push origin v1.0-stable-pre-admin
```

### 3. Document Current State
Create a snapshot of current configurations:
```bash
# Save current environment variables
cp .env .env.backup-$(date +%Y%m%d)

# Document current package versions
npm list --depth=0 > package-versions-backup.txt

# Save current database schema
node scripts/document-schema.js > schema-backup-$(date +%Y%m%d).json
```

## 🔄 Rollback Procedures

### Level 1: Code Rollback (No Database Changes)

If only code changes were made and no database migrations were run:

```bash
# 1. Stash or discard current changes
git stash save "Admin dashboard WIP"

# 2. Checkout stable tag
git checkout v1.0-stable-pre-admin

# 3. Reinstall dependencies
npm ci

# 4. Restart application
npm run start
```

### Level 2: Database Rollback (Schema Changes)

If database schema was modified:

```bash
# 1. Stop the application
npm run stop

# 2. Restore database from backup
cd backups/pre-admin-dashboard
node restore.js

# 3. Revert code changes
git checkout v1.0-stable-pre-admin

# 4. Restore environment variables
cp .env.backup-[date] .env

# 5. Restart application
npm run start
```

### Level 3: Full System Rollback

For complete system restoration:

```bash
# 1. Stop all services
docker-compose down  # if using Docker
npm run stop         # if running directly

# 2. Restore database
mongorestore --uri=$MONGODB_URI --drop backups/pre-admin-dashboard

# 3. Reset to stable git tag
git fetch --all
git reset --hard v1.0-stable-pre-admin

# 4. Clean and reinstall
rm -rf node_modules
npm ci

# 5. Restore configurations
cp .env.backup-[date] .env

# 6. Restart services
npm run start
```

## 🎯 Feature Flag Implementation

To minimize rollback needs, implement feature flags:

### 1. Create Feature Flag Configuration
```javascript
// config/features.js
module.exports = {
  adminDashboard: {
    enabled: process.env.FEATURE_ADMIN_DASHBOARD === 'true',
    superAdminOnly: true,
    features: {
      userManagement: process.env.FEATURE_USER_MGMT === 'true',
      tenantManagement: process.env.FEATURE_TENANT_MGMT === 'true',
      systemMonitoring: process.env.FEATURE_MONITORING === 'true',
      billing: process.env.FEATURE_BILLING === 'true'
    }
  }
};
```

### 2. Environment Variable Control
```bash
# .env file
FEATURE_ADMIN_DASHBOARD=false
FEATURE_USER_MGMT=false
FEATURE_TENANT_MGMT=false
FEATURE_MONITORING=false
FEATURE_BILLING=false
```

### 3. Quick Feature Toggle
```bash
# Disable admin dashboard without code changes
export FEATURE_ADMIN_DASHBOARD=false
npm run restart
```

## 📋 Rollback Checklist

Before declaring rollback complete:

- [ ] Application starts without errors
- [ ] User authentication works
- [ ] Existing tenants can access their data
- [ ] CGM data upload/retrieval functions
- [ ] API endpoints respond correctly
- [ ] No database connection errors
- [ ] Monitoring shows normal metrics

## 🚨 Emergency Contacts

Document key contacts for emergency support:

- **Database Admin**: [Contact Info]
- **DevOps Lead**: [Contact Info]
- **Project Manager**: [Contact Info]
- **On-Call Engineer**: [Contact Info]

## 📊 Rollback Testing

### Test Rollback Procedure
```bash
# 1. Create test environment
cp -r . ../nightscout-rollback-test
cd ../nightscout-rollback-test

# 2. Make intentional breaking change
echo "break" > break-test.js

# 3. Execute rollback
./scripts/rollback.sh

# 4. Verify restoration
npm test
```

## 🔍 Monitoring During Rollback

Monitor these metrics during rollback:
- Database connection pool
- API response times
- Error rates
- User login success rate
- Memory usage
- CPU utilization

## 📝 Post-Rollback Actions

1. **Document Issues**: Record what triggered the rollback
2. **Analyze Logs**: Collect error logs from the failed deployment
3. **Update Tests**: Add tests to prevent similar issues
4. **Communicate**: Notify stakeholders of status
5. **Plan Fix**: Schedule resolution for identified issues

## 🛠️ Automated Rollback Script

Create `scripts/rollback.sh`:
```bash
#!/bin/bash

echo "🔄 Starting Nightscout Rollback Procedure"

# Check if backup name provided
if [ -z "$1" ]; then
    echo "Usage: ./rollback.sh <backup-name>"
    echo "Available backups:"
    ls -1 backups/
    exit 1
fi

BACKUP_NAME=$1

# Confirm rollback
read -p "⚠️  This will rollback to backup: $BACKUP_NAME. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 1
fi

# Execute rollback
echo "1️⃣  Stopping application..."
npm run stop || true

echo "2️⃣  Restoring database..."
cd backups/$BACKUP_NAME && node restore.js && cd ../..

echo "3️⃣  Reverting code..."
git checkout v1.0-stable-pre-admin

echo "4️⃣  Restoring dependencies..."
npm ci

echo "5️⃣  Starting application..."
npm run start

echo "✅ Rollback completed!"
```

Make executable:
```bash
chmod +x scripts/rollback.sh
```

## 🎯 Success Criteria

Rollback is successful when:
1. All users can log in normally
2. Tenant data is accessible and accurate
3. No error spikes in monitoring
4. Database queries perform normally
5. All critical features functional

---

**Remember**: Always test rollback procedures in a staging environment before relying on them in production!