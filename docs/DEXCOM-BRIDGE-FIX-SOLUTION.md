# Dexcom Bridge Fix Solution

## Problem Summary
On July 29, 2025, both tenants (Arimarco and Jordan) were not receiving live glucose data from Dexcom:
- **Arimarco**: Had stale data (13+ hours old)
- **Jordan**: Had no data at all

## Root Cause
The Dexcom bridge credentials in the database were either missing or incorrect, preventing the bridge from authenticating with Dexcom Share API.

## Solution Steps

### 1. Identified the Issue
```bash
# Checked API endpoints - both were working
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# Result: APIs working but Arimarco had old data, Jordan had no data
```

### 2. Verified Dexcom Credentials
Created a test script to verify the provided Dexcom credentials were valid:
- **Arimarco**: `ari@p5400.com` / `CamZack23!` ✅
- **Jordan**: `jordanmarco2323` / `Camzack23` ✅

Both credentials successfully authenticated with Dexcom Share API.

### 3. Updated Database Credentials
```bash
# Retrieved MongoDB URI from Heroku
heroku config -a btech | grep MONGODB_URI

# Updated credentials using the live database connection
node tools/update-live-dexcom-credentials.js "mongodb+srv://..."
```

The script updated both `settings` and `profile` collections for each tenant with:
- Correct username and password
- Bridge enabled: true
- Interval: 150000ms (2.5 minutes)

### 4. Restarted the Application
```bash
heroku restart -a btech
```

### 5. Verified Data Collection
After restart, both tenants immediately began receiving fresh glucose data:
- **Arimarco**: 228 mg/dL (fresh data)
- **Jordan**: 129 mg/dL (fresh data)

## Key Files Modified

### Database Collections Updated
- `nightscout-tenant-arimarco.settings`
- `nightscout-tenant-arimarco.profile`
- `nightscout_3231e141e813d8b788a306ed.settings`
- `nightscout_3231e141e813d8b788a306ed.profile`

### Scripts Created
- `/tools/test-dexcom-credentials.js` - Tests Dexcom API credentials
- `/tools/update-live-dexcom-credentials.js` - Updates credentials in live database
- `/tools/fix-dexcom-credentials-complete.sh` - Automated fix process

## Monitoring Commands
```bash
# Check current data
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# Monitor bridge logs
heroku logs --tail -a btech | grep -i bridge
```

## Prevention
1. Always verify Dexcom credentials are correct before deployment
2. Monitor data freshness regularly
3. Set up alerts for stale data (>10 minutes old)
4. Keep credentials updated in password manager