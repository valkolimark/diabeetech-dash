# Admin Tools Restriction for Multi-Tenant Nightscout

## Overview
This document describes the implementation of tenant-level admin restrictions in multi-tenant Nightscout. Admin tools are now restricted to tenants that have been explicitly marked as admin tenants.

## Implementation Details

### 1. Database Changes
- Added `isAdmin` boolean field to the tenant model (`/lib/models/tenant.js`)
- Default value is `false` for new tenants
- Existing tenants will have `isAdmin` undefined (treated as false)

### 2. UI Changes
- Modified `/views/index.html` to conditionally show admin tools link
- Admin tools link only appears when `locals.tenant.isAdmin` is true
- Uses server-side EJS templating for security

### 3. Route Protection
- Added protection to `/admin` route in `/lib/server/app-multitenant.js`
- Returns 403 error for non-admin tenants
- Protection happens server-side before rendering

### 4. API Protection
- Authorization endpoints (`/api/v2/authorization/*`) protected in multi-tenant mode
- Admin notifications API (`/api/adminnotifies`) protected
- Both return 403 error for non-admin tenants

## How to Enable Admin Access

### Via MongoDB Shell
```javascript
// Connect to master database
use nightscout-master

// Enable admin for a tenant
db.tenants.updateOne(
  { subdomain: "tenant-subdomain" },
  { $set: { isAdmin: true } }
)

// Disable admin for a tenant
db.tenants.updateOne(
  { subdomain: "tenant-subdomain" },
  { $set: { isAdmin: false } }
)

// View all tenants and their admin status
db.tenants.find({}, { subdomain: 1, isAdmin: 1 })
```

### Via Test Script
A test script is provided at `/test-admin-restriction.js`:
```bash
node test-admin-restriction.js
```

This script will:
- List all tenants and their admin status
- Provide MongoDB commands to enable/disable admin access
- Verify the implementation is working

## Security Considerations

1. **Server-Side Protection**: All checks happen server-side, not client-side
2. **Database Isolation**: Admin status is stored in master database, not tenant database
3. **API Protection**: Both web UI and API endpoints are protected
4. **No Bypass**: Client-side permission checks remain but server-side is authoritative

## Testing the Implementation

1. **Enable Admin Access**:
   ```javascript
   db.tenants.updateOne({ subdomain: "test" }, { $set: { isAdmin: true } })
   ```

2. **Verify UI**:
   - Navigate to `https://test.yourdomain.com`
   - Login as any user
   - Admin Tools link should appear in the menu

3. **Test Access**:
   - Click Admin Tools - should load successfully
   - Try API: `GET /api/v2/authorization/subjects` - should work

4. **Disable Admin Access**:
   ```javascript
   db.tenants.updateOne({ subdomain: "test" }, { $set: { isAdmin: false } })
   ```

5. **Verify Restriction**:
   - Refresh the page
   - Admin Tools link should disappear
   - Direct access to `/admin` returns 403 error
   - API calls return 403 error

## Rollback Instructions

If you need to rollback this feature:

1. **Restore Original Branch**:
   ```bash
   git checkout backup-before-admin-restriction
   ```

2. **Remove isAdmin Field** (optional):
   ```javascript
   db.tenants.updateMany({}, { $unset: { isAdmin: "" } })
   ```

The feature is designed to be backward compatible. Tenants without `isAdmin` field are treated as non-admin.

## Future Enhancements

1. **Admin UI for Managing Tenant Admin Status**: Add interface to enable/disable admin per tenant
2. **Audit Logging**: Log when admin access is used
3. **Granular Permissions**: Different levels of admin access
4. **Time-Limited Admin**: Temporary admin access with expiration

## Related Files

- `/lib/models/tenant.js` - Tenant model with isAdmin field
- `/lib/server/app-multitenant.js` - Route protection and middleware
- `/views/index.html` - UI conditional rendering
- `/lib/api2/index.js` - Authorization API protection
- `/lib/api/adminnotifiesapi.js` - Admin notifications protection
- `/test-admin-restriction.js` - Test script