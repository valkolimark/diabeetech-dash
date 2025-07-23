# Troubleshoot Nightscout Multi-Tenant API Access for onepanman.diabeetech.net

## Context
I need help troubleshooting API access to the Nightscout multi-tenant instance at `onepanman.diabeetech.net`. I have valid credentials and can log in through the web interface, but I'm experiencing issues with API authentication.

## Current Situation

### What Works ✅
1. **Web Access**: I can successfully log in to https://onepanman.diabeetech.net through the browser
2. **Login Endpoint**: The API login endpoint works from my local terminal:
   ```bash
   curl -X POST https://onepanman.diabeetech.net/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{
         "email": "mark@markmireles.com",
         "password": "GodIsGood23!"
       }'
   ```
   
   This returns a valid JWT token response:
   ```json
   {
     "accessToken": "eyJhbGciOiJIUzI1NiIs...",
     "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
     "tokenType": "Bearer",
     "expiresIn": "24h",
     "user": {
       "userId": "41921f49-60b0-4f10-844b-eb06021acbb5",
       "email": "mark@markmireles.com",
       "role": "admin",
       "profile": {
         "displayName": "MarkT",
         "units": "mg/dl"
       }
     }
   }
   ```

### What Doesn't Work ❌
1. **API_SECRET Authentication**: 
   - API_SECRET: `GodIsSoGood2Me23!`
   - SHA-1 Hash: `5a9baf88e82b6b171ed3e3a962ed7dc2c10eaad9`
   - Both header and query parameter methods return 401 Unauthorized

2. **JWT Bearer Token Access**:
   - When using the valid access token from login, all API endpoints return 401 Unauthorized
   - Example: `GET /api/v1/entries` with `Authorization: Bearer {token}` returns 401

3. **All API Endpoints Tested**:
   - `/api/v1/entries` - 401 Unauthorized
   - `/api/v1/status` - 401 Unauthorized  
   - `/api/v1/treatments` - 401 Unauthorized
   - `/api/v3/version` - 401 Unauthorized

## Technical Details

### Environment
- **Instance**: Multi-tenant Nightscout at diabeetech.net
- **Subdomain**: onepanman
- **User Role**: admin
- **Tenant ID**: 64215b38-cbb6-4581-8c35-2621ed9b6f33

### API Documentation Created
I've created comprehensive API documentation in:
- `/docs/API-REFERENCE.md` - Full API reference guide
- `/docs/openapi.yaml` - OpenAPI 3.0 specification
- `/docs/nightscout-api.postman_collection.json` - Postman collection

## What I Need Help With

1. **Verify API Access Configuration**:
   - Check if API access is properly enabled for the onepanman tenant
   - Verify if API_SECRET authentication is enabled or if only JWT is supported
   - Check for any IP restrictions or additional security settings

2. **Test API Endpoints**:
   - Successfully retrieve glucose entries from `/api/v1/entries`
   - Verify the response format matches the documentation
   - Test other core endpoints (treatments, profile, device status)

3. **Identify Authentication Issues**:
   - Why does the JWT token return 401 on all endpoints?
   - Is there a different authentication flow for multi-tenant instances?
   - Are there additional headers or parameters required?

4. **Validate Documentation**:
   - Confirm if the API documentation accurately reflects the diabeetech.net deployment
   - Identify any diabeetech-specific API differences
   - Update documentation with any findings

## Test Commands to Run

```bash
# 1. Login (this works)
curl -X POST https://onepanman.diabeetech.net/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "mark@markmireles.com",
      "password": "GodIsGood23!"
    }'

# 2. Get entries with JWT (currently returns 401)
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3" \
    -H "Authorization: Bearer {ACCESS_TOKEN_FROM_STEP_1}" \
    -H "Accept: application/json"

# 3. Try with API_SECRET header (currently returns 401)
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3" \
    -H "api-secret: 5a9baf88e82b6b171ed3e3a962ed7dc2c10eaad9" \
    -H "Accept: application/json"

# 4. Try with API_SECRET query (currently returns 401)
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3&secret=5a9baf88e82b6b171ed3e3a962ed7dc2c10eaad9" \
    -H "Accept: application/json"
```

## Additional Information
- The codebase is located at: `/Users/markmireles/PycharmProjects/Itiflux-SB/nightscout`
- Current branch: `feat/restrict-admin-to-tenants`
- The instance is hosted on Heroku
- Base domain is configured as `diabeetech.net` (not `nightscout.com`)

## Goal
Successfully access the Nightscout API at onepanman.diabeetech.net to:
1. Retrieve glucose readings
2. Verify the API documentation is accurate
3. Ensure developers can integrate with the API using the documentation
4. Identify and document any diabeetech-specific API requirements

Please help me troubleshoot why the API authentication isn't working despite having valid credentials and admin access to the tenant.