# Profile Creation Guide for Diabeetech

## Current Status
- ✅ WebSocket connection working - receiving 300 glucose entries
- ✅ Authentication headers fixed for API calls
- ❌ Profile creation blocked due to permission requirements

## Issue Summary
The profile API endpoints require specific permissions that are not granted through JWT authentication alone. The system appears to be configured to require an API_SECRET for certain operations.

## Solutions

### Option 1: Use the Profile Creation Helper Page
1. Make sure you're logged in at https://clinic2.diabeetech.net/login
2. Navigate to https://clinic2.diabeetech.net/create-profile.html
3. Click "Create Default Profile" 
4. The page will attempt multiple methods to create the profile

### Option 2: Configure API_SECRET on Server
If you have access to the server environment variables:
1. Set `API_SECRET` to a value at least 12 characters long
2. Restart the server
3. Use the hashed API secret in requests

### Option 3: Direct MongoDB Import
If you have MongoDB access:
```bash
# Connect to MongoDB and run:
use nightscout-tenant-clinic2
db.profile.insertOne({
  "_id": "defaultProfile",
  "defaultProfile": "Default",
  "startDate": new Date().toISOString(),
  "mills": Date.now(),
  "units": "mg/dl", 
  "dia": 4,
  "timezone": "America/Chicago",
  "basal": [{"time": "00:00", "value": 1.0}],
  "carbratio": [{"time": "00:00", "value": 10}],
  "sens": [{"time": "00:00", "value": 50}],
  "target_low": [{"time": "00:00", "value": 80}],
  "target_high": [{"time": "00:00", "value": 120}]
})
```

### Option 4: Modify Server Permissions
The authorization check shows:
- User role: admin
- But permissions: canRead: false, canWrite: false, isAdmin: false

This suggests the multi-tenant authorization system needs configuration to grant profile creation permissions to admin users.

## Files Modified
1. `/views/index.html` - Added authentication fixes
2. `/views/profileindex.html` - Added authentication fixes 
3. `/static/js/fix-profile-auth.js` - JWT token injection for API calls
4. `/static/js/profile-auth-fix.js` - Profile editor specific fixes
5. `/static/create-profile.html` - Helper page for profile creation

## Next Steps
Once a profile is created through any of the above methods, the main page at https://clinic2.diabeetech.net/ should display the glucose graph correctly since the WebSocket data is already flowing.