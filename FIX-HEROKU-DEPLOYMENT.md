# Fix Nightscout Multi-Tenant API Access on Heroku

## Context
We have a multi-tenant Nightscout instance deployed on Heroku at `btech.diabeetech.net`. Each tenant (like `onepanman.diabeetech.net`) should be able to access the API using their own API_SECRET for device integrations (CGM uploaders, pumps, etc.).

## Current Situation

### What We've Done
1. **Implemented tenant-specific API_SECRET authentication**:
   - Modified `lib/models/tenant.js` to auto-generate API_SECRET for new tenants
   - Updated `lib/middleware/auth.js` to check tenant-specific API secrets
   - Fixed bug in `lib/server/enclave.js` (isApiKeySet was returning wrong variable)
   - Updated registration to return API_SECRET to new tenants

2. **Created migration scripts**:
   - `scripts/add-tenant-api-secret.js` - Adds API_SECRET to existing tenants
   - `scripts/display-tenant-api-secrets.js` - Shows all tenant API secrets
   - `scripts/quick-update-tenant.js` - Quick update for specific tenant

3. **Deployed to Heroku**:
   - App name: `btech`
   - Successfully deployed code on 2025-07-23
   - Branch: `feat/restrict-admin-to-tenants`

### The Problems

#### 1. API Authentication Still Failing
```bash
# This should work but returns 401
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3" \
    -H "api-secret: GodIsSoGood2Me23!" \
    -H "Accept: application/json"

# Response: {"status":401,"message":"Authentication required","error":"No authentication token provided"}
```

#### 2. JWT Login Endpoint Returns 500 Error
```bash
curl -X POST https://onepanman.diabeetech.net/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "mark@markmireles.com", "password": "GodIsGood23!"}'

# Response: {"status":500,"message":"Internal server error","error":"An error occurred"}
```

#### 3. Migration Scripts Fail on Heroku
When running `heroku run node scripts/add-tenant-api-secret.js --generate-random -a btech`:
- Error: `TypeError: fs.readFileSync is not a function` in `/app/lib/language.js:150`
- MongoDB connection fails with "URI malformed" error

## What Needs to Be Fixed

### 1. Debug the Language Module Issue
The language module is failing with `fs.readFileSync is not a function`. This is blocking all scripts from running. Check:
- Is fs being imported correctly?
- Is there a webpack/build issue?
- Are we in a restricted environment?

### 2. Fix MongoDB Connection
The MongoDB URI appears to be malformed or missing. Need to:
- Check `heroku config:get MONGODB_URI -a btech`
- Verify the connection string format
- Ensure the database is accessible

### 3. Verify Authentication Middleware
The API is returning 401 even after deployment. Need to:
- Check if the authentication middleware is loading
- Verify tenant resolution is working (subdomain → tenant lookup)
- Ensure the legacy API_SECRET check is running

### 4. Debug JWT Login Error
The 500 error on login suggests a deeper issue. Check:
- Database connectivity for user lookups
- JWT secret configuration
- Error logs for the actual error message

## Credentials & Test Data

### Tenant: onepanman
- **Subdomain**: onepanman.diabeetech.net
- **API_SECRET**: `GodIsSoGood2Me23!`
- **SHA-1 Hash**: `5a9baf88e82b6b171ed3e3a962ed7dc2c10eaad9`
- **Admin User**: mark@markmireles.com
- **Password**: GodIsGood23!

### Heroku App
- **App Name**: btech
- **Git Remote**: https://git.heroku.com/btech.git
- **Web URL**: https://btech-d038118b5224.herokuapp.com/

## Quick Test Commands

```bash
# Check if API_SECRET works (should return glucose entries)
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3" \
    -H "api-secret: 5a9baf88e82b6b171ed3e3a962ed7dc2c10eaad9"

# Test JWT login (should return access token)
curl -X POST https://onepanman.diabeetech.net/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "mark@markmireles.com", "password": "GodIsGood23!"}'

# Check logs
heroku logs --tail -a btech

# Run migration (currently broken)
heroku run node scripts/add-tenant-api-secret.js --subdomain=onepanman --secret="GodIsSoGood2Me23!" -a btech
```

## Success Criteria
1. API_SECRET authentication works for onepanman tenant
2. JWT login endpoint returns tokens successfully
3. Migration scripts can run to add API_SECRETs to all tenants
4. New tenants automatically get API_SECRETs

## Code Locations
- Authentication middleware: `lib/middleware/auth.js:277-292`
- Tenant model: `lib/models/tenant.js:49-59`
- Migration script: `scripts/add-tenant-api-secret.js`
- Branch: `feat/restrict-admin-to-tenants`

The implementation is complete, but there are deployment/environment issues preventing it from working on Heroku.