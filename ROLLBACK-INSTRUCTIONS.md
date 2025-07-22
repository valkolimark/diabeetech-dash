# Rollback Instructions for Registration API Deployment

## Current State Before Deployment
- **Release Version**: v170
- **Last Commit**: d9ad83c0
- **Deployment Time**: 2025/07/22 12:07:27 -0500

## What's Being Deployed
- hCaptcha integration for registration
- Rate limiting middleware
- Settings cloning from reference tenant
- Enhanced registration API
- Updated registration form

## Rollback Commands

If the deployment causes issues, use these commands to rollback:

### Option 1: Rollback to Previous Release (Fastest)
```bash
heroku rollback v170 --app btech
```

### Option 2: Rollback Using Git
```bash
# Revert to previous commit
git reset --hard d9ad83c0

# Force push to Heroku
git push heroku feat/restrict-admin-to-tenants:main --force
```

### Option 3: Disable Features via Config
If only specific features are problematic:
```bash
# Disable captcha
heroku config:set HCAPTCHA_ENABLED=false --app btech

# Disable rate limiting
heroku config:set RATE_LIMIT_ENABLED=false --app btech
```

## Monitoring After Deployment

Check these after deployment:
1. Registration page loads: https://btech-d038118b5224.herokuapp.com/register
2. API endpoint responds: https://btech-d038118b5224.herokuapp.com/api/register/check-username/test
3. Check logs: `heroku logs --tail --app btech`

## Known Safe Configuration
The features are currently disabled by default:
- HCAPTCHA_ENABLED=false
- Rate limiting will work immediately

This deployment should be safe as the new features are opt-in.