# Nightscout Multi-Tenant Deployment Fixes

## Summary of Critical Fixes Applied

### 1. Profile Loading Fix (CRITICAL)
**Issue**: Profile data was not being properly initialized in the client, causing COB, BWP, and Basal plugins to crash.

**Root Cause**: `ctx.data` was initialized as an empty object instead of referencing the actual data from `client.ddata`.

**Fix Applied**: Updated `/lib/client/index.js` to:
- Initialize `ctx.data = client.ddata` instead of `ctx.data = {}`
- Pass `client.ddata` to sandbox initialization
- Ensure profile assignment uses `client.ddata.profile`

**File Changed**: `/lib/client/index.js`

### 2. Service Worker Cache Busting
**Issue**: Browser service workers were caching old JavaScript bundles, preventing fixes from reaching users.

**Fixes Applied**:
1. **Service Worker Updates** (`/views/service-worker.js`):
   - Added version tracking with `SW_VERSION`
   - Modified fetch handler to always fetch fresh copies of bundle files
   - Added `clients.claim()` to activate handler to take control immediately
   - Service worker now bypasses cache for bundle.app.js and bundle.clock.js

2. **HTML Cache Busting** (`/views/index.html`):
   - Added cache-busting query parameter to bundle.app.js: `?v=<%= locals.cachebuster %>`
   - Added sw-update.js script to force service worker updates

3. **Service Worker Update Script** (`/views/js/sw-update.js`):
   - Forces service worker update checks on page load
   - Automatically reloads page when new service worker is activated
   - Performs periodic update checks for 2 minutes after page load

## Deployment Steps for Heroku

1. **Commit all changes** (if not already done):
   ```bash
   git add .
   git commit -m "Fix profile loading and implement cache busting for multi-tenant Nightscout"
   ```

2. **Push to Heroku**:
   ```bash
   git push heroku main
   ```

3. **Verify webpack build completes** during deployment (happens automatically via postinstall)

4. **Clear Heroku build cache** (optional but recommended):
   ```bash
   heroku plugins:install heroku-builds
   heroku builds:cache:purge -a btech
   ```

5. **Restart dynos**:
   ```bash
   heroku restart -a btech
   ```

## User Instructions for Immediate Fix

Since service workers cache aggressively, users may need to manually clear their cache ONE TIME to get the fixes:

### Option 1: Use the clear-cache.js script
1. Open browser developer console (F12)
2. Copy and paste the contents of `clear-cache.js`
3. Press Enter to run
4. Page will reload automatically

### Option 2: Manual browser cache clear
1. Open Chrome DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Option 3: Incognito/Private window
1. Open an incognito/private browsing window
2. Navigate to the Nightscout URL
3. The fix should work immediately

## Verification Steps

After deployment and cache clearing:

1. **Check profile loading**:
   - Open browser console
   - Look for profile data in WebSocket messages
   - Verify no "Cannot read properties of undefined" errors

2. **Check service worker**:
   - DevTools > Application > Service Workers
   - Should see new version activated
   - Check "Update on reload" for testing

3. **Check bundle loading**:
   - DevTools > Network tab
   - bundle.app.js should have cache-busting parameter
   - Should see 200 status (not 304)

## Long-term Improvements Implemented

1. **Automatic cache busting**: Bundle URLs now include cachebuster parameter
2. **Service worker auto-update**: New service workers will automatically update and reload
3. **Profile initialization**: Fixed at the root cause, preventing future crashes

## Notes for Multi-Tenant Architecture

- The fixes are compatible with multi-tenant setup
- Each tenant shares the same JavaScript bundles
- Cache busting works across all tenants
- Profile loading fix applies to all tenant contexts

## Monitoring

After deployment, monitor for:
- JavaScript errors in browser console
- Profile loading success in WebSocket data
- Service worker update cycles
- User reports of stale cache issues (should be one-time only)