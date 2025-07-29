# Fix All 500 Errors - Bulletproof API Session Prompt

## Context
You are working on the Btech/Diabeetech Nightscout multi-tenant application. The registration process is working but there are 500 errors on some endpoints, particularly the login endpoint. The API needs to be made bulletproof with zero 500 errors.

## Current State
- **Working**: Registration, API access with secret, Dexcom data collection
- **500 Errors**: Login endpoint (`/api/auth/login`) on some tenants
- **App**: Hosted on Heroku as 'btech'
- **Database**: MongoDB Atlas multi-tenant setup

## Known Issues
1. Login endpoint returns: `{"status":500,"message":"Internal server error","error":"An error occurred"}`
2. Some tenants work (jordan, arimarco) but new ones fail (testdex1753801381)
3. Password field naming inconsistency (password vs passwordHash)

## Requirements
1. **Fix all 500 errors** - Every endpoint must return proper error messages
2. **Create rollback plan** - Document current working state before changes
3. **Test with curl** - Verify each fix before committing
4. **Zero downtime** - Changes must not break existing working tenants
5. **Comprehensive error handling** - All errors must be caught and logged

## Files to Check
```
lib/middleware/auth.js - Authentication logic
lib/models/user.js - User model with password handling
lib/api/auth/index.js - Auth routes
lib/api/admin/users.js - Admin user creation
lib/server/app-multitenant.js - Main app setup
lib/middleware/tenantResolver.js - Tenant context resolution
```

## Test Endpoints
```bash
# Login (currently failing on new tenants)
curl -X POST https://[tenant].diabeetech.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"email@example.com","password":"password"}'

# Status (working)
curl "https://[tenant].diabeetech.net/api/v1/status.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# Entries (working)
curl "https://[tenant].diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# Profile
curl "https://[tenant].diabeetech.net/api/v1/profile.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# Treatments
curl "https://[tenant].diabeetech.net/api/v1/treatments.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
```

## Tasks

### 1. Create Rollback Documentation
- Document current git commit: `git rev-parse HEAD`
- Save current Heroku release: `heroku releases -a btech`
- Create rollback script: `tools/rollback-to-stable.sh`

### 2. Debug Login 500 Error
- Add comprehensive error logging to auth.login
- Check tenant context in authentication
- Verify password field handling (password vs passwordHash)
- Test with working tenant (jordan) vs failing tenant (testdex1753801381)

### 3. Audit All Endpoints for Error Handling
Check each endpoint for proper try/catch:
- `/api/auth/*` - Authentication endpoints
- `/api/v1/entries/*` - Glucose data
- `/api/v1/treatments/*` - Treatment records  
- `/api/v1/profile/*` - Profile data
- `/api/v1/devicestatus/*` - Device status
- `/api/register` - Registration
- `/api/tenants/*` - Tenant management

### 4. Implement Global Error Handler
```javascript
// Global error handler in app-multitenant.js
app.use((err, req, res, next) => {
  console.error('API Error:', {
    path: req.path,
    method: req.method,
    tenant: req.tenant?.subdomain,
    error: err.message,
    stack: err.stack
  });
  
  res.status(err.status || 500).json({
    status: err.status || 500,
    message: err.userMessage || 'An error occurred',
    error: env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    path: req.path
  });
});
```

### 5. Fix Specific Issues

#### Login Error Fix
```javascript
// In auth.login
try {
  // Add detailed logging
  console.log('Login attempt:', { email, tenant: req.tenant?.subdomain });
  
  // Check tenant context
  if (!req.tenant) {
    return res.status(400).json({
      status: 400,
      message: 'Unable to determine tenant context',
      error: 'Missing tenant information'
    });
  }
  
  // Find user with better error handling
  const user = await userModel.authenticate(req.tenant.tenantId, email, password);
  
  if (!user) {
    console.log('Authentication failed:', { email, tenant: req.tenant.subdomain });
    return res.status(401).json({
      status: 401,
      message: 'Invalid email or password',
      error: 'Authentication failed'
    });
  }
  
  // Generate tokens...
} catch (err) {
  console.error('Login error:', err);
  return res.status(500).json({
    status: 500,
    message: 'Login failed',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
}
```

#### Password Field Consistency
```javascript
// In user model authenticate method
const user = await collection.findOne({ 
  tenantId: tenantId,
  email: email.toLowerCase(),
  isActive: true 
});

if (!user) return null;

// Handle both password and passwordHash fields
const hashedPassword = user.passwordHash || user.password;
if (!hashedPassword) {
  console.error('User has no password field:', user.email);
  return null;
}

const isValid = await bcrypt.compare(password, hashedPassword);
```

### 6. Test Plan
```bash
# Test each endpoint on multiple tenants
TENANTS=("jordan" "arimarco" "testdex1753801381")
ENDPOINTS=("/api/auth/login" "/api/v1/status.json" "/api/v1/entries.json" "/api/v1/treatments.json")

for tenant in "${TENANTS[@]}"; do
  echo "Testing $tenant..."
  for endpoint in "${ENDPOINTS[@]}"; do
    echo "  $endpoint:"
    curl -s -o /dev/null -w "    Status: %{http_code}\n" "https://$tenant.diabeetech.net$endpoint?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
  done
done
```

### 7. Monitoring Setup
- Add error tracking to all endpoints
- Create health check endpoint that tests all services
- Set up alerts for 500 errors

### 8. Documentation Updates
- Create `docs/ERROR-HANDLING-GUIDE.md`
- Update API documentation with all possible error responses
- Document rollback procedures

## Success Criteria
1. Zero 500 errors on all endpoints
2. All errors return meaningful messages
3. Existing functionality remains intact
4. Can rollback within 5 minutes if issues arise
5. All endpoints tested and documented

## Rollback Plan
```bash
# If issues arise:
heroku rollback -a btech
# or
heroku releases:rollback v[previous-version] -a btech
```

## Environment Variables Needed
```
MONGODB_URI=mongodb+srv://...
API_SECRET=...
JWT_SECRET=...
NODE_ENV=production
```

## Testing Checklist
- [ ] All endpoints return appropriate status codes
- [ ] Error messages are user-friendly
- [ ] Logs contain debugging information
- [ ] No sensitive data in error responses
- [ ] All tenants can login successfully
- [ ] API endpoints work with secret parameter
- [ ] Registration still creates working accounts

Remember: Test everything with curl before committing. Make the API bulletproof!