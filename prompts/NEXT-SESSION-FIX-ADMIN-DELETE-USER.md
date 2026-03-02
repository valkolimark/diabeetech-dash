# Fix Admin Dashboard User Deletion - Session Prompt

## Context
The Nightscout multi-tenant admin dashboard at https://www.diabeetech.net/admin/ is experiencing issues with user deletion functionality. The superadmin can log in successfully but encounters errors when attempting to delete users.

## Current State
- **Working**: Superadmin login (credentials: superadmin@diabeetech.net / Db#SuperAdmin2025!Secure)
- **Working**: Admin dashboard loads
- **Broken**: User deletion fails with 500 errors
- **Issues**: Multiple API errors including 401 (unauthorized), 403 (forbidden), and 500 (internal server error)

## Error Details

### 1. Token/Auth Issue
```
Failed to get current user:
code: "ERR_BAD_REQUEST"
message: "Request failed with status code 401"
response: {data: {error: "No token provided"}, status: 401}
```

### 2. Health Check Failure
```
Request failed with status code 500
response: {
  data: {
    success: false, 
    error: "Health check failed", 
    data: {
      status: "error", 
      message: "Cannot read properties of undefined (reading 'env')"
    }
  }
}
```

### 3. User Deletion Failures
- DELETE request to `/api/v1/admin/users/{userId}` returns 500
- Specific user IDs failing: `687bc88d31b7ed0002cdf18d`, `687bc88d31b7ed0002cdf18b`

## Technical Details

### Application Structure
- **Frontend**: React admin dashboard at `/admin-dashboard/`
- **Backend**: Node.js/Express API
- **Database**: MongoDB multi-tenant setup
- **Auth**: JWT-based authentication
- **Deployment**: Heroku app 'btech'

### Relevant Files
1. **Admin API Routes**: `/lib/routes/admin.js`
2. **Admin Controller**: `/lib/controllers/adminController.js`
3. **User Model**: `/lib/models/user.js`
4. **Auth Middleware**: `/lib/middleware/auth.js`
5. **Admin Dashboard**: `/admin-dashboard/src/`

### Current Code Versions
- Main app: v209 (deployed)
- Branch: `feat/restrict-admin-to-tenants`

## Investigation Steps

1. **Check Admin API User Deletion Endpoint**
   - Verify the DELETE `/api/v1/admin/users/:id` route exists
   - Check if it properly handles multi-tenant context
   - Ensure proper error handling

2. **Auth Token Issues**
   - The "No token provided" error suggests token isn't being passed correctly
   - Check if admin dashboard is properly storing and sending JWT tokens
   - Verify CORS settings for admin routes

3. **Environment Variable Issue**
   - The `reading 'env'` error indicates missing environment context
   - Check if admin routes have access to `env` object
   - Verify context initialization in admin endpoints

4. **Database Operations**
   - Check if user deletion properly handles tenant relationships
   - Verify cascading deletes for user-related data
   - Ensure proper MongoDB connection for admin operations

## Required Fixes

1. **Fix Token Propagation**
   - Ensure admin dashboard sends JWT token with all requests
   - Check axios interceptors in admin dashboard
   - Verify token storage in localStorage/sessionStorage

2. **Fix Environment Context**
   - Ensure `env` is properly passed to admin controller
   - Check middleware initialization order
   - Verify admin routes have access to required context

3. **Fix User Deletion Logic**
   - Implement proper multi-tenant user deletion
   - Handle related data cleanup (treatments, entries, etc.)
   - Add proper error handling and logging

4. **Add Missing CORS Headers**
   - Ensure admin API routes have proper CORS configuration
   - Allow credentials for admin endpoints

## Test Plan

1. Test user deletion for different scenarios:
   - Delete user from same tenant
   - Delete user from different tenant (should fail for non-superadmin)
   - Delete user with associated data
   - Delete last admin of a tenant (should prevent)

2. Verify auth flow:
   - Login and store token
   - Make authenticated requests
   - Handle token expiration

3. Test error handling:
   - Invalid user ID
   - Non-existent user
   - Database connection issues

## Success Criteria

1. ✅ Superadmin can delete users through admin dashboard
2. ✅ Proper error messages for failed operations
3. ✅ No 401/403/500 errors during normal operations
4. ✅ Health check endpoint returns success
5. ✅ All admin API endpoints properly authenticated

## Additional Context

- The admin dashboard was recently added to the multi-tenant setup
- User management is critical for tenant administration
- The issue appears to be related to context/environment initialization
- Previous work fixed treatments API by ensuring proper context properties

## Commands for Testing

```bash
# Check current deployment
heroku releases -a btech

# View logs
heroku logs --tail -a btech

# Test API directly
curl -X DELETE "https://www.diabeetech.net/api/v1/admin/users/USER_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Run local tests
cd /Users/markmireles/PycharmProjects/Itiflux-SB/nightscout
npm test -- --grep "admin"
```

## Priority
HIGH - Admin user management is critical functionality for the multi-tenant system. Without the ability to delete users, tenant administration is severely limited.