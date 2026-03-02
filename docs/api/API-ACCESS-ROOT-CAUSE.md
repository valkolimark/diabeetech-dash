# API Access Issues - Root Cause Analysis

## Date: 2025-07-23

## Summary
The Nightscout multi-tenant API at onepanman.diabeetech.net is returning authentication errors (401/500) despite having valid credentials.

## Root Causes Identified

### 1. JWT Login Endpoint Failure (500 Error)
- **Issue**: The `/api/auth/login` endpoint returns HTTP 500 Internal Server Error
- **Impact**: Cannot obtain JWT tokens for API authentication
- **Evidence**: 
  ```json
  {"status":500,"message":"Internal server error","error":"An error occurred"}
  ```

### 2. Tenant-Specific API_SECRET Not Configured in Production
- **Issue**: The onepanman tenant doesn't have the API_SECRET configured in the production database
- **Impact**: API_SECRET authentication (both plain text and SHA-1 hash) returns 401 Unauthorized
- **Code Support**: The codebase has full support for tenant-specific API secrets:
  - Model: `lib/models/tenant.js` - fields `apiSecret` and `apiSecretHash`
  - Auth: `lib/middleware/auth.js:277-292` - checks tenant-specific secrets
  - Migration script: `scripts/add-tenant-api-secret.js` exists but hasn't been run

### 3. Authentication Flow Requirements
The multi-tenant system requires:
1. **Tenant Resolution**: Via subdomain (onepanman.diabeetech.net) - this works correctly
2. **Authentication**: Via JWT token or API_SECRET - both failing due to above issues
3. **API_SECRET formats**: Supports both plain text and SHA-1 hash

## Solution Steps

### 1. Add API_SECRET to onepanman tenant
Run the migration script on production:
```bash
heroku run node scripts/add-tenant-api-secret.js --subdomain=onepanman --secret="GodIsSoGood2Me23!" --app=<app-name>
```

### 2. Debug JWT Login Issue
Check Heroku logs for the 500 error details:
```bash
heroku logs --tail --app=<app-name>
```

### 3. Verify Deployment
Ensure the latest code from `feat/restrict-admin-to-tenants` branch is deployed with:
- Tenant API_SECRET support
- Fixed authentication middleware
- Updated tenant model

## Technical Details

### API_SECRET Values
- Plain text: `GodIsSoGood2Me23!`
- SHA-1 hash: `5a9baf88e82b6b171ed3e3a962ed7dc2c10eaad9`

### Authentication Methods Supported
1. **JWT Bearer Token**: `Authorization: Bearer <token>`
2. **API_SECRET Header**: `api-secret: <secret-or-hash>`
3. **API_SECRET Query**: `?secret=<secret-or-hash>`

### Code References
- Authentication middleware: `lib/middleware/auth.js:84-154`
- Tenant API validation: `lib/middleware/auth.js:277-292`
- Tenant model: `lib/models/tenant.js:49-59`
- Migration script: `scripts/add-tenant-api-secret.js`