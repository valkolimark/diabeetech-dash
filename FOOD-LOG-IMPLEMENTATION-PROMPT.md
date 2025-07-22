# Comprehensive Prompt: Enable Food Log in Multi-Tenant Nightscout

## Context and Background

### System Overview
I have a working multi-tenant Nightscout instance on Heroku where:
- Main app works except for "---" glucose display (known issue)
- Clock views work perfectly at `/sclock` (server-side rendered)
- Authentication uses cookies for web pages, JWT for APIs
- Each tenant has isolated data in separate MongoDB databases

### Critical Documentation to Read First
1. **`/docs/MULTITENANT-ARCHITECTURE.md`** - MUST READ! Contains:
   - Complete explanation of multi-tenant architecture
   - Authentication types (web vs API)
   - How we solved the clock problem (server-side rendering)
   - Security implementation details
   - Known issues and workarounds

2. **`/docs/SESSION-2025-01-22-CLOCK-SECURITY.md`** - Today's session summary showing:
   - How we implemented clocks
   - Security fix for authentication
   - Lessons learned about middleware ordering

### Key Learning from Clock Implementation
- Client-side API calls fail due to complex JWT auth in multi-tenant mode
- Server-side rendering bypasses these issues
- Custom middleware chains need explicit auth inclusion
- The `requireWebAuth` middleware properly blocks unauthenticated access

## Current Food Log Status

### Menu Entry Exists
```html
<li class="needsadminaccess foodcontrol">
  <a id="editfoodlink" href="food" target="foodeditor" class="translate">Food Editor</a>
</li>
```

### Expected Issues
1. The `/food` route likely doesn't exist or has authentication issues
2. May rely on client-side API calls (like original clocks did)
3. Needs multi-tenant context and proper authentication

## Task: Enable Food Log Functionality

### Goal
Enable the food database editor so users can:
- Add food items with nutritional information (carbs, protein, fat, calories)
- Search existing food database
- Use food entries for carb counting in treatments
- Each tenant has their own food database

### Investigation Steps

1. **Test Current State**
   ```bash
   # Check if food route exists
   # Try accessing /food when logged in
   # Check browser console for errors
   ```

2. **Find Food-Related Files**
   ```bash
   # Search for food route definitions
   grep -r "food" lib/server/app*.js
   
   # Find food API endpoints
   find lib -name "*food*" -type f
   
   # Check for food views
   find views -name "*food*" -type f
   ```

3. **Check Environment Variables**
   ```bash
   heroku config --app btech | grep -i enable
   # Ensure 'food' is in ENABLE list
   ```

### Implementation Approaches

#### Option 1: Fix Existing Food Editor (if it exists)
- Add proper multi-tenant middleware
- Fix authentication to use `requireWebAuth`
- Ensure it uses tenant-specific database

#### Option 2: Create Server-Side Food Editor (like clock)
Create `/sfood` route with:
- Server-side rendered pages
- Direct database access (no API calls)
- Proper authentication middleware
- CRUD operations for food items

### Food Database Schema
Food items typically include:
```javascript
{
  _id: ObjectId,
  name: String,
  category: String,
  carbs: Number,
  protein: Number,
  fat: Number,
  calories: Number,
  unit: String,
  portion: Number,
  created_at: Date,
  tenant: String  // Important for multi-tenant!
}
```

### Required Features
1. **List View** - Browse/search food database
2. **Add Form** - Create new food items
3. **Edit Form** - Modify existing items
4. **Delete** - Remove items
5. **Search** - Find foods by name/category
6. **Import** - Bulk import common foods (optional)

### Authentication Requirements
- Must use `requireWebAuth` middleware
- Admin access required (`needsadminaccess` class suggests this)
- Tenant isolation must be enforced

### Success Criteria
- [ ] Food Editor accessible from menu when logged in
- [ ] Can create new food items
- [ ] Can search and edit existing items
- [ ] Data persists in tenant-specific database
- [ ] Proper authentication enforced
- [ ] No access to other tenants' food data

## Technical Considerations

### Middleware Chain for Food Routes
Based on clock implementation:
```javascript
app.use("/food", tenantResolver, requireWebAuth, tenantDataloader, foodRoutes());
```

### Database Access
```javascript
// Access tenant's food collection
const foods = await ctx.store.db.collection('food')
  .find({ /* query */ })
  .sort({ name: 1 })
  .toArray();
```

### Security Checklist
- [ ] Authentication required (no public access)
- [ ] Tenant isolation enforced
- [ ] Input validation for nutritional values
- [ ] XSS protection for food names
- [ ] CSRF protection for forms

## Environment Details
- **App**: btech on Heroku
- **URL**: https://btech-d038118b5224.herokuapp.com/
- **Tenant Example**: https://onepanman.diabeetech.net
- **User**: mark@markmireles.com
- **Current Working Features**: Main app, clocks, treatments

## Commands Reference
```bash
# Deploy changes
git add -A
git commit -m "Enable food log for multi-tenant"
git push heroku main

# Check logs
heroku logs --tail --app btech

# Rollback if needed
heroku rollback --app btech

# Check environment
heroku config --app btech
```

## Questions to Answer
1. Does `/food` route exist currently?
2. Is there a `foodindex.html` or similar view file?
3. Are there existing food API endpoints?
4. What errors appear when clicking "Food Editor"?
5. Should we fix existing or build new (like clock)?

## Final Notes
- Keep changes minimal to avoid breaking existing functionality
- Test thoroughly - food data affects treatment calculations
- Consider mobile responsiveness
- Document any new environment variables needed

Remember: The approach that worked for clocks (server-side rendering to bypass API auth issues) will likely work for food editor too!