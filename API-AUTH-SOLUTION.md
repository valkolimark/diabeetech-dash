# Multi-Tenant Nightscout API Authentication Solution

## Problem
The tenants (arimarco and jordan) were receiving 401 Unauthorized errors when trying to access their API endpoints with tenant-specific API secrets.

## Root Cause
The current multi-tenant Nightscout implementation uses a **global API_SECRET** for all API authentication, rather than tenant-specific API secrets. The authorization module (`lib/authorization/index.js`) checks against `env.enclave.isApiKey()` which validates only against the global API_SECRET environment variable.

## Current Working Solution

### Global API Secret
- **API_SECRET**: `GodIsSoGood2Me23!`
- **SHA1 Hash**: `51a26cb40dcca4fd97601d00f8253129091c06ca`

### Working API Calls
All tenants must use the global API secret hash:

```bash
# For Arimarco tenant
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# For Jordan tenant  
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# For Onepanman tenant
curl "https://onepanman.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
```

## Tenant-Specific Settings (For Reference)
While the API authentication uses the global secret, each tenant still has their own configuration in the database:

### Arimarco
- **apiSecret**: `bc0d339f49c44d4cd6844ed7d437e0bd`
- **apiSecretHash**: `c2de600a77df8dd059f589ee080ef12de3f3c1dd`

### Jordan  
- **apiSecret**: `1e46e3b0df8b64ab9f4ad49bc6cd44ed`
- **apiSecretHash**: `17e14f3994e1678e030a6139706968d3650a6c7a`

These tenant-specific secrets are stored in the database but are not currently used for API authentication.

## Architecture Notes

1. The multi-tenant system resolves tenants based on subdomain
2. Each tenant has its own database and settings
3. API authentication is handled at the application level, not the tenant level
4. The `lib/middleware/auth.js` has provisions for checking tenant-specific API secrets, but the v1 API uses the original authorization module

## Future Enhancement Recommendations

To enable true tenant-specific API authentication:

1. Modify `lib/authorization/index.js` to check tenant-specific secrets when in multi-tenant mode
2. Update the `authorizeAdminSecret` function to accept the request object and check `req.tenant`
3. Ensure all API endpoints pass the request context to authorization checks

For now, all tenants must use the global API secret for API access.