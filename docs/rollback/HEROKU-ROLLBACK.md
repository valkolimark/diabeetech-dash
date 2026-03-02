# Heroku-Specific Rollback Procedure

This document provides Heroku-specific rollback procedures for the Nightscout multi-tenant application.

## 🚀 Heroku Rollback Methods

### Method 1: Heroku Release Rollback (Fastest)

Roll back to a previous release using Heroku's built-in rollback:

```bash
# List recent releases
heroku releases --app your-app-name

# Rollback to a specific release
heroku rollback v142 --app your-app-name

# Or rollback to the previous release
heroku rollback --app your-app-name
```

### Method 2: Git-based Rollback

If you need to rollback code changes:

```bash
# 1. Find the commit to rollback to
git log --oneline -10

# 2. Force push to Heroku
git push heroku <commit-hash>:main --force

# Or using a tag
git push heroku v1.0-stable-pre-admin:main --force
```

## 📊 Database Rollback on Heroku

### Using Heroku Postgres Backups

```bash
# List available backups
heroku pg:backups --app your-app-name

# Create a manual backup before changes
heroku pg:backups:capture --app your-app-name

# Restore from a backup
heroku pg:backups:restore b001 DATABASE_URL --app your-app-name --confirm your-app-name
```

### Using MongoDB Atlas (if applicable)

1. Log into MongoDB Atlas
2. Navigate to your cluster
3. Click "Backup" → "Snapshots"
4. Select snapshot before admin changes
5. Click "Restore" → "Replace existing cluster"

## 🔧 Environment Variable Rollback

### Save Current Configuration
```bash
# Export current config
heroku config --app your-app-name -s > heroku-config-backup.txt

# Save specific vars
heroku config:get FEATURE_ADMIN_DASHBOARD --app your-app-name
```

### Disable Features via Config
```bash
# Quick disable admin features
heroku config:set FEATURE_ADMIN_DASHBOARD=false --app your-app-name

# Bulk disable all features
heroku config:set \
  FEATURE_ADMIN_DASHBOARD=false \
  FEATURE_USER_MGMT=false \
  FEATURE_TENANT_MGMT=false \
  FEATURE_MONITORING=false \
  --app your-app-name
```

### Restore Previous Configuration
```bash
# Restore from backup file
cat heroku-config-backup.txt | xargs heroku config:set --app your-app-name
```

## 📋 Heroku-Specific Rollback Checklist

### Pre-Deployment
- [ ] Enable Heroku maintenance mode: `heroku maintenance:on --app your-app-name`
- [ ] Create database backup: `heroku pg:backups:capture --app your-app-name`
- [ ] Export config vars: `heroku config -s > backup-config.txt`
- [ ] Note current release: `heroku releases --app your-app-name`

### During Rollback
- [ ] Check application logs: `heroku logs --tail --app your-app-name`
- [ ] Monitor metrics: `heroku metrics --app your-app-name`
- [ ] Verify dyno status: `heroku ps --app your-app-name`

### Post-Rollback
- [ ] Disable maintenance mode: `heroku maintenance:off --app your-app-name`
- [ ] Run health checks
- [ ] Verify user access
- [ ] Check error rates in logs

## 🚨 Emergency Rollback Script

Create `heroku-rollback.sh`:

```bash
#!/bin/bash

APP_NAME="your-app-name"

echo "🚨 EMERGENCY ROLLBACK FOR $APP_NAME"
echo "===================================="

# Enable maintenance mode
echo "1️⃣ Enabling maintenance mode..."
heroku maintenance:on --app $APP_NAME

# Show recent releases
echo "2️⃣ Recent releases:"
heroku releases --app $APP_NAME | head -10

# Rollback
echo "3️⃣ Rolling back to previous release..."
heroku rollback --app $APP_NAME

# Disable problem features
echo "4️⃣ Disabling admin features..."
heroku config:set FEATURE_ADMIN_DASHBOARD=false --app $APP_NAME

# Check status
echo "5️⃣ Checking application status..."
heroku ps --app $APP_NAME

# Disable maintenance mode
echo "6️⃣ Disabling maintenance mode..."
heroku maintenance:off --app $APP_NAME

echo "✅ Emergency rollback completed!"
echo ""
echo "Next steps:"
echo "- Check logs: heroku logs --tail --app $APP_NAME"
echo "- Verify app: heroku open --app $APP_NAME"
```

## 🔍 Monitoring During Rollback

### Real-time Logs
```bash
# Stream all logs
heroku logs --tail --app your-app-name

# Filter for errors
heroku logs --tail --app your-app-name | grep ERROR

# Check specific dyno
heroku logs --tail --dyno web.1 --app your-app-name
```

### Application Metrics
```bash
# View metrics dashboard
heroku metrics --app your-app-name

# Check dyno load
heroku ps --app your-app-name
```

## 🛡️ Preventing Future Issues

### Use Review Apps
```bash
# Enable review apps for PRs
heroku reviewapps:enable --app your-app-name

# Test changes in review app first
git push origin feature/admin-dashboard
# Creates: your-app-name-pr-123.herokuapp.com
```

### Staging Environment
```bash
# Create staging app
heroku create your-app-name-staging

# Deploy to staging first
git push staging main

# Promote to production after testing
heroku pipelines:promote --app your-app-name-staging
```

## 📝 Heroku-Specific Notes

1. **Dyno Restart**: After config changes, dynos automatically restart
2. **Build Cache**: Clear if needed: `heroku builds:cache:purge --app your-app-name`
3. **Add-ons**: Check add-on status after rollback
4. **SSL**: Verify SSL certificates are still valid
5. **Custom Domains**: Ensure DNS still points correctly

## 🆘 Heroku Support

If rollback fails:
1. Open support ticket: `heroku support:tickets:create`
2. Check status page: https://status.heroku.com
3. Join Heroku Dev Center: https://devcenter.heroku.com

---

Remember: Always test rollback procedures in a staging environment first!