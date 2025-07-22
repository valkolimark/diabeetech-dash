# Comprehensive Prompt: Restrict Admin Tools to Admin-Marked Tenants

## CRITICAL: Read These Architecture Documents First
**IMPORTANT**: You MUST read these documents in order to understand the multi-tenant architecture:

1. **`/docs/MULTITENANT-ARCHITECTURE.md`** - READ THIS FIRST!
   - Explains the complete multi-tenant system
   - Shows how tenant resolution works
   - Details authentication middleware chains
   - Documents successful patterns (clocks, food, profile)

2. **`/docs/PROFILE-EDITOR-ARCHITECTURE.md`** - Latest implementation
   - Shows current authentication patterns
   - API endpoint structure
   - Security considerations

3. **`/docs/SESSION-2025-01-22-PROFILE-EDITOR.md`** - Recent success story
   - How we fixed authentication issues
   - UI improvements pattern

## Current System Understanding
### Multi-Tenant Architecture Key Points
- **Tenant Resolution**: Extracted from subdomain by `tenantResolver` middleware
- **Tenant Data**: Loaded by `tenantDataloader` middleware into `req.ctx`
- **Authentication**: Cookie-based via `requireWebAuth` middleware
- **Database**: Each tenant has separate database, master DB contains tenant info

### Authentication Flow
```javascript
// Current middleware chain for protected routes
app.use("/route", 
  tenantResolver,      // Sets req.tenant from subdomain
  requireWebAuth,      // Checks nightscout_token cookie
  tenantDataloader,    // Loads tenant data into req.ctx
  routeHandler()       // Processes request with full context
);
```

## Current Problem: Admin Tools Visibility

### Investigation Needed
1. **Find Admin Tools Implementation**
```bash
# Find admin-related files
find . -name "*admin*" -type f | grep -v node_modules
grep -r "admin" lib/server/app*.js
grep -r "admintoolslink" views/

# Check current admin route
grep -r "/admin" lib/server/app*.js
```

2. **Understand Tenant Structure**
```bash
# Look for tenant model/schema
find . -name "*tenant*" -type f | grep -E "(model|schema)"
grep -r "isAdmin\|admin.*true\|role.*admin" lib/
```

3. **Check Menu Rendering**
```bash
# Find where admin tools link is shown
grep -r "needsadminaccess" views/
grep -r "Admin Tools" views/
```

## Implementation Plan

### Step 1: Add Admin Flag to Tenant Model
The tenant data structure likely needs an admin flag. Check master database structure:

```javascript
// Expected tenant structure in master DB
{
  _id: ObjectId,
  name: "tenant_name",
  subdomain: "tenant",
  database: "tenant_database_name",
  isAdmin: false,  // <-- Add this field
  created_at: Date
}
```

### Step 2: Pass Admin Status Through Middleware
Modify `tenantDataloader` or add the admin flag to context:

```javascript
// In tenantDataloader or after it
req.ctx.tenant.isAdmin = tenant.isAdmin || false;

// Make it available to views
res.locals.isAdminTenant = req.ctx.tenant.isAdmin;
```

### Step 3: Conditionally Show Admin Tools
Update the view to check admin status:

```html
<!-- In views/index.html -->
<% if (locals.isAdminTenant) { %>
  <li class="needsadminaccess"><a id="admintoolslink" href="admin" target="admintools" class="translate">Admin Tools</a></li>
<% } %>
```

### Step 4: Protect Admin Routes
Add middleware to protect admin endpoints:

```javascript
// Admin-only middleware
const requireAdminTenant = (req, res, next) => {
  if (!req.ctx || !req.ctx.tenant || !req.ctx.tenant.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Apply to admin routes
app.use("/admin", tenantResolver, requireWebAuth, tenantDataloader, requireAdminTenant, adminTools());
```

## Database Operations Needed

### 1. Add isAdmin Field to Tenants
```javascript
// MongoDB update to add field (run in master DB)
db.tenants.updateMany({}, { $set: { isAdmin: false } });

// Mark specific tenants as admin
db.tenants.updateOne(
  { subdomain: "admin-tenant-subdomain" },
  { $set: { isAdmin: true } }
);
```

