# Debugging No Data Display Issue - Comprehensive Guide

## Current Status
- 5000 glucose entries successfully imported into MongoDB
- All major infrastructure issues fixed (webpack, socket.io, API endpoints)
- Data is NOT displaying at clinic2.diabeetech.net despite successful import

## Root Cause Analysis

### Issue 1: Client-Server WebSocket Communication Flow
The client needs to:
1. Connect to WebSocket server ✓
2. Send 'authorize' event with JWT token ✓
3. **Send 'subscribe' event after successful authorization** ← MISSING until latest fix
4. Receive 'dataUpdate' events with glucose data

### Issue 2: Tenant Context in Subscribe Handler
The WebSocket subscribe handler needs access to:
- tenantId (to know which database to query)
- tenantDb (MongoDB connection to tenant database)
- These are set during the 'authorize' event, not on initial connection

### Key Files to Check

1. **Client-side WebSocket flow**: `/lib/client/index.js`
   - Look for `socket.emit('authorize'` around line 1130
   - Ensure `socket.emit('subscribe'` is called after successful auth
   - Check console logs in browser DevTools

2. **Server-side WebSocket handler**: `/lib/server/websocket-multitenant.js`
   - authorize event handler (line ~277)
   - subscribe event handler (line ~396)
   - loadDataForTenant function (line ~155)

3. **Database queries**: Check if data is actually in MongoDB
   ```javascript
   // In loadDataForTenant function
   const entries = await tenantDb.collection('entries')
     .find({})
     .sort({ date: -1 })
     .limit(300)
     .toArray();
   ```

## Debugging Steps

### 1. Check Browser Console
Open DevTools at clinic2.diabeetech.net and look for:
```
Attempting to connect socket with options:
Client connected to server.
Authorizing socket
Authorization callback received:
Authorization successful, subscribing to data
Subscribe response:
dataUpdate received:
```

### 2. Check Server Logs
```bash
heroku logs --tail | grep -E "(WS:|Subscribe|dataUpdate|Found.*entries)"
```

Look for:
- "WS: Connection from client"
- "WS: Authorize client ID"
- "WS: subscribe client ID"
- "WS: loading data for tenant"
- "WS: Found X entries for tenant"

### 3. Verify MongoDB Data
```bash
# Connect to MongoDB and check entries
mongosh "mongodb+srv://..."
use nightscout-tenant-clinic2
db.entries.count()
db.entries.find().sort({date: -1}).limit(5)
```

### 4. Test WebSocket Flow Manually
In browser console at clinic2.diabeetech.net:
```javascript
// Check if socket is connected
console.log('Socket connected:', window.socket?.connected);

// Manually subscribe if needed
window.socket?.emit('subscribe', { category: 'data' }, (response) => {
  console.log('Manual subscribe response:', response);
});
```

## Recent Fixes Applied

1. **Added subscribe event emission** in client after successful authorization
2. **Added comprehensive logging** to both client and server
3. **Fixed authorization callback logic** to properly detect success
4. **Added tenant context validation** in subscribe handler

## Next Steps if Still Not Working

1. **Check if JWT token is being stored/retrieved**:
   ```javascript
   localStorage.getItem('authToken')
   ```

2. **Verify the authorize callback response structure**:
   - Should have `data.success = true` or `data.read` permission

3. **Check if treatments/profiles are needed**:
   - Some views might require profile data to render
   - Import profile collection from source database

4. **Verify data structure matches client expectations**:
   - entries should have: date, sgv, direction, etc.
   - Check receiveddata.js for expected format

## MongoDB Commands for Data Import

```bash
# Import profiles
mongoimport --uri "mongodb+srv://..." \
  --db nightscout-tenant-clinic2 \
  --collection profile \
  --file profile.json

# Import devicestatus  
mongoimport --uri "mongodb+srv://..." \
  --db nightscout-tenant-clinic2 \
  --collection devicestatus \
  --file devicestatus.json
```

## Emergency Fallback

If WebSocket data flow still isn't working, check if REST API works:
```bash
curl https://clinic2.diabeetech.net/api/v1/entries.json \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

This would indicate if the issue is specifically with WebSocket vs general data access.