# Multi-Tenant Nightscout Troubleshooting Session

## System Overview
We have a multi-tenant Nightscout instance with the following architecture:
- Master MongoDB database containing tenant and user collections
- Separate MongoDB databases for each tenant (naming convention: nightscout-tenant-USERNAME)
- WebSocket-based real-time updates
- Dexcom Share Bridge integration for live CGM data
- JWT-based authentication

## Current Issue
The system is not automatically updating with new glucose readings in the browser, despite:
1. Bridge successfully polling Dexcom every 2.5 minutes
2. New data being stored in MongoDB (verified with direct queries)
3. WebSocket connection established and authenticated
4. Manual browser refresh shows the latest data

## Key Files and Their Roles
- `/lib/server/websocket-multitenant.js` - Handles WebSocket connections and data updates
- `/lib/plugins/bridge-multitenant.js` - Manages Dexcom bridge instances per tenant
- `/lib/services/bridge-manager.js` - Initializes and manages bridges for all tenants
- `/lib/client/index.js` - Client-side initialization and data handling
- `/lib/server/bootevent-multitenant.js` - Server boot sequence for multi-tenant mode

## Recent Fixes Applied
1. Fixed profile initialization errors by properly setting ctx.data = client.ddata
2. Implemented cache-busting by renaming bundle files to force browser updates
3. Fixed profile data structure mismatch (flat vs nested with store property)
4. Added SGV field mapping (date→mills, sgv→mgdl) for client compatibility
5. Updated D3.js mouse events to use d3.pointer() for v6+ compatibility
6. Fixed bridge configuration to use tenant-level settings
7. Added dummy nightscout config to prevent bridge posting errors
8. Implemented data-received event handler in WebSocket for automatic updates

## Current Status
- Tenant: onepanman
- Latest reading in MongoDB: 175 mg/dL at 9:28 PM CST
- Browser showing: 161 mg/dL from 9:18 PM CST (older data)
- Bridge polling interval: 2.5 minutes (150000ms)
- WebSocket: Connected and authenticated
- Manual refresh: Works correctly, shows latest data

## Environment Details
- Deployed on Heroku
- Multi-tenant mode: ENABLED
- Authentication: JWT tokens
- Timezone: America/Chicago (Central Time)

## Debugging Information Needed
1. Bridge logs showing polling activity
2. WebSocket event logs showing data-received events
3. Browser console logs showing WebSocket messages
4. Network tab showing WebSocket frames

## Expected Behavior
When the bridge fetches new data from Dexcom and stores it in MongoDB, it should:
1. Emit a 'data-received' event on the main event bus
2. WebSocket handler should catch this event and reload data for the tenant
3. WebSocket should emit 'dataUpdate' to all connected clients for that tenant
4. Browser should automatically update the display without manual refresh

## Investigation Focus
The data flow appears to break somewhere between MongoDB storage and WebSocket client update. The bridge is successfully fetching and storing data, but the automatic update mechanism isn't triggering properly.

## Solution Found
The issue was in `/lib/plugins/bridge-multitenant.js` where the bridge was creating a new bus instance instead of using the shared bus that WebSocket handlers are listening to:

```javascript
// WRONG - Creates new bus instance
const mainBus = require('../bus')(tenantCtx.env.settings, tenantCtx);

// CORRECT - Uses shared bus instance from context
tenantCtx.bus.emit('data-received', {
  tenantId: tenantId,
  source: 'bridge',
  count: created ? created.length : 0
});
```

This prevented the `data-received` events from reaching the WebSocket module, causing automatic updates to fail. The fix ensures events are emitted on the shared bus instance that all components are listening to.