### 2. Update Tenant Loading
Ensure the isAdmin field is loaded when fetching tenant data.

## Testing Plan

### 1. Mark Test Tenant as Admin
```bash
# In MongoDB shell
use master_database;
db.tenants.find(); // List all tenants
db.tenants.updateOne({subdomain: "test"}, {$set: {isAdmin: true}});
```

### 2. Verify Menu Visibility
- Login to admin tenant → Should see "Admin Tools"
- Login to regular tenant → Should NOT see "Admin Tools"

### 3. Test Route Protection
```bash
# As non-admin tenant
curl -H "Cookie: nightscout_token=XXX" https://regular.domain.com/admin
# Should get 403 Forbidden

# As admin tenant
curl -H "Cookie: nightscout_token=XXX" https://admin.domain.com/admin
# Should get 200 OK
```

## Key Files to Modify

### 1. Tenant Model/Schema
- Location: TBD (need to find tenant definition)
- Add `isAdmin: Boolean` field

### 2. Middleware Files
- `/lib/middleware/tenantDataloader.js` - Pass admin flag
- Create `/lib/middleware/requireAdminTenant.js` - Enforce admin access

### 3. View Files
- `/views/index.html` - Conditionally show admin link
- Any other views showing admin options

### 4. Route Files
- `/lib/server/app-multitenant.js` - Add admin middleware to routes
- Admin route handler (need to find)

## Important Considerations

### Security
- Admin flag must come from master database, not user input
- Validate admin status on EVERY admin request
- Log admin actions for audit trail

### Multi-Tenant Isolation
- Admin tenants can only admin their own data
- No cross-tenant administration unless explicitly designed
- Consider separate "super admin" for system-wide management

### Backward Compatibility
- Existing tenants default to non-admin
- No breaking changes to current functionality
- Graceful handling of missing isAdmin field

## Alternative Approaches

### Option 1: Role-Based Access Control (RBAC)
Instead of boolean `isAdmin`, use roles:
```javascript
{
  tenant: {
    roles: ["user", "admin", "super_admin"]
  }
}
```

### Option 2: User-Level Admin Rights
Admin rights per user instead of per tenant:
```javascript
{
  user: {
    tenant_id: "xxx",
    roles: ["admin"]
  }
}
```

### Option 3: Feature Flags
More granular control:
```javascript
{
  tenant: {
    features: {
      adminTools: true,
      advancedReports: true,
      apiAccess: true
    }
  }
}
```

## Expected Challenges

1. **Finding Admin Implementation**
   - Admin tools might be client-side rendered
   - May need to convert to server-side pattern

2. **Database Migration**
   - Need to update all existing tenants
   - Ensure no breaking changes

3. **Session Management**
   - Admin status must be refreshed if changed
   - Consider caching implications

## Success Criteria
- [ ] Admin tools link only visible to admin tenants
- [ ] Admin routes return 403 for non-admin tenants
- [ ] No impact on existing tenant functionality
- [ ] Admin flag properly stored in master database
- [ ] Changes documented in architecture files

## Commands for Investigation
```bash
# Find all admin-related code
find . -type f -name "*.js" -o -name "*.html" | xargs grep -l "admin" | grep -v node_modules

# Check current middleware chain
grep -A 10 -B 10 "requireWebAuth" lib/server/app-multitenant.js

# Find tenant model
find . -path ./node_modules -prune -o -name "*.js" -print | xargs grep -l "tenant.*schema\|tenants.*collection"

# Look for role/permission checks
grep -r "hasRole\|checkPermission\|isAdmin\|canAccess" lib/
```

## Next Session Checklist
1. Read architecture documents
2. Investigate current admin tools implementation
3. Find tenant model/schema location
4. Implement admin flag in tenant structure
5. Add middleware for admin checking
6. Update views to conditionally show admin tools
7. Test with multiple tenants
8. Document changes

Remember: Follow the successful patterns from clocks, food, and profile implementations!