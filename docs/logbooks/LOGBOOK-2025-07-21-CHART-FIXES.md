# Nightscout Chart Display Fixes Logbook
**Date:** July 21, 2025
**System:** Multi-tenant Nightscout on Heroku (app: btech)

## Chart Display Issues Fixed

### 1. Chart-focus Not Displaying Data ✅
**Problem:** Main glucose chart (chart-focus) was empty despite receiving data
**Root Cause:** Data binding issue in renderer.js
**Solution:** Fixed data flow and ensured client.entries was properly populated
**Result:** Chart now displays glucose readings correctly

### 2. Current Readings Showing as "Retro" ✅
**Problem:** Current glucose readings appeared faded/transparent
**Root Cause:** Opacity calculation in renderer.js was applying fade to all past data
**Solution:** Modified opacity logic to only fade future predictions:
```javascript
// Old: All past data was faded
return chart().futureOpacity(d.mills - client.latestSGV.mills);

// New: Only future data is faded
if (timeDiff <= 0) {
  return 1; // Full opacity for current/past data
}
return chart().futureOpacity(timeDiff);
```
**Result:** Current readings now show with full opacity

### 3. Incorrect Latest SGV Detection ✅
**Problem:** System was using oldest reading as "latest"
**Root Cause:** Array sorting issue - using last element of oldest-to-newest array
**Solution:** Changed from array index to _.maxBy():
```javascript
// Old: client.latestSGV = client.ddata.sgvs[client.ddata.sgvs.length - 1];
// New: 
client.latestSGV = _.maxBy(client.ddata.sgvs, 'mills');
```
**Result:** Latest reading correctly identified

### 4. Time Ago Showing "2 days ago" ✅
**Problem:** Header showing "2 days ago" instead of current time
**Root Cause:** lastEntry function using _.findLast on oldest-to-newest array
**Solution:** Changed to use _.maxBy to find most recent entry:
```javascript
// Old: _.findLast(entries, function notInTheFuture (entry) {...})
// New:
var validEntries = _.filter(entries, function notInTheFuture (entry) {
  return sbx.entryMills(entry) <= sbx.time;
});
return _.maxBy(validEntries, function (entry) {
  return sbx.entryMills(entry);
});
```
**Result:** Time ago now shows correct elapsed time (e.g., "5m ago")

### 5. Current BG Strikethrough ✅
**Problem:** Current glucose reading had strikethrough indicating stale data
**Root Cause:** Caused by incorrect time ago calculation
**Solution:** Fixed by correcting lastEntry function (same as #4)
**Result:** No more strikethrough on current readings

## Additional Issues Fixed

### 6. Delta Pill Not Showing ✅
**Problem:** Delta (change between readings) not displaying
**Root Cause:** Delta plugin not included in ENABLE environment variable
**Solution:** Updated Heroku config:
```bash
heroku config:set ENABLE="careportal iob cob bwp cage sage iage treatmentnotify basal dbsize delta direction timeago ar2"
```
**Result:** Delta pill now shows BG change between readings

### 7. Forecast Dots Missing ✅
**Problem:** AR2 prediction circles not visible on chart
**Root Cause:** AR2 plugin requires 'predict' in ALARM_TYPES
**Solution:** Updated Heroku config:
```bash
heroku config:set ALARM_TYPES="simple predict"
```
**Result:** Forecast dots now display future BG predictions

### 8. DBSize Pill Missing ✅
**Problem:** Database size indicator not showing
**Root Cause:** Plugin was enabled but not in SHOW_PLUGINS
**Solution:** Updated Heroku config:
```bash
heroku config:set SHOW_PLUGINS="careportal basal dbsize delta direction timeago"
```
**Result:** DBSize pill now visible

## Technical Details

### Files Modified
1. `/lib/client/index.js` - Fixed latest SGV detection
2. `/lib/client/renderer.js` - Fixed opacity calculation
3. `/lib/sandbox.js` - Fixed lastEntry function
4. `/views/index.html` - Added debug script

### Debug Scripts Created
1. `chart-data-debug.js` - Monitor chart data flow
2. `opacity-debug.js` - Debug opacity calculations
3. `timeago-debug.js` - Debug time ago calculations

### Deployment Commands
```bash
# Build bundle
npx webpack --config webpack/webpack.config.js
cp ./node_modules/.cache/_ns_cache/public/js/bundle.app.v2.js static/bundle/js/bundle.app.js

# Deploy to Heroku
git add -A
git commit -m "Fix description"
git push heroku main
```

## Summary of All Fixes

✅ **Chart Display Fixed:**
- Chart-focus now displays glucose data
- Current readings show with proper opacity
- Time calculations are accurate

✅ **Pills Fixed:**
- Delta pill shows BG changes
- DBSize pill displays database statistics
- All enabled pills now visible

✅ **Forecast Fixed:**
- AR2 prediction dots now display
- Future BG predictions visible on chart

## Final Configuration
All issues have been resolved. The Nightscout instance is now fully functional with:
- Real-time glucose monitoring
- Proper chart display
- Working pills and plugins
- Forecast predictions
- Accurate time calculations