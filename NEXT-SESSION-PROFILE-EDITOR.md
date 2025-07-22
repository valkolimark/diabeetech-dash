# Comprehensive Prompt: Fix Profile Editor in Multi-Tenant Nightscout

## Critical: Read These Documents First
1. **`/docs/MULTITENANT-ARCHITECTURE.md`** - Complete system architecture including:
   - How multi-tenant authentication works (web vs API)
   - Success pattern: Server-side rendering (clocks and food)
   - Middleware chains and auth requirements
   - Database structure and tenant isolation

2. **`/docs/SESSION-2025-01-22-FOOD-EDITOR.md`** - Recent success implementing food editor:
   - How we bypassed client-side API auth issues
   - Body parser middleware configuration
   - Full CRUD implementation pattern

## Context: What We've Accomplished
### Successfully Implemented ✅
1. **Clock Views** (`/sclock/*`)
   - Server-side rendered to bypass API auth
   - Direct database access via request context
   - Full configuration management

2. **Food Editor** (`/sfood/*`)
   - Complete CRUD operations
   - Working API endpoints
   - Body parsing fixed with `bodyParser.json()`
   - Tenant isolation verified

### Key Pattern That Works
```javascript
// Server-side route with proper middleware chain
app.use("/route", 
  tenantResolver,      // Extract tenant from subdomain
  requireWebAuth,      // Check cookie authentication
  tenantDataloader,    // Load tenant context & database
  routeHandler()       // Handle requests with full context
);
```

## Current Problem: Profile Editor

### Symptoms
1. Profile editor not loading profile data
2. Save operations failing
3. Likely similar to original clock/food issues

### Expected Issues
- Client-side API calls failing due to JWT auth complexity
- Profile stored in tenant database but not accessible
- May need server-side rendering approach

## Investigation Steps

### 1. Check Current Profile Route
```bash
# Find profile-related files
find lib -name "*profile*" -type f
grep -r "profile" lib/server/app*.js
find views -name "*profile*" -type f

# Check if profile is in enabled plugins
heroku config --app btech | grep ENABLE
```

### 2. Test Profile Access
```bash
# Check if profile route exists
curl -I https://tenant.domain.com/profile

# Look for errors in logs
heroku logs --app btech --tail | grep -E "(profile|Profile)"
```

### 3. Examine Profile Implementation
- How does current profile editor work?
- Does it use client-side API calls?
- What endpoints does it need?

## Implementation Approaches

### Option 1: Fix Existing Profile Editor
If profile editor exists but uses client-side API:
- Add proper authentication handling
- Fix API endpoints to work with multi-tenant
- Ensure tenant context is available

### Option 2: Create Server-Side Profile Editor (Recommended)
Following the successful pattern from clocks and food:

```javascript
// /lib/server/simple-profile.js
function simpleProfile() {
  var profile = express.Router();
  
  // Main profile page - server rendered
  profile.get('/', async function(req, res) {
    try {
      // Load profile from tenant's database
      const profileCollection = req.ctx.store.db.collection('profile');
      const profile = await profileCollection.findOne({});
      
      res.render('sprofileindex.html', {
        locals: {
          profile: profile || {},
          tenant: req.ctx.tenant
        }
      });
    } catch (err) {
      console.error('Error loading profile:', err);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });
  
  // Save profile endpoint
  profile.post('/api/save', async function(req, res) {
    try {
      const profileData = req.body;
      const profileCollection = req.ctx.store.db.collection('profile');
      
      // Update or insert profile
      await profileCollection.replaceOne(
        {}, 
        profileData, 
        { upsert: true }
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error saving profile:', err);
      res.status(500).json({ error: 'Failed to save profile' });
    }
  });
  
  return profile;
}
```

### Route Setup
```javascript
// In app-multitenant.js
const simpleProfile = require('./simple-profile.js');
app.use("/sprofile", bodyParser.json(), tenantResolver, requireWebAuth, tenantDataloader, simpleProfile());
```

## Profile Data Structure
Typical Nightscout profile includes:
```javascript
{
  _id: ObjectId,
  defaultProfile: "Default",
  store: {
    "Default": {
      dia: 3,                    // Duration of insulin action (hours)
      carbratio: [{              // Carb ratios by time
        time: "00:00",
        value: 30
      }],
      carbs_hr: 20,              // Carb absorption rate
      delay: 20,                 // Carb absorption delay
      sens: [{                   // Insulin sensitivity
        time: "00:00",
        value: 100
      }],
      basal: [{                  // Basal rates
        time: "00:00",
        value: 0.1
      }],
      target_low: [{             // Target BG low
        time: "00:00",
        value: 100
      }],
      target_high: [{            // Target BG high
        time: "00:00",
        value: 120
      }],
      units: "mg/dl"
    }
  },
  startDate: "2015-06-21T00:00:00.000Z",
  timezone: "US/Central",
  created_at: Date
}
```

## Key Considerations

### Authentication
- Must use `requireWebAuth` middleware
- Profile requires admin access (check user permissions)
- Ensure tenant isolation

### Data Validation
- Validate time formats (HH:MM)
- Ensure numeric values are valid
- Check required fields (dia, carb ratios, etc.)

### UI Requirements
- Time-based entries (basal rates, carb ratios, etc.)
- Multiple profiles support
- Import/export functionality (optional)

## Testing Plan
1. Access profile editor when logged in
2. Load existing profile data
3. Modify values and save
4. Verify data persists in correct tenant database
5. Test with multiple tenants for isolation

## Success Criteria
- [ ] Profile editor loads without errors
- [ ] Existing profile data displays correctly
- [ ] Save operations work properly
- [ ] Data stored in tenant-specific database
- [ ] No cross-tenant data leakage
- [ ] Authentication properly enforced

## Debugging Commands
```bash
# Monitor logs during profile access
heroku logs --app btech --tail | grep -i profile

# Check profile collection in MongoDB
heroku run mongo --app btech
> use tenant_nightscout
> db.profile.find().pretty()

# Test profile API endpoints
curl -X GET -H "Cookie: nightscout_token=XXX" \
  https://tenant.domain.com/sprofile/api/load

curl -X POST -H "Content-Type: application/json" \
  -H "Cookie: nightscout_token=XXX" \
  -d '{"defaultProfile":"Default","store":{...}}' \
  https://tenant.domain.com/sprofile/api/save
```

## Common Pitfalls to Avoid
1. Don't rely on client-side API calls
2. Ensure body parser is in middleware chain
3. Use `locals` object for template variables
4. Check for existing profile before update
5. Validate all numeric inputs

## Environment Details
- **App**: btech on Heroku  
- **Working Examples**: `/sclock` (clocks), `/sfood` (food editor)
- **Pattern**: Server-side rendering with direct DB access
- **Auth**: Cookie-based for web pages

## Next Steps After Implementation
1. Update main menu link to new profile editor
2. Test thoroughly with real profile data
3. Document in architecture file
4. Consider adding import/export features

Remember: The pattern that worked for clocks and food will work for profile editor too!