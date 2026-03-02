# Comprehensive Prompt: Multi-Tenant Registration API with CGM Setup

## CRITICAL: Read These Architecture Documents First
**IMPORTANT**: You MUST read these documents in order to understand the multi-tenant architecture:
1. **`/docs/MULTITENANT-ARCHITECTURE.md`** - READ THIS FIRST!
   - Complete multi-tenant system documentation
   - Shows successful patterns (clocks, food, profile, admin restriction)
   - Authentication and middleware patterns
2. **`/docs/ADMIN-RESTRICTION-MULTITENANT.md`** - Recent implementation example

## Current State
- Multi-tenant registration exists at `/register` (web form)
- Basic API endpoint exists at `/api/register`
- Creates tenant and initial user
- No CGM device setup during registration
- New tenants may not have proper initial settings

## Requirements for This Session

### 1. Enhance Registration API
- Make registration fully available through REST API
- Support both web form and API clients
- Return proper JSON responses with tenant info
- Include subdomain availability check endpoint

### 2. CGM Device Integration During Registration
When a new user registers, they should:
1. Create tenant and user account (existing)
2. **NEW**: Enter CGM credentials:
   - Dexcom: username, password, server region
   - LibreLink: username, password, region
   - Other compatible devices as supported
3. Store encrypted credentials in tenant database
4. Test connection to verify credentials work
5. Configure initial data polling

### 3. Clone Settings from Reference Tenant
New tenants should inherit working settings from "onepanman" tenant:
- Copy all settings collection documents
- Copy plugin configurations
- Copy enabled features
- Ensure clocks, food, profile features work
- Don't copy: actual data (entries, treatments, etc.)

## Implementation Plan

### Step 1: Investigate Current Registration
```bash
# Check current registration implementation
grep -r "register" lib/api/
grep -r "tenants.*create" lib/
cat lib/api/register.js  # if exists
cat views/register.html
```

### Step 2: Enhance Registration API
Create/update `/lib/api/registration/index.js`:
```javascript
// API endpoints needed:
POST /api/v1/registration/check-availability
  Body: { subdomain: "desired-name" }
  Response: { available: true/false }

POST /api/v1/registration/create
  Body: {
    tenant: {
      subdomain: "example",
      tenantName: "Example Tenant",
      contactEmail: "admin@example.com"
    },
    user: {
      username: "admin",
      password: "secure-password",
      email: "admin@example.com"
    },
    cgm: {
      type: "dexcom", // or "libre", etc.
      credentials: {
        username: "dexcom-user",
        password: "dexcom-pass",
        server: "us" // or "eu"
      }
    }
  }
  Response: {
    success: true,
    tenant: { subdomain, tenantId },
    loginUrl: "https://example.yourdomain.com/login"
  }
```

### Step 3: Add CGM Credential Storage
1. Create secure credential storage model
2. Encrypt credentials before storing
3. Add to tenant setup process

```javascript
// In tenant database after creation
const cgmConfig = {
  type: 'dexcom',
  credentials: encrypt({
    username: req.body.cgm.credentials.username,
    password: req.body.cgm.credentials.password,
    server: req.body.cgm.credentials.server
  }),
  lastSync: null,
  enabled: true
};
await tenantDb.collection('cgmconfig').insertOne(cgmConfig);
```

### Step 4: Clone Settings from Reference Tenant
```javascript
async function cloneSettingsFromReference(newTenantDb, referenceTenantId = 'onepanman') {
  // Connect to reference tenant
  const refDb = await connectionManager.getTenantDb({ subdomain: referenceTenantId });
  
  // Collections to clone (settings only, not data)
  const settingsCollections = ['settings', 'profile', 'food', 'clockconfig'];
  
  for (const collection of settingsCollections) {
    const docs = await refDb.collection(collection).find({}).toArray();
    if (docs.length > 0) {
      // Remove _id to avoid conflicts
      const cleanDocs = docs.map(doc => {
        delete doc._id;
        return doc;
      });
      await newTenantDb.collection(collection).insertMany(cleanDocs);
    }
  }
}
```

### Step 5: Update Web Registration Form
Enhance `/views/register.html` to include:
- CGM device selection dropdown
- Dynamic credential fields based on device
- Credential validation before submission
- Progress indicator for setup steps

## Security Considerations
1. **Credential Encryption**: Use strong encryption for CGM credentials
2. **Rate Limiting**: Prevent registration abuse
3. **Subdomain Validation**: Strict validation rules
4. **Connection Testing**: Verify CGM credentials work before saving
5. **Error Handling**: Don't expose sensitive info in errors

## Testing Plan
1. Test API registration with curl/Postman
2. Verify CGM credentials are encrypted
3. Confirm settings cloned correctly
4. Test that cloned tenant works like reference
5. Verify new tenant can pull CGM data

## Files to Review/Modify
- `/lib/api/register.js` - Current registration API
- `/lib/api/tenants/index.js` - Tenant creation logic  
- `/lib/models/tenant.js` - Tenant model
- `/lib/models/user.js` - User model
- `/views/register.html` - Registration form
- `/lib/server/bootevent-multitenant.js` - Tenant initialization
- `/lib/admin_plugins/cgmsource.js` - CGM configuration reference

## Example API Usage
```bash
# Check subdomain availability
curl -X POST https://api.yourdomain.com/api/v1/registration/check-availability \
  -H "Content-Type: application/json" \
  -d '{"subdomain": "newclient"}'

# Create new tenant with CGM
curl -X POST https://api.yourdomain.com/api/v1/registration/create \
  -H "Content-Type: application/json" \
  -d '{
    "tenant": {
      "subdomain": "newclient",
      "tenantName": "New Client Tenant"
    },
    "user": {
      "username": "admin",
      "password": "SecurePass123!"
    },
    "cgm": {
      "type": "dexcom",
      "credentials": {
        "username": "dexcom-user",
        "password": "dexcom-pass",
        "server": "us"
      }
    }
  }'
```

## Success Criteria
1. ✅ Full REST API for registration
2. ✅ CGM credentials collected during registration
3. ✅ Credentials stored encrypted in tenant DB
4. ✅ Settings cloned from working reference tenant
5. ✅ New tenant immediately functional with CGM data
6. ✅ Both web and API registration work seamlessly

## Notes
- The "onepanman" tenant is the reference because "everything works as expected"
- Focus on Dexcom and Libre as primary CGM devices
- Ensure backward compatibility with existing registration
- Consider adding webhook for post-registration setup