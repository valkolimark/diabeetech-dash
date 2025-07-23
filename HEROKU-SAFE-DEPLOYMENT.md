# Safe Heroku Deployment Guide for Admin Dashboard

This guide ensures the admin dashboard can be deployed without breaking your existing Nightscout app.

## 🛡️ Pre-Deployment Checklist

### 1. Revert Dangerous Changes

```bash
# Revert the Node version bypass
git checkout lib/server/bootevent-multitenant.js
git checkout lib/server/bootevent.js

# Remove admin test files
rm admin-server.js admin-server-simple.js
```

### 2. Safe Files to Deploy

✅ **SAFE to deploy:**
- `/admin-dashboard/` - React app (builds to static files)
- `/lib/api/admin/` - Admin API routes (protected by feature flags)
- `/config/features.js` - Feature flag system
- `/static/admin/` - Built admin dashboard
- `/views/admin-dashboard.html` - Admin dashboard entry point
- `/scripts/` - Utility scripts
- `setup-superadmin.js` - SuperAdmin setup script

❌ **DO NOT deploy these changes:**
- Modified `lib/server/bootevent-multitenant.js`
- Modified `lib/server/bootevent.js`
- Test files (`admin-server*.js`)

### 3. Environment Variables for Heroku

Set these AFTER deployment to control feature activation:

```bash
# Initially set to false
heroku config:set FEATURE_ADMIN_DASHBOARD=false --app your-app-name

# Other feature flags (keep disabled initially)
heroku config:set FEATURE_USER_MGMT=false --app your-app-name
heroku config:set FEATURE_TENANT_MGMT=false --app your-app-name
heroku config:set FEATURE_MONITORING=false --app your-app-name
```

## 🚀 Deployment Steps

### Step 1: Prepare for Deployment

```bash
# 1. Create a new branch for deployment
git checkout -b deploy/admin-dashboard

# 2. Revert dangerous changes
git checkout main -- lib/server/bootevent-multitenant.js
git checkout main -- lib/server/bootevent.js

# 3. Remove test files
rm -f admin-server.js admin-server-simple.js

# 4. Add safe files
git add lib/api/admin/
git add admin-dashboard/
git add config/features.js
git add static/admin/
git add views/admin-dashboard.html
git add scripts/backup-database.js
git add scripts/rollback.sh
git add setup-superadmin.js

# 5. Update package.json to include build step
```

### Step 2: Add Heroku Build Script

Add to `package.json`:

```json
{
  "scripts": {
    "heroku-postbuild": "cd admin-dashboard && npm install && npm run build || echo 'Admin dashboard build optional'"
  }
}
```

### Step 3: Deploy to Heroku

```bash
# 1. Commit changes
git commit -m "Add admin dashboard (disabled by default)"

# 2. Push to Heroku
git push heroku deploy/admin-dashboard:main

# 3. Create SuperAdmin user
heroku run node setup-superadmin.js --app your-app-name
```

### Step 4: Test Before Enabling

```bash
# 1. Verify app is still working
heroku open --app your-app-name

# 2. Check logs for errors
heroku logs --tail --app your-app-name

# 3. If everything is stable, enable admin dashboard
heroku config:set FEATURE_ADMIN_DASHBOARD=true --app your-app-name
```

## 🔄 Rollback Plan

If anything goes wrong:

```bash
# 1. Disable features immediately
heroku config:set FEATURE_ADMIN_DASHBOARD=false --app your-app-name

# 2. If still having issues, rollback the deployment
heroku rollback --app your-app-name

# 3. Check logs
heroku logs --tail --app your-app-name
```

## 📋 Post-Deployment Verification

1. **Test existing functionality:**
   - User login
   - Tenant access
   - CGM data upload
   - Regular Nightscout features

2. **Test admin dashboard (when enabled):**
   - Access `/admin`
   - Login with superadmin
   - Verify API endpoints work

## 🎯 Gradual Rollout

Use feature flags for safe rollout:

```bash
# Enable for specific beta users only
heroku config:set FEATURE_BETA_USERS=admin@example.com --app your-app-name

# Or enable for percentage of users
heroku config:set FEATURE_ROLLOUT_PERCENT=10 --app your-app-name
```

## ⚠️ Important Notes

1. **Always test in staging first** if you have a staging environment
2. **Monitor error rates** after deployment
3. **Keep feature flags disabled** until you've verified stability
4. **Have rollback plan ready** before enabling features

## 🆘 Emergency Disable

If you need to quickly disable the admin dashboard:

```bash
# Single command to disable all admin features
heroku config:set \
  FEATURE_ADMIN_DASHBOARD=false \
  FEATURE_USER_MGMT=false \
  FEATURE_TENANT_MGMT=false \
  --app your-app-name
```

---

Remember: The admin dashboard is designed to be deployed safely with feature flags OFF by default. Only enable after confirming your main app is stable!