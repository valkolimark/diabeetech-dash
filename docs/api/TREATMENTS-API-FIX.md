# Treatments API Fix Documentation

## Overview

This document describes the fix implemented for the treatments API in the multi-tenant Nightscout setup. The API was returning 500 errors when attempting to create treatments due to missing event bus references in the tenant context.

## Problem Description

### Symptoms
- GET `/api/v1/treatments` worked correctly (returned empty array)
- POST `/api/v1/treatments` failed with 500 error
- API v3 treatments endpoints also failed with 500 error
- Other API endpoints (entries, status) worked correctly

### Root Cause
The tenant-specific context created in `tenantResolver.js` was missing explicit references to `ctx.bus` and `ctx.ddata`. When the treatments module tried to emit events like `data-received` and `data-update`, it failed because `ctx.bus` was undefined.

## Solution

### Code Changes

Modified `/lib/middleware/tenantResolver.js` to explicitly copy bus and ddata references:

```javascript
// Create a request-specific context with tenant database
req.ctx = Object.create(ctx);
req.ctx.store = {
  db: tenantDb,
  collection: function(name) {
    return tenantDb.collection(name);
  },
  master: ctx.store
};

// Ensure bus and ddata are available
req.ctx.bus = ctx.bus;
req.ctx.ddata = ctx.ddata;
```

## Testing

### API Authentication
- **Tenant**: onepanman
- **API Secret**: `GodIsSoGood2Me23!`
- **SHA-1 Hash**: `51a26cb40dcca4fd97601d00f8253129091c06ca`

### Test Scripts Created

1. **test-treatments-api.js** - Comprehensive Node.js test suite
2. **test-treatments-curl.sh** - Bash script using curl for API testing
3. **debug-treatments-db.js** - Direct database debugging script
4. **insert-treatments-direct.js** - Direct MongoDB insertion for testing

### API Endpoints Tested

#### 1. List Treatments
```bash
curl -X GET "https://onepanman.diabeetech.net/api/v1/treatments?count=5" \
  -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
  -H "Accept: application/json"
```

#### 2. Create Treatment
```bash
curl -X POST "https://onepanman.diabeetech.net/api/v1/treatments" \
  -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "Carb Correction",
    "carbs": 15,
    "notes": "Test entry",
    "enteredBy": "API Test"
  }'
```

## Sample Treatment Data Formats

### Carb Correction
```json
{
  "eventType": "Carb Correction",
  "carbs": 15,
  "notes": "Morning snack - apple",
  "created_at": "2025-07-25T12:00:00.000Z",
  "enteredBy": "API Test"
}
```

### Meal Bolus
```json
{
  "eventType": "Meal Bolus",
  "carbs": 45,
  "insulin": 4.5,
  "notes": "Lunch - sandwich and salad",
  "created_at": "2025-07-25T13:00:00.000Z",
  "enteredBy": "API Test"
}
```

### Correction Bolus
```json
{
  "eventType": "Correction Bolus",
  "insulin": 1.0,
  "glucose": 185,
  "glucoseType": "Finger",
  "units": "mg/dl",
  "notes": "High BG correction",
  "created_at": "2025-07-25T14:00:00.000Z",
  "enteredBy": "API Test"
}
```

### Exercise
```json
{
  "eventType": "Exercise",
  "duration": 30,
  "notes": "30 minute walk",
  "created_at": "2025-07-25T14:30:00.000Z",
  "enteredBy": "API Test"
}
```

### Temp Basal
```json
{
  "eventType": "Temp Basal",
  "percent": -20,
  "duration": 60,
  "notes": "Reduced basal for activity",
  "created_at": "2025-07-25T15:00:00.000Z",
  "enteredBy": "API Test"
}
```

### Site Change
```json
{
  "eventType": "Site Change",
  "notes": "Changed infusion site",
  "created_at": "2025-07-25T15:30:00.000Z",
  "enteredBy": "API Test"
}
```

## Deployment

After implementing the fix:

1. Commit changes to git
2. Deploy to Heroku: `git push heroku feat/restrict-admin-to-tenants:main`
3. Monitor logs: `heroku logs --tail`
4. Test API endpoints to verify fix

## Verification Steps

1. **Check API Status**
   - Verify apiEnabled and careportalEnabled are true
   
2. **Test Read Operations**
   - GET treatments should return array (empty or with data)
   
3. **Test Write Operations**
   - POST single treatment
   - POST multiple treatments
   - Verify created treatments appear in GET requests
   
4. **Test Other Operations**
   - UPDATE treatment (PUT)
   - DELETE treatment
   - API v3 endpoints

## Future Improvements

1. Add better error handling and logging in treatments module
2. Implement request-scoped event bus for tenant isolation
3. Add integration tests for multi-tenant API operations
4. Consider using dependency injection for tenant context

## Related Files

- `/lib/middleware/tenantResolver.js` - Tenant resolution and context setup
- `/lib/server/treatments.js` - Treatments data storage module
- `/lib/api/treatments/index.js` - Treatments API routes
- `/lib/middleware/tenantContext.js` - Tenant context middleware