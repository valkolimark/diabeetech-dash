# Fix API Authentication for Multi-Tenant Nightscout System

## Problem Summary
Two tenants (arimarco and jordan) are returning 401 Unauthorized errors when accessing their API endpoints with the secret parameter. The API authentication is not working despite having API secrets configured.

## Current Situation

### Tenant Details
1. **Arimarco**
   - Subdomain: arimarco.diabeetech.net
   - API Secret: bc0d339f49c44d4cd6844ed7d437e0bd
   - Database URI: Configured
   - Admin User: ari@p5400.com
   - Dexcom Bridge: Configured with username ari@p5400.com

2. **Jordan**
   - Subdomain: jordan.diabeetech.net
   - API Secret: 1e46e3b0df8b64ab9f4ad49bc6cd44ed
   - Database URI: Configured
   - Admin User: jordan@p5400.com (password: Camzack23)
   - Dexcom Bridge: Configured with username jordanmarco2323

### Failed API Calls
```bash
# Both return 401 Unauthorized
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=bc0d339f49c44d4cd6844ed7d437e0bd"
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=1e46e3b0df8b64ab9f4ad49bc6cd44ed"
```

## What Has Been Tried
1. Added api_secret to settings field (settings.api_secret)
2. Added authDefaultRoles: 'readable' to settings
3. Verified tenants have all required fields (tenantId, subdomain, apiSecret, databaseUri)
4. Created admin users for both tenants

## System Architecture
- Multi-tenant Nightscout CGM monitoring system
- MongoDB with master database and per-tenant databases
- Heroku deployment (app name: btech)
- Tenant resolution via subdomain routing
- API authentication should work with either JWT or API secret

## Required Investigation Steps

### 1. Check Authentication Middleware
Look for the authentication logic in the codebase, likely in:
- `lib/api/auth.js` or similar authentication modules
- `lib/api/index.js` for API setup
- `lib/middleware/` for authentication middleware

### 2. Verify Secret Storage Location
The API secret might need to be in a specific location:
- Check if it should be in `apiSecret` at root level
- Check if it should be in `settings.api_secret`
- Check if it should be in `settings.apiSecret`
- Check if there's a specific format required (hashed vs plain)

### 3. Debug Authentication Flow
- Find where the `?secret=` parameter is processed
- Check if multi-tenant setup requires special authentication handling
- Verify if the secret needs to be hashed or encoded

### 4. Check Tenant Database Settings
Each tenant might need specific settings in their own database:
```javascript
// Connect to tenant database
const tenantDb = client.db('nightscout_' + tenant.tenantId);
// Check if settings collection exists and has api_secret
```

## Documentation References

### Multi-Tenant Architecture (from docs/MULTITENANT-ARCHITECTURE.md)
- Each tenant has isolated data in separate databases
- Authentication can use JWT tokens or API secrets
- Tenants are resolved by subdomain
- Required tenant fields: tenantId, subdomain, apiSecret, databaseUri

### API Authentication Requirements
- API secret should allow bypassing JWT authentication
- The secret parameter in the URL should match the tenant's API secret
- Default roles can be set via authDefaultRoles in settings

## Scripts to Use

### Check Current Configuration
```bash
#!/bin/bash
heroku run node -a btech --no-tty << 'EOF'
const { MongoClient } = require('mongodb');

(async () => {
  const MASTER_DB_URI = process.env.MASTER_MONGODB_URI;
  const client = new MongoClient(MASTER_DB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Check both tenants
    const arimarco = await db.collection('tenants').findOne({ subdomain: 'arimarco' });
    const jordan = await db.collection('tenants').findOne({ subdomain: 'jordan' });
    
    console.log('=== API Configuration Check ===\n');
    
    if (arimarco) {
      console.log('ARIMARCO:');
      console.log('- API Secret:', arimarco.apiSecret || 'NOT SET');
      console.log('- Settings:', JSON.stringify(arimarco.settings, null, 2));
    }
    
    if (jordan) {
      console.log('\nJORDAN:');
      console.log('- API Secret:', jordan.apiSecret || 'NOT SET');
      console.log('- Settings:', JSON.stringify(jordan.settings, null, 2));
    }
    
  } finally {
    await client.close();
  }
})();
EOF
```

## Expected Solution
The authentication middleware likely checks for the API secret in a specific location or format. The solution will involve:
1. Finding the exact field where the API secret should be stored
2. Understanding if the secret needs any transformation (hashing, encoding)
3. Ensuring the authentication middleware properly handles multi-tenant scenarios
4. Possibly updating environment variables or settings specific to multi-tenant setup

## Success Criteria
Both API calls should return glucose data:
```bash
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=bc0d339f49c44d4cd6844ed7d437e0bd"
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=1e46e3b0df8b64ab9f4ad49bc6cd44ed"
```

## Additional Context
- The main tenant "onepanman" works correctly, so the issue is specific to these tenants
- Both tenants have Dexcom bridge configured and should be collecting data
- The system uses subdomain-based tenant resolution
- This is a production system on Heroku

## Priority
HIGH - Both tenants cannot access their glucose data via API, which is critical functionality for diabetes management.