# Nightscout Multi-Tenant Memory Optimization Guide

## Current Issues
- Memory quota exceeded errors (R14)
- 512MB limit on Standard-1X dynos
- Multiple tenant databases consuming connections
- No data retention policy
- Inefficient connection pooling

## Immediate Actions

### 1. Set Node.js Memory Configuration
Add to Heroku config:
```bash
heroku config:set NODE_OPTIONS="--max-old-space-size=400 --optimize-for-size --gc-interval=100" -a btech
```

This:
- Limits heap to 400MB (leaving 112MB for system)
- Optimizes for memory over speed
- Runs garbage collection more frequently

### 2. Update Database Connection Configuration
The code already includes optimized connection settings in `lib/utils/connection-pool-config.js`:
- Reduced pool size from 100 to 10 connections
- Faster idle timeout (30 seconds)
- Connection compression enabled

To apply:
```javascript
// In connectionManager.js
const poolConfig = require('./connection-pool-config');
const client = new MongoClient(uri, poolConfig(env));
```

### 3. Implement Data Retention Policy
Run the cleanup script to see what can be removed:
```bash
# Dry run first
node scripts/cleanup-old-data.js

# Execute cleanup
node scripts/cleanup-old-data.js --execute
```

### 4. Add Critical Database Indexes
Connect to MongoDB and run:
```javascript
// Master database indexes
db.entries.createIndex({ date: -1 });
db.entries.createIndex({ tenant: 1, date: -1 });
db.treatments.createIndex({ created_at: -1 });
db.treatments.createIndex({ tenant: 1, created_at: -1 });
db.devicestatus.createIndex({ created_at: -1 });
db.users.createIndex({ email: 1 });
db.users.createIndex({ tenant: 1 });
db.tenants.createIndex({ subdomain: 1 });
db.tenants.createIndex({ isActive: 1 });

// For each tenant database
db.entries.createIndex({ date: -1 });
db.treatments.createIndex({ created_at: -1 });
db.devicestatus.createIndex({ created_at: -1 });
```

## Scheduled Maintenance

### Daily Cleanup Cron Job
Create a Heroku Scheduler task:
```bash
# Add to scheduler (daily at 3 AM)
node scripts/cleanup-old-data.js --execute
```

### Weekly Database Optimization
```javascript
// Compact collections to reclaim space
db.entries.compact();
db.treatments.compact();
db.devicestatus.compact();
```

## Code Optimizations

### 1. Reduce WebSocket Overhead
In `websocket-multitenant.js`, increase intervals:
```javascript
// From: setInterval(..., 60000);  // 1 minute
// To:   setInterval(..., 300000); // 5 minutes
```

### 2. Limit Bridge Polling
In `bridge-multitenant.js`, ensure reasonable intervals:
```javascript
interval: Math.max(bridgeSettings.interval, 150000) // Minimum 2.5 minutes
```

### 3. Implement Request Caching
Add Redis or in-memory caching for frequent queries:
```javascript
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

function getCached(key, fetcher) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}
```

## Monitoring

### 1. Add Memory Monitoring Endpoint
The code includes `/api/v1/admin/memory` endpoint. Add to admin routes:
```javascript
// In lib/api/admin/index.js
router.use('/memory', require('./memory'));
```

### 2. Set Up Alerts
```bash
# Memory usage alert
heroku alerts:add memory_quota_exceeded -a btech

# Response time alert
heroku alerts:add response_time -a btech
```

### 3. Regular Monitoring Commands
```bash
# Check current memory
heroku ps -a btech

# View metrics
heroku metrics -a btech

# Check database size
heroku addons:info mongodb -a btech
```

## Long-term Solutions

### 1. Upgrade Dyno Type
If optimizations aren't enough:
```bash
heroku ps:type standard-2x -a btech  # 1GB memory
```

### 2. Implement Data Archiving
- Move data older than 1 year to cold storage
- Use separate database for historical data

### 3. Enable Horizontal Scaling
- Add more dynos for load distribution
- Implement proper session affinity for WebSockets

### 4. Database Sharding
- Shard by tenant ID for better distribution
- Use MongoDB Atlas auto-scaling

## Emergency Response

If memory errors persist:

1. **Immediate Relief**:
   ```bash
   heroku restart -a btech
   ```

2. **Clear Caches**:
   ```javascript
   // Force garbage collection via API
   curl -X POST https://www.diabeetech.net/api/v1/admin/memory/gc
   ```

3. **Reduce Active Connections**:
   - Temporarily disable less critical features
   - Reduce bridge polling frequency
   - Clear stale WebSocket connections

## Success Metrics

After implementing these optimizations, you should see:
- Memory usage stable below 450MB
- No R14 errors in logs
- Response times under 1 second
- Database queries under 100ms

## Commit These Changes

Add to your deployment:
1. Connection pool configuration
2. Memory monitoring endpoint  
3. Cleanup scripts
4. Updated Procfile with NODE_OPTIONS

```bash
git add -A
git commit -m "Add memory optimization and database cleanup tools"
git push heroku main
```