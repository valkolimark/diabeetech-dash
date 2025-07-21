# Nightscout Multi-Tenant Clock Views Fix - Session 2

## Current Issue
The Clock Views (Clock, Color, Simple, and Config) in the Nightscout multi-tenant instance are not working. The pages load but display blank content. The root cause is that plugins are not being loaded properly, resulting in an empty properties response.

## Error Details
- GET https://onepanman.diabeetech.net/api/v2/properties?secret=XXX returns 500 error
- Logs show: "Available plugins: No plugins loaded" and "enabled plugins: []"
- Clock views depend on properties endpoint which needs plugins to populate data

## Previous Session Work (Session 1)

### Changes Made:
1. **Enhanced error handling** in `/lib/api2/properties.js`
2. **Multi-tenant support** for `/api/v1/status.js` and `/api/v2/properties` endpoints
3. **Added default enabled plugins** in `/lib/middleware/tenantDataloader.js`
4. **Fixed plugin module registration** 
5. **Added comprehensive debugging** throughout the system

### What's Working:
- Main Nightscout app works correctly
- Real-time data updates work
- Status endpoint returns data with correct settings
- SGV data is being loaded (264 entries confirmed in logs)
- Tenant settings are loaded with many enabled plugins

### What's NOT Working:
- Plugins are not being registered despite correct settings
- Properties endpoint returns empty properties object
- Clock views show blank due to missing bgnow data

## Root Cause Analysis

The logs clearly show:
```
Sandbox settings.enable: ['careportal', 'iob', 'cob', 'bwp', 'cage', 'sage', 'iage', 'treatmentnotify', 'basal', 'dbsize', 'delta', 'direction', 'timeago', 'ar2', 'treatmentnotify', 'bgnow', 'devicestatus', 'upbat', 'errorcodes', 'profile', 'bolus', 'runtimestate', 'simplealarms', 'ar2']
Available plugins: No plugins loaded
setProperties called, enabled plugins: []
```

This indicates the plugin registration is failing somewhere between:
1. Creating the plugins module with settings
2. Calling registerServerDefaults()
3. The internal plugin.register() method

## Key Code Locations

### Plugin System:
- `/lib/plugins/index.js` - Main plugin manager
- `/lib/plugins/bgnow.js` - BGNow plugin that provides glucose data for clocks
- `/lib/middleware/tenantDataloader.js` - Where plugins are initialized for tenants

### Current Plugin Initialization (lines 91-98 in tenantDataloader.js):
```javascript
const pluginsModule = require('../plugins')({
  settings: tenantSettings,
  language: req.ctx.language || ctx.language,
  levels: req.ctx.levels,
  moment: req.ctx.moment
});
pluginsModule.registerServerDefaults();
req.ctx.plugins = pluginsModule;
```

## Technical Context

### Plugin Registration Flow:
1. Plugin module is created with context (settings, language, levels, moment)
2. `registerServerDefaults()` should call `register()` with server plugins
3. `register()` should filter plugins based on `settings.enable` array
4. Each enabled plugin should be stored in `enabledPlugins` array
5. `setProperties()` iterates through enabled plugins to populate sandbox

### Clock View Requirements:
- `/api/v2/properties` must return at minimum:
  - `bgnow` object with current SGV data
  - `delta` object with change information
  - Other plugin properties (direction, timeago, etc.)

## Investigation Needed

1. **Why is plugin.register() not populating enabledPlugins?**
   - Is the enable array format correct?
   - Is the plugin name matching working?
   - Are the plugins being loaded at all?

2. **Plugin Context Issues**
   - Are all required context properties available?
   - Is there a circular dependency?
   - Is the module caching causing issues?

3. **Multi-tenant Specific**
   - Does the plugin system work in single-tenant mode?
   - Is there a conflict with how plugins are initialized per request?

## Success Criteria
1. Clock views display current glucose readings
2. `/api/v2/properties` returns populated data including bgnow
3. No 500 errors
4. All clock view types work (Clock, Color, Simple, Config)

## Test URLs
- Clock View: https://onepanman.diabeetech.net/clock/clock
- Properties API: https://onepanman.diabeetech.net/api/v2/properties?secret=51a26cb40dcca4fd97601d00f8253129091c06ca
- Status API: https://onepanman.diabeetech.net/api/v1/status.js?secret=51a26cb40dcca4fd97601d00f8253129091c06ca

## Important Notes
- This is a multi-tenant Heroku deployment
- The main app works fine, only clock views are affected
- All data is present, it's just the plugin system failing to initialize