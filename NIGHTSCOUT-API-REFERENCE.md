# Nightscout API Reference

## Multi-Tenant Authentication
- JWT token stored in localStorage as 'authToken'
- Token must be included in WebSocket auth and API requests
- Bridge settings stored in tenant database (not main database)

## Key MongoDB URIs
- Master URI: Stored in MASTER_MONGODB_URI environment variable
- Tenant database: `nightscout_multi_tenant` 
- Tenant collection: `users` (stores tenant info)
- Settings collection: `settings` (stores bridge credentials)

## WebSocket Configuration
- Authorization requires JWT token or API secret hash
- Data subscription follows successful authorization
- Real-time glucose updates flow through WebSocket

## Important Fixes Applied
1. **Latest SGV Detection**: Changed from using last array element to using _.maxBy(sgvs, 'mills')
2. **Chart Opacity**: Entries appear as "retro" when older than 25 minutes due to futureOpacity scaling
3. **Data Sorting**: Server sends newest-first, client sorts oldest-first after merge

## Bridge Settings Structure
```javascript
{
  type: 'bridge',
  settings: {
    shareServer: 'https://shareous1.dexcom.com',
    shareUserName: 'your-username',
    sharePassword: 'your-password'
  }
}
```

## Debug Scripts Created
- `/static/js/chart-data-debug.js` - Monitors chart data and opacity calculations
- `check-tenant.js` - Checks tenant database and latest glucose readings
- `update-dexcom-creds.js` - Updates Dexcom credentials in tenant database