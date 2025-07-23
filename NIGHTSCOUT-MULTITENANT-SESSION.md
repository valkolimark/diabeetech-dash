# Nightscout Multi-Tenant Session Documentation

## Project Overview
This is a multi-tenant Nightscout instance deployed on Heroku that allows multiple users to have their own isolated Nightscout instances under subdomains (e.g., onepanman.diabeetech.net).

## Current Status
- **API Authentication**: ✅ Working - devices can upload/retrieve glucose data
- **JWT Web Login**: ✅ Working - users can login via API
- **Tenant Registration**: ✅ Working
- **Data Isolation**: ✅ Each tenant has separate database
- **Dexcom Bridge**: ✅ Working and pulling data

## Deployment Info
- **Heroku App**: btech
- **Domain**: diabeetech.net
- **Git Branch**: feat/restrict-admin-to-tenants
- **MongoDB**: Atlas cluster (master + tenant databases)

## Key Credentials

### Heroku
```bash
heroku apps:info -a btech
# Git remote: https://git.heroku.com/btech.git
```

### Test Tenant: onepanman
- **URL**: https://onepanman.diabeetech.net
- **API_SECRET**: GodIsSoGood2Me23!
- **API_SECRET_HASH**: 51a26cb40dcca4fd97601d00f8253129091c06ca
- **Admin Email**: mark@markmireles.com
- **Admin Password**: GodIsGood23!
- **Database**: nightscout-tenant-onepanman

### Environment Variables
```bash
MASTER_MONGODB_URI  # MongoDB connection for master database
JWT_SECRET         # JWT signing key
NODE_ENV=production
MULTI_TENANT=true
```

## API Usage Examples

### Test API Access
```bash
# Get last 3 glucose readings
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3" \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
    -H "Accept: application/json"

# Upload a new entry
curl -X POST "https://onepanman.diabeetech.net/api/v1/entries" \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
    -H "Content-Type: application/json" \
    -d '[{"sgv": 120, "date": 1753240000000, "dateString": "2025-07-23T03:00:00.000Z", "direction": "Flat", "type": "sgv", "device": "xDrip"}]'
```

## Key Files & Locations

### Core Multi-Tenant Implementation
- `lib/server/app-multitenant.js` - Express app setup for multi-tenant
- `lib/server/bootevent-multitenant.js` - Boot sequence for multi-tenant
- `lib/middleware/tenantResolver.js` - Subdomain to tenant resolution
- `lib/middleware/auth.js` - Authentication middleware (line 277-292 for API secret check)
- `lib/models/tenant.js` - Tenant model (line 49-59 for API secret generation)
- `lib/models/user.js` - User model for multi-tenant
- `lib/api/auth/index.js` - Auth API routes (JWT login issue here)

### Migration Scripts
- `scripts/add-tenant-api-secret.js` - Add API secrets to existing tenants
- `scripts/display-tenant-api-secrets.js` - Show all tenant API secrets
- `scripts/quick-update-tenant.js` - Quick update for specific tenant
- `scripts/reset-user-password.js` - Reset user passwords
- `scripts/debug-login.js` - Debug JWT login issues

### Database Structure
```javascript
// Master Database Collections:
- tenants: {
    tenantId: UUID,
    subdomain: String,
    databaseName: String,
    apiSecret: String,
    apiSecretHash: String (SHA-1),
    // ... other fields
  }
- users: {
    userId: UUID,
    tenantId: UUID (FK),
    email: String,
    passwordHash: String (bcrypt),
    role: String (admin/caregiver/viewer),
    // ... other fields
  }

// Tenant Database Collections (per tenant):
- entries (glucose data)
- treatments
- devicestatus
- profile
- food
- activity
```

## Recent Fixes Applied

### 1. Language Module Fix
**File**: `scripts/add-tenant-api-secret.js`, `scripts/display-tenant-api-secrets.js`
```javascript
// Fixed: Pass fs module instead of env
const fs = require('fs');
const language = require('../lib/language')(fs);  // Was: (env)
```

### 2. MongoDB Connection Fix
**Usage**: When running scripts on Heroku
```bash
# Fixed: Use MASTER_MONGODB_URI environment variable
heroku run "MONGODB_URI=$MASTER_MONGODB_URI node scripts/script.js" -a btech
```

### 3. API Authentication Fix
**File**: `scripts/quick-update-tenant.js`
- Added apiSecret and apiSecretHash to tenant document
- API now accepts the SHA-1 hash in api-secret header

## Known Issues

### JWT Login JSON Formatting
**Resolved**: The JWT login was failing due to incorrect JSON escaping in curl commands.
**Solution**: Use proper JSON formatting without escaping special characters in passwords.

**Working example**:
```bash
curl -X POST https://onepanman.diabeetech.net/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "mark@markmireles.com", "password": "GodIsGood23!"}'
```

## Common Commands

### Deployment
```bash
# Deploy to Heroku
git push heroku feat/restrict-admin-to-tenants:main

# Check logs
heroku logs --tail -a btech

# Run one-off commands
heroku run bash -a btech
```

### Database Operations
```bash
# Check tenant details
heroku run "MONGODB_URI=$MASTER_MONGODB_URI node -e \"
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect(process.env.MONGODB_URI, { useUnifiedTopology: true }, async (err, client) => {
  const db = client.db();
  const tenant = await db.collection('tenants').findOne({ subdomain: 'onepanman' });
  console.log(JSON.stringify(tenant, null, 2));
  client.close();
});\"" -a btech
```

### Testing
```bash
# Test API authentication
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=1" \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca"

# Test JWT login (working)
curl -X POST https://onepanman.diabeetech.net/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "mark@markmireles.com", "password": "GodIsGood23!"}'
```

## Compatible Apps Configuration

### xDrip+
- Base URL: `https://onepanman.diabeetech.net`
- API Secret: `GodIsSoGood2Me23!` (use plain text, not hash)

### Spike
- URL: `https://onepanman.diabeetech.net`
- API Secret: `GodIsSoGood2Me23!`

### Loop/AAPS
- Nightscout URL: `https://onepanman.diabeetech.net`
- API Secret: `GodIsSoGood2Me23!`

## Next Session Tasks

1. **Complete Documentation** - Update README with multi-tenant setup

2. **Add Admin Features** - Tenant management UI

3. **Security Hardening** - Rate limiting, audit logs

4. **Add Web UI Login** - Implement login form for web interface
   - Currently only API login is tested
   - Need to add login/logout UI components

## Important Notes

- Always use `MASTER_MONGODB_URI` for scripts that access master database
- API authentication uses SHA-1 hash of API_SECRET
- Each tenant has isolated data in separate MongoDB database
- The Dexcom bridge is tenant-aware and working correctly
- New tenants automatically get API_SECRET generated

## File Structure
```
nightscout/
├── lib/
│   ├── server/
│   │   ├── app-multitenant.js       # Multi-tenant Express app
│   │   └── bootevent-multitenant.js # Multi-tenant boot sequence
│   ├── middleware/
│   │   ├── tenantResolver.js        # Subdomain resolution
│   │   └── auth.js                  # Auth + API secret check
│   ├── models/
│   │   ├── tenant.js                # Tenant model
│   │   └── user.js                  # User model
│   └── api/
│       └── auth/
│           └── index.js             # Auth routes (login issue)
├── scripts/
│   ├── add-tenant-api-secret.js    # Migration script
│   ├── reset-user-password.js      # Password reset
│   └── debug-login.js              # Debug helper
└── FIX-HEROKU-DEPLOYMENT.md        # Detailed fix documentation
```

This should give you or anyone else everything needed to continue working on this project!