# Deployment Guide: Tenant-Specific API_SECRET Support

## Overview
This deployment adds support for tenant-specific API_SECRET authentication to the multi-tenant Nightscout instance. Each tenant can have their own API_SECRET for device integration and API access.

## Changes Made
1. **Tenant Model** (`lib/models/tenant.js`)
   - Added `apiSecret` and `apiSecretHash` fields to tenant schema
   - Added methods to hash and validate API secrets
   - Added `updateApiSecret` method for setting/updating secrets

2. **Auth Middleware** (`lib/middleware/auth.js`)
   - Modified `checkLegacyAuth` to check tenant-specific API secrets
   - Maintains backward compatibility with master API_SECRET

3. **Enclave Module** (`lib/server/enclave.js`)
   - Fixed typo in `isApiKeySet` method

4. **Migration Script** (`scripts/add-tenant-api-secret.js`)
   - Safe migration script to add API_SECRET to existing tenants
   - Can be run multiple times without issues

5. **Test Script** (`scripts/test-tenant-api-secret.js`)
   - Comprehensive test suite for API authentication

## Deployment Steps

### 1. Test Locally First
```bash
# Run tests on your local environment
npm test

# Test the migration script
node scripts/add-tenant-api-secret.js --subdomain=test --secret="test-secret"

# Run the API authentication tests
node scripts/test-tenant-api-secret.js
```

### 2. Deploy to Heroku (Staging First if Available)
```bash
# Commit changes
git add .
git commit -m "feat: Add tenant-specific API_SECRET authentication support"

# If you have a staging environment, deploy there first
git push heroku-staging feat/restrict-admin-to-tenants:main

# Otherwise, deploy to production
git push heroku feat/restrict-admin-to-tenants:main
```

### 3. Run Migration on Heroku
```bash
# For the onepanman tenant specifically
heroku run node scripts/add-tenant-api-secret.js --subdomain=onepanman --secret="GodIsSoGood2Me23!" --app your-app-name

# Or to check what would happen without making changes
heroku run node scripts/add-tenant-api-secret.js --app your-app-name
```

### 4. Verify Deployment
```bash
# Test API access with the new authentication
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3" \
     -H "api-secret: 5a9baf88e82b6b171ed3e3a962ed7dc2c10eaad9"

# Test JWT authentication still works
curl -X POST https://onepanman.diabeetech.net/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "mark@markmireles.com", "password": "GodIsGood23!"}'
```

## Rollback Plan

If issues occur, you can quickly rollback:

### Option 1: Heroku Rollback (Recommended)
```bash
# View releases
heroku releases --app your-app-name

# Rollback to previous release
heroku rollback --app your-app-name
```

### Option 2: Git Revert
```bash
# Create a revert commit
git revert HEAD
git push heroku main
```

### Option 3: Disable Feature Without Rollback
The auth middleware maintains backward compatibility. If tenant API_SECRET causes issues:
1. Simply don't run the migration script
2. Existing JWT authentication will continue to work
3. The code checks for apiSecretHash existence before validating

## Feature Behavior

### With API_SECRET Set for Tenant
- API accepts both JWT tokens and API_SECRET
- API_SECRET can be provided as:
  - Header: `api-secret: YOUR_SECRET` or `api-secret: SHA1_HASH`
  - Query: `?secret=YOUR_SECRET` or `?secret=SHA1_HASH`
- Each tenant has isolated API_SECRET

### Without API_SECRET Set
- JWT authentication continues to work normally
- Master API_SECRET (if set) still works
- No breaking changes to existing functionality

## Monitoring

After deployment, monitor:
1. Heroku logs: `heroku logs --tail --app your-app-name`
2. Check for authentication errors
3. Verify existing integrations still work
4. Test new API_SECRET authentication

## Security Notes

1. **API_SECRET Storage**: Plain text secrets are stored for admin reference, but authentication uses SHA-1 hashes
2. **Backward Compatibility**: Existing JWT auth and master API_SECRET continue to work
3. **Tenant Isolation**: Each tenant's API_SECRET only works for their own data

## Support

If issues arise:
1. Check Heroku logs for detailed error messages
2. Run the test script to diagnose authentication issues
3. Verify tenant has apiSecretHash field in database
4. Ensure proper headers are being sent with requests