# Manual Profile Setup Instructions

## Your API Secret Hash
```
API Secret: GodIsSoGood2Me23!
SHA-1 Hash: 51a26cb40dcca4fd97601d00f8253129091c06ca
```

## Method 1: Browser Console (Recommended)

1. Go to https://clinic2.diabeetech.net/
2. Open browser developer console (F12)
3. Run this command to save the API secret:
```javascript
localStorage.setItem('apisecrethash', '51a26cb40dcca4fd97601d00f8253129091c06ca');
```

4. Now go to the profile editor: https://clinic2.diabeetech.net/profile
5. The page should load without authentication errors
6. Create a new profile with these basic settings:
   - Name: Default
   - Timezone: America/Chicago (or your timezone)
   - Units: mg/dl
   - DIA: 4 hours
   - Carb Ratio: 10g (1U per 10g carbs)
   - Sensitivity: 50 mg/dl per U
   - Basal: 1.0 U/hr
   - Target Low: 80 mg/dl
   - Target High: 120 mg/dl

## Method 2: Direct MongoDB (If you have access)

Since the API is returning 500 errors, you may need to insert directly:

```javascript
use nightscout-tenant-clinic2
db.profile.insertOne({
  "_id": ObjectId(),
  "defaultProfile": "Default",
  "store": {
    "Default": {
      "dia": 4,
      "carbratio": [{"time": "00:00", "value": 10}],
      "sens": [{"time": "00:00", "value": 50}],
      "basal": [{"time": "00:00", "value": 1.0}],
      "target_low": [{"time": "00:00", "value": 80}],
      "target_high": [{"time": "00:00", "value": 120}],
      "units": "mg/dl",
      "timezone": "America/Chicago"
    }
  },
  "startDate": new Date().toISOString(),
  "mills": Date.now(),
  "units": "mg/dl"
})
```

## Method 3: Check Server Logs

The 500 error suggests a server-side issue. Check the Heroku logs:
```bash
heroku logs --tail --app your-app-name
```

Look for errors related to:
- MongoDB connection issues
- Permission problems
- Collection creation failures

## Current Status
- ✅ API Secret is working (authentication successful)
- ✅ WebSocket data is flowing (300 glucose entries)
- ❌ Profile endpoints returning 500 errors

The profile creation is the last step needed. Once a profile exists, the glucose graph should display correctly.