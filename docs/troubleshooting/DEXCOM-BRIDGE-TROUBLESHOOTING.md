# Dexcom Bridge Troubleshooting Guide for Btech

## Overview
This guide provides procedures for troubleshooting and fixing Dexcom bridge data collection issues in the Btech Nightscout application hosted on Heroku.

## Current Status
- **API Authentication**: ✅ Working (Secret: `51a26cb40dcca4fd97601d00f8253129091c06ca`)
- **Arimarco Tenant**: ⚠️ Stale data (2+ hours old)
- **Jordan Tenant**: ❌ No data collected

## Quick Diagnostics

### 1. Check Current Data Status
```bash
# Test API endpoints
./test/test-api-endpoints.sh

# Check specific tenant data
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
```

### 2. Run Bridge Diagnostics
```bash
# Check bridge configuration and status
node tools/check-dexcom-bridge.js

# Test Dexcom connections
node tools/test-bridge-connection.js
```

### 3. Monitor Bridge Activity
```bash
# View real-time bridge logs
heroku logs --tail -a btech | grep -i bridge

# Check for errors
heroku logs --tail -a btech | grep -i "error\|fail"
```

## Common Issues and Solutions

### Issue 1: No Data Collection
**Symptoms**: API returns empty array `[]`

**Solutions**:
1. Verify Dexcom credentials:
   ```bash
   node tools/check-dexcom-bridge.js
   ```
2. Test Dexcom connection:
   ```bash
   node tools/test-bridge-connection.js
   ```
3. Restart the application:
   ```bash
   heroku restart -a btech
   ```

### Issue 2: Stale Data
**Symptoms**: Data is older than 10 minutes

**Solutions**:
1. Check bridge manager status:
   ```bash
   heroku ps -a btech
   ```
2. Look for bridge errors:
   ```bash
   heroku logs --tail -n 500 -a btech | grep -i "bridge error"
   ```
3. Restart bridge connections:
   ```bash
   ./tools/restart-dexcom-bridge.sh
   ```

### Issue 3: Authentication Failures
**Symptoms**: Bridge logs show "401 Unauthorized" or authentication errors

**Solutions**:
1. Verify Dexcom account credentials are correct
2. Check if Dexcom account is locked or requires verification
3. Update credentials in database if needed

### Issue 4: Database Connection Issues
**Symptoms**: "MongoError" or connection timeout errors

**Solutions**:
1. Check MongoDB connection string:
   ```bash
   heroku config:get MONGODB_URI -a btech
   ```
2. Verify database is accessible
3. Check connection pool settings

## Bridge Architecture

### Components
1. **Bridge Manager** (`lib/services/bridge-manager.js`)
   - Manages bridge instances for all tenants
   - Handles initialization and lifecycle
   - Monitors bridge health

2. **Multi-tenant Bridge** (`lib/plugins/bridge-multitenant.js`)
   - Fetches data from Dexcom Share API
   - Stores data in tenant-specific databases
   - Handles retry logic and error recovery

### Data Flow
1. Bridge polls Dexcom Share API every 2.6 minutes
2. Retrieved glucose data is validated
3. Data is stored in tenant-specific MongoDB collection
4. API endpoints serve the stored data

## Maintenance Procedures

### Daily Checks
1. Run API endpoint tests:
   ```bash
   ./test/test-api-endpoints.sh
   ```
2. Check data freshness for all tenants
3. Monitor error logs

### Weekly Maintenance
1. Review bridge performance metrics
2. Check for credential expiration
3. Analyze error patterns

### Monthly Tasks
1. Update Dexcom credentials if needed
2. Review and optimize bridge intervals
3. Clean up old log entries

## Emergency Procedures

### Complete Bridge Failure
1. **Immediate Action**:
   ```bash
   heroku restart -a btech
   ```

2. **If restart doesn't help**:
   - Check Heroku dyno status: `heroku ps -a btech`
   - Review recent deployments: `heroku releases -a btech`
   - Rollback if needed: `heroku rollback -a btech`

3. **Verify environment variables**:
   ```bash
   heroku config -a btech | grep BRIDGE
   ```

### Data Recovery
If data is missing for a period:
1. Increase fetch window in bridge settings
2. Manually trigger bridge fetch
3. Monitor logs for successful retrieval

## Tools Reference

### Test Tools (`/test`)
- `test-api-endpoints.sh` - Tests all API endpoints for both tenants

### Diagnostic Tools (`/tools`)
- `check-dexcom-bridge.js` - Checks bridge configuration and data status
- `test-bridge-connection.js` - Tests Dexcom API connectivity
- `restart-dexcom-bridge.sh` - Restarts bridge connections
- `fix-dexcom-bridge.sh` - Automated fix procedures

## Contact and Support
- **Application**: Btech (Nightscout multi-tenant)
- **Platform**: Heroku
- **Database**: MongoDB Atlas

## Additional Resources
- [Nightscout Documentation](http://www.nightscout.info/)
- [Dexcom Share API Information](https://github.com/nightscout/share2nightscout-bridge)
- [Heroku CLI Documentation](https://devcenter.heroku.com/articles/heroku-cli)