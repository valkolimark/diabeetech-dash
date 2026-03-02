# Admin User Deletion Fix Summary

## Issues Fixed

### 1. Environment Context Error
**Problem**: "Cannot read properties of undefined (reading 'env')"
**Cause**: The admin API was trying to access `req.app.get('ctx')` but `ctx` was never set on the Express app in multi-tenant mode.
**Fix**: Added `app.set('ctx', ctx)` in `lib/server/app-multitenant.js` before mounting admin routes.

### 2. Auth Token Not Being Sent
**Problem**: "No token provided" error on API requests
**Cause**: Mismatch between backend (sets 'admin_token' cookie) and frontend (looks for 'token' in localStorage)
**Fix**: 
- Updated `admin-dashboard/src/services/auth.js` to store JWT token in localStorage on login
- Updated token retrieval to check both localStorage and cookies
- Updated API interceptor to look for both 'token' and 'admin_token'

## Files Modified

1. `lib/server/app-multitenant.js`
   - Added `app.set('ctx', ctx)` to make context available to admin API

2. `admin-dashboard/src/services/auth.js`
   - Store token in localStorage on successful login
   - Clear token from localStorage on logout
   - Update getToken() to check both localStorage and cookies

3. `admin-dashboard/src/services/api.js`
   - Update request interceptor to check for 'admin_token' cookie as well

## Testing

Created test scripts:
- `scripts/tests/test-admin-user-deletion.sh` - Tests production API
- `scripts/tests/test-admin-deletion-local.sh` - Tests local admin server

## Deployment

These changes need to be deployed to production to fix the admin dashboard user deletion functionality.

```bash
# Deploy to Heroku
git push heroku feat/restrict-admin-to-tenants:main
```

## Verification Steps

1. Login to admin dashboard at https://www.diabeetech.net/admin/
2. Navigate to Users section
3. Try to delete a user (not your own account)
4. Should see success message instead of 500 error