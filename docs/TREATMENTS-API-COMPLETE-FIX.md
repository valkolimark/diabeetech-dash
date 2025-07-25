# Complete Fix for Treatments API in Multi-Tenant Setup

## Problem Analysis

The treatments API is failing with 500 errors in the multi-tenant setup because the tenant-specific context created in `tenantResolver.js` is missing several critical dependencies that the treatments module requires.

## Root Causes

1. **Missing Event Bus (`ctx.bus`)**: The treatments module emits events for data synchronization
2. **Missing Data Processor (`ctx.ddata`)**: Required for processing treatment data
3. **Missing Purifier (`ctx.purifier`)**: Required for sanitizing input data
4. **Possible Missing Dependencies**: Other context properties may also be required

## Complete Solution

### Step 1: Analyze All Required Dependencies

The treatments module and API require these context properties:
- `ctx.bus` - Event bus for emitting data events
- `ctx.ddata` - Data processor for runtime processing
- `ctx.purifier` - Input sanitization
- `ctx.store` - Database access (already provided)
- Possibly others that are accessed via prototype chain

### Step 2: Proper Context Initialization

Instead of selectively copying properties, we need to ensure the tenant context has access to all required properties while maintaining tenant isolation for database operations.

```javascript
// In tenantResolver.js
async function tenantResolver(req, res, next) {
  // ... existing code ...
  
  // Create a request-specific context that inherits from main context
  req.ctx = Object.create(ctx);
  
  // Override only the database-specific properties for tenant isolation
  req.ctx.store = {
    db: tenantDb,
    collection: function(name) {
      return tenantDb.collection(name);
    },
    master: ctx.store
  };
  
  // Explicitly ensure critical properties are available
  // These are shared across tenants and don't need isolation
  req.ctx.bus = ctx.bus;
  req.ctx.ddata = ctx.ddata;
  req.ctx.purifier = ctx.purifier;
  
  // Initialize tenant-specific data modules with proper context
  req.ctx.entries = require('../server/entries')(env, req.ctx);
  req.ctx.treatments = require('../server/treatments')(env, req.ctx);
  req.ctx.devicestatus = require('../server/devicestatus')(env.devicestatus_collection || 'devicestatus', req.ctx);
  req.ctx.profile = require('../server/profile')(env.profile_collection || 'profile', req.ctx);
  req.ctx.food = require('../server/food')(env, req.ctx);
  req.ctx.activity = require('../server/activity')(env, req.ctx);
  
  // ... rest of code ...
}
```

### Step 3: Alternative Approach - Full Context Clone

If the selective approach continues to fail, consider a more comprehensive solution:

```javascript
// Create a deep clone of context with tenant-specific overrides
function createTenantContext(mainCtx, tenantDb) {
  const tenantCtx = {};
  
  // Copy all enumerable properties
  for (const key in mainCtx) {
    if (mainCtx.hasOwnProperty(key)) {
      tenantCtx[key] = mainCtx[key];
    }
  }
  
  // Set up prototype chain
  Object.setPrototypeOf(tenantCtx, Object.getPrototypeOf(mainCtx));
  
  // Override database-specific properties
  tenantCtx.store = {
    db: tenantDb,
    collection: function(name) {
      return tenantDb.collection(name);
    },
    master: mainCtx.store
  };
  
  // Re-initialize data modules with tenant context
  tenantCtx.entries = require('../server/entries')(env, tenantCtx);
  tenantCtx.treatments = require('../server/treatments')(env, tenantCtx);
  // ... other modules ...
  
  return tenantCtx;
}
```

### Step 4: Debug Logging

Add debug logging to identify exactly what's failing:

```javascript
// In treatments API
ctx.treatments.create(treatments, function(err, created) {
  if (err) {
    console.error('Error adding treatment:', err);
    console.error('Error stack:', err.stack);
    console.error('Context keys:', Object.keys(ctx));
    console.error('Has bus:', !!ctx.bus);
    console.error('Has ddata:', !!ctx.ddata);
    console.error('Has purifier:', !!ctx.purifier);
    res.sendJSONStatus(res, constants.HTTP_INTERNAL_ERROR, 'Mongo Error', err);
  } else {
    console.log('REST API treatment created', created);
    res.json(created);
  }
});
```

## Testing Strategy

1. **Local Testing**: Set up a local multi-tenant environment to test without affecting production
2. **Incremental Deployment**: Deploy with extensive logging first to identify the exact error
3. **Fallback Plan**: Keep rollback procedure ready

## Implementation Plan

1. Add comprehensive error logging to identify the exact failure point
2. Deploy logging changes to production to gather error details
3. Implement the complete context fix based on error information
4. Test thoroughly in a staging environment
5. Deploy to production with monitoring

## Rollback Procedure

If issues persist:
```bash
heroku rollback v203 --app btech
```

## Next Steps

1. The current code has been rolled back to v203 (stable)
2. Need to implement comprehensive logging to identify exact failure
3. Consider setting up a staging environment for testing
4. May need to review the entire multi-tenant context initialization