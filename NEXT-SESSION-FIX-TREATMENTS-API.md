# Prompt for Next Session: Fix Treatments API in Multi-Tenant Nightscout

## Context
You are working on a multi-tenant Nightscout deployment where the treatments API is failing with 500 errors when attempting to create treatments. The system is currently rolled back to a stable version (v203) where treatments writes don't work, but all other functionality is operational.

**CRITICAL**: Every tenant MUST be able to log their treatments. This is core functionality for diabetes management and is currently broken in the multi-tenant setup.

## Current Situation

### What Works
- ✅ Multi-tenant authentication and tenant resolution
- ✅ GET `/api/v1/treatments` returns empty array successfully
- ✅ All other API endpoints (entries, status, etc.)
- ✅ Database connections and tenant isolation

### What Doesn't Work
- ❌ POST `/api/v1/treatments` returns 500 error
- ❌ PUT `/api/v1/treatments` returns 500 error
- ❌ API v3 treatments endpoints return 500 error

### Root Cause
The tenant-specific context created in `/lib/middleware/tenantResolver.js` is missing critical properties that the treatments module requires:
- `ctx.bus` - Event bus for data synchronization
- `ctx.ddata` - Data processor
- `ctx.purifier` - Input sanitization
- Possibly other properties accessed via prototype chain

### Previous Fix Attempts
Two fixes were attempted but were insufficient:
1. **v204**: Added `ctx.bus` and `ctx.ddata` to tenant context
2. **v205**: Added `ctx.purifier` to tenant context

Both deployments still resulted in 500 errors, suggesting more comprehensive context initialization is needed.

## Your Task

### Primary Objective
Fix the treatments API in the multi-tenant setup so that treatments can be created, updated, and deleted via the API.

### Specific Requirements
1. **Analyze** the complete context initialization in the main application
2. **Identify** all properties that the treatments module requires
3. **Implement** a comprehensive fix that ensures tenant contexts have all necessary properties
4. **Test** thoroughly before deployment
5. **Deploy** with confidence and monitoring

### Key Files to Review

1. **Tenant Resolution**
   - `/lib/middleware/tenantResolver.js` - Where tenant contexts are created
   - `/lib/middleware/tenantContext.js` - Middleware that injects tenant context

2. **Treatments Module**
   - `/lib/server/treatments.js` - Core treatments data module
   - `/lib/api/treatments/index.js` - Treatments API routes

3. **Context Initialization**
   - `/lib/server/bootevent-multitenant.js` - Multi-tenant boot sequence
   - `/lib/server/bootevent.js` - Original boot sequence (for comparison)

4. **Test Resources** (in `/scripts/tests/`)
   - `test-treatments-api.js` - Comprehensive API test suite
   - `test-treatments-curl.sh` - Quick curl-based tests
   - `debug-treatments-db.js` - Direct database debugging

### Documentation Available
- `/docs/API-ENDPOINTS.md` - Complete API reference
- `/docs/TREATMENTS-API-FIX.md` - Initial investigation findings
- `/docs/TREATMENTS-API-COMPLETE-FIX.md` - Comprehensive fix planning
- `/docs/TREATMENTS-API-INVESTIGATION-LOG.md` - Detailed investigation history
- `/HEROKU-ROLLBACK-PROCEDURE.md` - How to rollback if needed

## Testing Information

### Test Tenant
- **Subdomain**: onepanman
- **URL**: https://onepanman.diabeetech.net
- **API Secret**: GodIsSoGood2Me23!
- **API Secret Hash**: 51a26cb40dcca4fd97601d00f8253129091c06ca

### Test Commands
```bash
# Test GET (currently works)
curl -X GET "https://onepanman.diabeetech.net/api/v1/treatments?count=5" \
  -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca"

# Test POST (currently fails with 500)
curl -X POST "https://onepanman.diabeetech.net/api/v1/treatments" \
  -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"Carb Correction","carbs":15,"notes":"Test"}'
```

## Suggested Approach

1. **Deep Dive Context Analysis**
   ```javascript
   // In tenantResolver.js, add logging to see what's missing
   console.log('Main ctx keys:', Object.keys(ctx));
   console.log('Main ctx prototype:', Object.getPrototypeOf(ctx));
   ```

2. **Consider Full Context Cloning**
   ```javascript
   // Instead of selective property copying
   req.ctx = Object.create(ctx);
   
   // Or create a complete clone
   req.ctx = Object.assign(Object.create(Object.getPrototypeOf(ctx)), ctx);
   ```

3. **Add Comprehensive Error Logging**
   - Log the exact error in treatments creation
   - Identify which property access is failing
   - Add try-catch blocks with detailed logging

4. **Test Locally First**
   - Set up local multi-tenant environment if possible
   - Or add extensive logging and deploy to gather information

## Deployment Instructions

### Current State
- Production is on v203 (stable but treatments POST not working)
- Branch: `feat/restrict-admin-to-tenants`
- Heroku app: `btech`

### Deployment Process
```bash
# Deploy your fix
git push heroku feat/restrict-admin-to-tenants:main

# Monitor logs
heroku logs --tail --app btech

# If issues arise, rollback
heroku rollback v203 --app btech
```

## Success Criteria
- ✅ POST `/api/v1/treatments` returns 200/201 and creates treatment
- ✅ GET `/api/v1/treatments` returns the created treatments
- ✅ PUT `/api/v1/treatments` can update treatments
- ✅ DELETE `/api/v1/treatments/:id` can delete treatments
- ✅ No impact on other API functionality
- ✅ Maintains tenant isolation

## Important Notes
1. **Don't break production** - The current setup is stable except for treatments writes
2. **Test thoroughly** - Use the provided test scripts
3. **Have rollback ready** - Know how to rollback if issues arise
4. **Consider staging** - If possible, test in a staging environment first
5. **Critical Feature** - Every tenant MUST be able to log their treatments. This is essential functionality for diabetes management. Treatments include:
   - Insulin doses (boluses, corrections)
   - Carbohydrate intake
   - Exercise activities
   - Temp basal rates
   - Site changes
   - Notes and other diabetes-related events

## Questions to Answer
1. What exact properties does the treatments module access from ctx?
2. Is the issue with property access or with how modules are initialized?
3. Would a complete context clone solve the issue?
4. Are there any circular dependencies causing issues?

Good luck! The investigation work and test scripts are all ready for you to use.