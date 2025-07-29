# Dexcom Bridge Setup Guide for Btech

## Quick Start

### For Existing Tenants
If a tenant already exists but needs Dexcom bridge setup:

1. **Get their Dexcom credentials**
   - Username (email or Dexcom username)
   - Password
   - Ensure they have Share enabled in Dexcom app

2. **Run the complete fix script**
   ```bash
   ./tools/fix-dexcom-credentials-complete.sh
   ```

3. **Or manually update**
   ```bash
   # Get MongoDB URI
   heroku config:get MONGODB_URI -a btech
   
   # Edit tools/update-live-dexcom-credentials.js with credentials
   # Run the update
   node tools/update-live-dexcom-credentials.js "mongodb+srv://..."
   
   # Restart app
   heroku restart -a btech
   ```

### For New Tenants

1. **Register the tenant first** (via admin dashboard or API)

2. **Add to credential update script**
   Edit `tools/update-live-dexcom-credentials.js`:
   ```javascript
   const tenantConfigs = [
     // ... existing tenants ...
     {
       database: 'nightscout-tenant-newuser',
       username: 'their_dexcom_username',
       password: 'their_dexcom_password',
       name: 'New User'
     }
   ];
   ```

3. **Run the setup**
   ```bash
   node tools/update-live-dexcom-credentials.js "$(heroku config:get MONGODB_URI -a btech)"
   heroku restart -a btech
   ```

## Manual Database Setup

If you need to manually configure a tenant's Dexcom bridge:

### Using MongoDB Compass or Shell

1. **Connect to the database**
   ```
   mongodb+srv://username:password@cluster.mongodb.net/
   ```

2. **Navigate to tenant database**
   ```
   use nightscout-tenant-[subdomain]
   ```

3. **Update settings collection**
   ```javascript
   db.settings.updateOne(
     {},
     {
       $set: {
         "bridge.userName": "dexcom_username",
         "bridge.password": "dexcom_password",
         "bridge.enable": true,
         "bridge.interval": 150000
       }
     },
     { upsert: true }
   )
   ```

4. **Update profile collection**
   ```javascript
   db.profile.updateOne(
     { _id: "default" },
     {
       $set: {
         "bridge.userName": "dexcom_username",
         "bridge.password": "dexcom_password",
         "bridge.enable": true,
         "bridge.interval": 150000
       }
     }
   )
   ```

## Verification Steps

### 1. Check Configuration
```bash
node tools/check-dexcom-bridge.js
```

### 2. Test Credentials
```bash
node tools/test-dexcom-credentials.js
```

### 3. Monitor Data Collection
```bash
# Check API for data
curl "https://[subdomain].diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# Watch bridge logs
heroku logs --tail -a btech | grep -i bridge
```

## Troubleshooting

### No Data Appearing
1. Wait 5 minutes after restart
2. Check credentials are correct
3. Verify Dexcom Share is enabled
4. Check logs for errors

### Authentication Errors
```bash
# Common error messages:
"SessionIdNotFound" - Need to restart app
"AccountPasswordInvalid" - Wrong credentials
"MaximumDevicesReached" - Too many followers
```

### Data Stops Updating
1. Check if Dexcom app is still updating
2. Restart the Heroku app
3. Re-verify credentials

## Current Active Tenants

### Arimarco
- **Subdomain**: arimarco.diabeetech.net
- **Database**: nightscout-tenant-arimarco
- **Dexcom Username**: ari@p5400.com
- **Status**: ✅ Active

### Jordan
- **Subdomain**: jordan.diabeetech.net
- **Database**: nightscout_3231e141e813d8b788a306ed
- **Dexcom Username**: jordanmarco2323
- **Status**: ✅ Active

## Tools Reference

### Diagnostic Tools
- `tools/check-dexcom-bridge.js` - Check all tenant bridge configurations
- `tools/test-dexcom-credentials.js` - Test Dexcom API connectivity
- `tools/test-bridge-connection.js` - Test bridge for all tenants

### Fix Tools
- `tools/update-live-dexcom-credentials.js` - Update credentials in database
- `tools/fix-dexcom-credentials-complete.sh` - Complete automated fix
- `tools/restart-dexcom-bridge.sh` - Restart bridge connections

### Testing
- `test/test-api-endpoints.sh` - Test all API endpoints

## Best Practices

1. **Test credentials first** before updating database
2. **Always restart app** after credential changes
3. **Monitor logs** during initial setup
4. **Document credentials** securely (password manager)
5. **Regular monitoring** of data freshness

## Support Commands

```bash
# Full system check
./test/test-api-endpoints.sh

# Quick data check
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca" | jq '.[0]'
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca" | jq '.[0]'

# Bridge status
heroku logs -n 100 -a btech | grep -i "bridge\|dexcom"
```