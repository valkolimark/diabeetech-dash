# Clock Views Changes Log

## Session 1 (Initial Investigation)
- Identified clock views not working in multi-tenant mode
- Found issues with plugin registration and properties endpoint

## Session 2 (Multiple Fixes Applied)

### 1. Clock Plugin Creation
**File**: `/lib/plugins/clock.js` (NEW)
```javascript
// Created minimal clock plugin to prevent registration errors
module.exports = function init(ctx) {
  return {
    name: 'clock',
    label: 'Clock Views',
    pluginType: 'clock',
    setProperties: function() { /* ... */ }
  };
};
```

### 2. Plugin Registration
**File**: `/lib/plugins/index.js`
```javascript
// Added clock to both server and client default plugins
var serverDefaultPlugins = [
  // ... existing plugins ...
  , require('./clock')(ctx)  // ADDED
];

var clientDefaultPlugins = [
  // ... existing plugins ...
  , require('./clock')(ctx)  // ADDED
];
```

### 3. Clock View Template Fix
**File**: `/lib/server/clocks.js`
```javascript
// Fixed locals merging to expose bundle path
res.render('clock.html', Object.assign({}, locals, {
  face,
  locals
}));
```

### 4. Authorization Fix
**File**: `/lib/middleware/tenantDataloader.js`
```javascript
// Added authorization initialization
if (!req.ctx.authorization) {
  req.ctx.authorization = ctx.authorization || require('../authorization')(env, req.ctx);
}
```

### 5. API Wares Fix
**File**: `/lib/server/app-multitenant.js`
```javascript
// Fixed wares parameter for API v1
if (apiModuleFactory === api && !apiArgs.includes(requestCtx.wares)) {
  apiArgs = [requestCtx.wares, ...apiArgs];
}
```

### 6. Plugin Context Fix
**File**: `/lib/middleware/tenantDataloader.js`
```javascript
// Create proper context for plugins with settings
const pluginCtx = Object.assign({}, ctx, {
  settings: tenantSettings,
  language: req.ctx.language || ctx.language,
  levels: req.ctx.levels,
  moment: req.ctx.moment
});
const pluginsModule = require('../plugins')(pluginCtx);
```

### 7. Auto-enable Clock Plugin
**File**: `/lib/middleware/tenantDataloader.js`
```javascript
// Ensure clock is in enabled plugins
if (tenantSettings && tenantSettings.enable && !tenantSettings.enable.includes('clock')) {
  console.log('Adding clock to enabled plugins');
  tenantSettings.enable.push('clock');
}
```

### 8. Enhanced Logging
**File**: `/lib/api2/properties.js`
```javascript
// Added detailed logging
console.log('Properties endpoint - checking auth');
console.log('req.ctx exists:', !!req.ctx);
console.log('sbx.properties keys:', Object.keys(sbx.properties));
console.log('sbx.properties content:', JSON.stringify(sbx.properties, null, 2).substring(0, 500));
```

## Current Issue
Despite all fixes, the properties endpoint still returns 500 errors. The core issue appears to be that `sbx.properties` remains empty even after `plugins.setProperties(sbx)` is called.

## Deployment History
- v137: Initial clock plugin fix
- v138: Clock view template fix  
- v139: Authorization initialization fix
- v140: API wares and plugin loading fix
- v141: Enhanced logging and auto-enable clock
- v142: Additional logging for properties endpoint