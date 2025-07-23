# Heroku Rollback Procedure for Nightscout Multi-Tenant

## Current Deployment Status
- **Current Release**: v183 (deployed on 2025-07-23)
- **Previous Stable**: v182
- **App Name**: btech
- **Branch**: feat/restrict-admin-to-tenants

## Quick Rollback Command
If you need to rollback to the previous release:
```bash
heroku rollback -a btech
```

## Detailed Rollback Steps

### 1. Check Current Release
```bash
heroku releases -a btech
```

### 2. Rollback to Specific Version
```bash
# Rollback to v182 (previous stable)
heroku rollback v182 -a btech

# Or rollback to any specific version
heroku rollback v[VERSION_NUMBER] -a btech
```

### 3. Verify Rollback
```bash
# Check release status
heroku releases -a btech

# Test API access
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=1" \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
    -H "Accept: application/json"

# Check web access
curl -s -o /dev/null -w "%{http_code}" https://onepanman.diabeetech.net/
```

### 4. Monitor Logs
```bash
heroku logs --tail -a btech
```

## Git-Based Deployment Rollback
If you need to deploy a previous git commit:
```bash
# Find the commit you want to deploy
git log --oneline -10

# Deploy specific commit
git push heroku [COMMIT_SHA]:main --force

# Example:
git push heroku 3191c73:main --force
```

## Important Notes
- Heroku keeps the last 300 releases for rollback
- Rollback does NOT affect:
  - Environment variables
  - Add-ons
  - Database data (MongoDB Atlas)
- Rollback DOES revert:
  - Application code
  - Dependencies (package.json)
  - Build artifacts

## Emergency Contacts
- MongoDB Atlas: Check connection status in Atlas dashboard
- Domain: diabeetech.net (custom domain routing)
- SSL: Managed automatically by Heroku

## Post-Rollback Checklist
- [ ] Verify API authentication works
- [ ] Check tenant subdomain resolution
- [ ] Test data upload from devices
- [ ] Confirm web interface loads
- [ ] Monitor error logs for 5-10 minutes