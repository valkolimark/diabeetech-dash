# Database Unhealthy Status Investigation

## Problem Description
The admin dashboard is showing the database as "unhealthy" despite the application functioning normally. Need to investigate why the health check is failing and fix it.

## Current Status
- App Version: v214 (deployed 2025-07-25)
- Dyno: Performance-M (2.5GB RAM)
- Memory Usage: ~38MB (optimized)
- App Status: Working (onepanman.diabeetech.net responds 200 OK)
- Database Status: Shows as "unhealthy" on dashboard

## Investigation Areas

### 1. Database Health Check Implementation
Check how the database health is determined:
- Location: `lib/api/admin/system.js` or similar
- Look for health check logic
- Verify connection test methodology
- Check timeout settings

### 2. MongoDB Connection Issues
Investigate potential connection problems:
- Connection pool status
- Authentication issues
- Network connectivity
- Database URI configuration
- SSL/TLS certificate issues

### 3. Multi-Tenant Database Checks
Since this is a multi-tenant setup:
- Master database connection health
- Individual tenant database health
- Connection switching logic
- Resource limits per database

### 4. Recent Changes Impact
Consider if recent optimizations affected health checks:
- Connection pool reduced from 100 to 10
- Memory optimizations
- Any timeout changes

## Technical Context

### Environment Variables
```
MONGODB_URI or MASTER_MONGODB_URI - Master database
MONGO_CONNECTION or MONGOLAB_URI - Fallback URIs
Individual tenant databases created dynamically
```

### Database Architecture
- Master DB: Contains users, tenants, and shared data
- Tenant DBs: Named as ns_tenant_{subdomain}, contain tenant-specific data
- Connection pooling: Recently optimized to 10 connections max

### Files to Check
1. `lib/api/admin/system.js` - System health endpoints
2. `lib/api/admin/dashboard.js` - Dashboard data endpoints
3. `lib/server/storage/mongodbstorage.js` - MongoDB storage implementation
4. `lib/utils/connection-pool-config.js` - Connection configuration
5. `admin-dashboard/src/pages/Dashboard.js` - Frontend health display

## Test Scenarios

### 1. Direct Database Connection Test
```javascript
// Test connection to master database
const { MongoClient } = require('mongodb');
const uri = process.env.MASTER_MONGODB_URI || process.env.MONGODB_URI;
const client = new MongoClient(uri);
await client.connect();
await client.db().admin().ping();
```

### 2. Health Check Endpoint Test
```bash
curl https://www.diabeetech.net/api/v1/admin/system/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 3. Database Stats Check
```bash
heroku run "node -e 'require(\"mongodb\").MongoClient.connect(process.env.MONGODB_URI).then(c => c.db().stats().then(console.log))'" -a btech
```

## Expected Outcomes

1. **Find Root Cause**: Identify why health check reports "unhealthy"
2. **Fix Health Check**: Update logic if it's incorrectly reporting status
3. **Improve Monitoring**: Add better error messages for health failures
4. **Document Fix**: Update health check documentation

## Potential Quick Fixes

1. **Timeout Issue**: Increase health check timeout
2. **Connection String**: Verify all database URIs are correct
3. **Permissions**: Check database user permissions
4. **Pool Size**: Adjust connection pool if too restrictive

## Additional Information
- No actual database errors in application logs
- Users can access data normally
- CRUD operations working
- Only dashboard shows unhealthy status

## Success Criteria
- Dashboard shows database as "healthy"
- Health checks pass consistently
- No false negatives
- Clear error messages if genuinely unhealthy