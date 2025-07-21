# Nightscout Multi-Tenant Troubleshooting Status
**Date:** July 20, 2025 - 10:17 PM CST
**System:** Multi-tenant Nightscout on Heroku (app: btech)
**Tenant:** onepanman

## Executive Summary
The multi-tenant Nightscout system is partially working but the Dexcom bridge is not fetching new glucose data. The last successful data fetch was at 9:18 PM CST (over 1 hour ago). While the WebSocket automatic update mechanism has been fixed, the bridge manager is not initializing on server startup, preventing new data from being collected.

## What's Working ✅

### 1. Authentication & Multi-tenant Infrastructure
- JWT authentication working correctly
- Tenant isolation functioning properly
- WebSocket connections establishing successfully
- Tenant ID: `64215b38-cbb6-4581-8c35-2621ed9b6f33`

### 2. Data Display & Visualization
- Chart rendering correctly with 49 data points
- Data range: July 19 11:43 AM to July 20 9:18 PM
- Latest reading displayed: 161 mg/dL at 9:18 PM
- Profile data loading correctly

### 3. WebSocket Real-time Updates (Fixed Today)
- Fixed bus instance issue in `bridge-multitenant.js`
- WebSocket now properly listening for `data-received` events
- Client successfully receives `dataUpdate` events
- Fix deployed in version 94 at 9:52 PM

### 4. Database Connectivity
- MongoDB Atlas connection working
- Separate tenant databases accessible
- Data persistence functioning

## What's Broken ❌

### 1. Dexcom Bridge Not Running
- **Primary Issue:** Bridge manager not initializing on server startup
- No bridge polling activity in logs
- Last data fetch: July 20, 9:18 PM CST (1+ hour ago)
- Expected polling interval: 2.5 minutes (150000ms)

### 2. Bridge Manager Initialization
- `bridgeManager.initializeAll()` not being called or failing silently
- No bridge-related logs after server restart
- Bridge settings exist in tenant database but bridge not starting

### 3. API Authentication Issue
- `/api/v1/entries.json` returning 401 Unauthorized
- JWT token not working for API endpoints (though WebSocket auth works)

## Recent Changes & Fixes Applied

### Today's Session (July 20, 2025)
1. **Fixed WebSocket automatic updates** (Commit: fc18a133)
   - Changed `require('../bus')` to use `tenantCtx.bus`
   - Ensures `data-received` events reach WebSocket handlers
   
2. **Deployment History:**
   - v92: 9:32 PM - Initial fixes
   - v93: 9:40 PM - Additional fixes
   - v94: 9:52 PM - WebSocket bus fix (current)

3. **Server Restarts:**
   - Manual restart at 10:12 PM to trigger bridge initialization
   - App running for ~5 minutes as of 10:17 PM

## What Needs to Be Fixed 🔧

### 1. Bridge Manager Initialization (CRITICAL)
**Location:** `/lib/server/bootevent-multitenant.js` lines 308-316
```javascript
// Current code that's not working:
if (ctx.multiTenant.enabled) {
  ctx.bridgeManager = require('../services/bridge-manager')(env, ctx);
  // Initialize bridges after boot completes
  process.nextTick(() => {
    ctx.bridgeManager.initializeAll().catch(err => {
      console.error('Failed to initialize bridge manager:', err);
    });
  });
}
```

**Potential Issues:**
- Silent failure in `initializeAll()`
- Missing error logging
- Timing issue with `process.nextTick`
- Bridge settings not being found

### 2. Verify Bridge Settings
Need to confirm tenant has bridge configured:
- Database: `nightscout-tenant-onepanman`
- Collection: `settings`
- Required fields: `bridge.enable`, `bridge.userName`, `bridge.password`

### 3. Add Bridge Initialization Logging
Add comprehensive logging to track initialization:
- Log when bridge manager starts
- Log each tenant being processed
- Log bridge settings discovery
- Log success/failure for each bridge start

## Debugging Commands for Tomorrow

### 1. Check Bridge Settings in Database
```bash
heroku run --app btech node -e "
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect(process.env.MONGODB_URI).then(async client => {
  const db = client.db('nightscout-tenant-onepanman');
  const settings = await db.collection('settings').findOne({});
  console.log('Bridge enabled:', settings?.bridge?.enable);
  console.log('Bridge user:', settings?.bridge?.userName ? 'SET' : 'NOT SET');
  console.log('Bridge password:', settings?.bridge?.password ? 'SET' : 'NOT SET');
  client.close();
});"
```

### 2. Check Server Logs for Bridge Activity
```bash
# Check for bridge initialization
heroku logs --app btech -n 1000 | grep -i "bridge\|manager\|dexcom"

# Check for tenant loading
heroku logs --app btech -n 1000 | grep -i "tenant\|multi-tenant"
```

### 3. Test Bridge Manually
Create a test script to manually trigger bridge initialization and see errors.

## Immediate Next Steps

1. **Add logging to bridge manager initialization**
   - Log at start of `initializeAll()`
   - Log each tenant processed
   - Log settings lookup results
   - Log bridge start success/failure

2. **Verify bridge settings exist in database**
   - Confirm settings structure
   - Verify credentials are present
   - Check enable flag

3. **Fix initialization timing**
   - Consider moving initialization later in boot sequence
   - Add retry logic if database not ready
   - Ensure proper error propagation

4. **Monitor after fix deployment**
   - Watch for bridge polling logs
   - Verify new data appears
   - Confirm WebSocket updates trigger

## System Information
- **Heroku App:** btech
- **URL:** https://onepanman.diabeetech.net
- **MongoDB:** Atlas multi-tenant setup
- **Node Version:** 20.19.4
- **Nightscout Version:** 15.0.2
- **Last Known Good Data:** July 20, 2025 9:18 PM CST (161 mg/dL)

## Expected Behavior When Fixed
1. Bridge manager initializes on server startup
2. Bridge polls Dexcom every 2.5 minutes
3. New glucose readings stored in MongoDB
4. WebSocket emits `data-received` event
5. Browser automatically updates without refresh
6. Latest glucose reading displayed within 3 minutes

## Contact for Questions
The system is in a partially working state. The core multi-tenant infrastructure and WebSocket updates are functioning, but the Dexcom bridge needs to be initialized properly to resume data collection.