# Next Session: Enable Food Log Functionality

## Session Context
In the previous session, we successfully implemented:
1. Working clock views at `/sclock` with server-side rendering
2. Customizable clock configuration page
3. Three clock faces (standard, color, simple)
4. Close buttons for easy navigation back to main app

## Important Documentation
**MUST READ FIRST**: `/docs/MULTITENANT-ARCHITECTURE.md` - Contains detailed explanation of:
- How multi-tenant architecture works
- Why we created `/sclock` instead of fixing `/clock`
- Database structure and request flow
- Authentication and security considerations

## Current System Status
- Multi-tenant Nightscout running on Heroku (app: btech)
- Main app URL: https://btech-d038118b5224.herokuapp.com/
- Tenant URL: https://onepanman.diabeetech.net
- Clock views working perfectly at `/sclock`
- Dexcom bridge pulling glucose data every 5 minutes
- Main dashboard shows "---" but clock views work

## Task: Enable Food Log

### Goal
Enable the food database editor to allow tracking of food items and carbohydrates.

### Current Status
- Food Editor link exists in menu: `<a id="editfoodlink" href="food" target="foodeditor" class="translate">Food Editor</a>`
- Link has class `needsadminaccess` which may require authentication
- Food plugin may need to be enabled in settings

### Implementation Plan

1. **Check Current Food Route**
   - Test if `/food` route exists and what error it shows
   - Check if it's a routing issue or authentication issue

2. **Enable Food Plugin**
   - Add 'food' to ENABLE environment variable if not present
   - Verify food collection exists in tenant databases

3. **Fix Food Route in Multi-Tenant Mode**
   - Food editor likely needs multi-tenant middleware
   - May need to create a server-side food editor similar to clock approach
   - Ensure food data is stored in tenant-specific database

4. **Authentication**
   - Food editor requires admin access
   - Need to ensure authentication works in multi-tenant mode
   - May need to implement JWT-based auth for food editor

### Files to Check
- `/lib/server/app-multitenant.js` - Check if food route exists
- `/lib/server/food.js` - Food API endpoints
- `/views/foodindex.html` or similar - Food editor UI
- `/lib/plugins/food.js` - Food plugin implementation

### Potential Approaches

#### Option 1: Fix Existing Food Editor
- Add multi-tenant middleware to existing food routes
- Ensure authentication works properly
- May require significant changes to client-side code

#### Option 2: Create Server-Side Food Editor (like clock)
- Create `/sfood` route with server-side rendering
- Bypass client-side authentication issues
- Full control over implementation

### Environment Variables to Check
```bash
heroku config --app btech | grep ENABLE
# Ensure 'food' is in the ENABLE list
```

### Success Criteria
- Food Editor accessible from menu
- Can add new food items with nutritional info
- Can search and edit existing food items
- Data persists in tenant-specific database
- Only accessible to authenticated admin users

## Additional Context
- User: mark@markmireles.com
- The approach that worked for clock (server-side rendering) might be the best approach for food editor too
- Keep changes minimal to avoid breaking existing functionality

## Commands Reference
```bash
# Deploy changes
git add -A
git commit -m "message"
git push heroku main

# Check logs
heroku logs --tail --app btech

# Rollback if needed
heroku rollback --app btech
```