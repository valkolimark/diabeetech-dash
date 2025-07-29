# Tenant Status Report

## API Authentication Status: ✅ FIXED
All tenants can now access their APIs using the global API secret hash:
```bash
secret=51a26cb40dcca4fd97601d00f8253129091c06ca
```

## Data Collection Status: ❌ NEEDS FIXING

### Arimarco Tenant
- **API Access**: ✅ Working
- **Database**: nightscout-tenant-arimarco
- **Glucose Entries**: 291 entries
- **Latest Entry**: 118+ minutes old (stale data)
- **Dexcom Bridge**: Configured but not collecting current data
  - Username: ari@p5400.com
  - Password: SET
  - Enabled: true

### Jordan Tenant  
- **API Access**: ✅ Working
- **Database**: nightscout_3231e141e813d8b788a306ed
- **Glucose Entries**: 0 entries (no data)
- **Dexcom Bridge**: Configured but not collecting any data
  - Username: jordanmarco2323
  - Password: SET
  - Enabled: true

## What's Working
1. ✅ API authentication is working for all tenants
2. ✅ Tenant databases are properly configured
3. ✅ Dexcom bridges are configured with credentials
4. ✅ Admin users are set up for both tenants

## What Needs Fixing
1. ❌ Arimarco's Dexcom bridge is not collecting current data (last entry 2+ hours old)
2. ❌ Jordan's Dexcom bridge has never collected any data
3. ❌ Bridge manager may not be running or may have errors

## Next Steps
1. Check bridge manager status and logs
2. Verify Dexcom credentials are correct
3. Restart bridge services
4. Monitor for new glucose entries

## Test Commands
```bash
# Check Arimarco data
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# Check Jordan data  
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
```