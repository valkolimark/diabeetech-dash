# Global API_SECRET Fix for All Tenants

## Summary
This fix ensures all current and future tenants have API_SECRET authentication enabled.

## Changes Made

### 1. Auto-generate API_SECRET for new tenants
Modified `lib/models/tenant.js` to automatically generate a random 32-character API_SECRET when creating new tenants if one isn't provided.

### 2. Include API_SECRET in registration response
Updated `lib/api/tenants/register-enhanced.js` to return the API_SECRET and its hash in the registration response so new users can immediately use it for device integrations.

## Deployment Steps

### Step 1: Deploy the updated code
```bash
git add .
git commit -m "feat: Auto-generate API_SECRET for all new tenants"
git push heroku feat/restrict-admin-to-tenants:main
```

### Step 2: Add API_SECRET to ALL existing tenants
```bash
# This generates random API secrets for all tenants that don't have one
heroku run node scripts/add-tenant-api-secret.js --generate-random --app=your-heroku-app-name
```

### Step 3: Fix the JWT login issue
Check logs to debug the 500 error:
```bash
heroku logs --tail --app=your-heroku-app-name
```

## What This Fixes

### For Existing Tenants:
- All tenants will get a unique API_SECRET
- Each tenant can use their API_SECRET for device integrations
- No manual intervention needed per tenant

### For New Tenants:
- API_SECRET is automatically generated during registration
- Returned in the registration response for immediate use
- No additional configuration needed

## API_SECRET Usage

Each tenant can authenticate using their API_SECRET in two ways:

1. **Header**: `api-secret: <plain-text-or-sha1-hash>`
2. **Query**: `?secret=<plain-text-or-sha1-hash>`

## Security Notes

- Each tenant's API_SECRET only grants access to their own data
- API_SECRETs are stored as SHA-1 hashes in the database
- The plain text is only shown once during registration (for new tenants)
- For existing tenants, the migration script will display the generated secrets

## Rollback Plan

If issues occur:
```bash
# Rollback to previous release
heroku rollback --app=your-heroku-app-name
```

The changes are non-breaking - existing authentication methods continue to work.