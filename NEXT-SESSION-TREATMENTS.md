# Comprehensive Prompt: Implement Treatment Entry in Multi-Tenant Nightscout

## Critical: Read These Documents First
1. **`/docs/MULTITENANT-ARCHITECTURE.md`** - Complete system architecture including:
   - Successful server-side implementations (clocks, food, profile)
   - Authentication patterns that work
   - Database structure and tenant isolation

2. **`/docs/SESSION-2025-01-22-PROFILE-EDITOR.md`** - Profile editor success
3. **`/docs/SESSION-2025-01-22-FOOD-EDITOR.md`** - Food editor implementation

## Context: Current Status
### Successfully Implemented ✅
1. **Clock Views** (`/sclock/*`) - Server-side rendered, working perfectly
2. **Food Editor** (`/sfood/*`) - Full CRUD operations, API working
3. **Profile Editor** (`/sprofile/*`) - Complete profile management

### Still Broken ❌
1. **Main Dashboard** - Shows "---" for glucose values
2. **Treatment Entry** - Client-side API calls failing
3. **Reports** - Likely affected by same auth issues

## Current Problem: Treatment Entry

### Expected Issues
- Careportal (treatment entry) uses client-side API calls
- Will fail with 401 errors like other features did
- Need server-side implementation to bypass JWT complexity

### Investigation Steps
```bash
# Find treatment/careportal files
find lib -name "*careportal*" -o -name "*treatment*" | grep -v test
find views -name "*careportal*" -o -name "*treatment*"

# Check current routes
grep -r "careportal" lib/server/app*.js
grep -r "/api.*treatment" lib/server/app*.js

# Test current treatment access
heroku logs --app btech --tail | grep -E "(careportal|treatment)"
```

## Implementation Plan

### Option 1: Fix Treatment Entry (Recommended First)
Create server-side treatment entry following established pattern:

```javascript
// /lib/server/simple-treatments.js
function simpleTreatments() {
  var treatments = express.Router();
  
  // Main treatment entry page
  treatments.get('/', async function(req, res) {
    try {
      // Load recent treatments
      const treatmentCollection = req.ctx.store.db.collection('treatments');
      const recentTreatments = await treatmentCollection
        .find({})
        .sort({ created_at: -1 })
        .limit(20)
        .toArray();
      
      // Load food database for carb entry
      const foodCollection = req.ctx.store.db.collection('food');
      const foods = await foodCollection.find({ type: 'food' }).toArray();
      
      // Load current profile for calculations
      const profileCollection = req.ctx.store.db.collection('profile');
      const profile = await profileCollection.findOne({}, { sort: { startDate: -1 } });
      
      res.render('streatmentindex.html', {
        locals: {
          treatments: recentTreatments,
          foods: foods,
          profile: profile,
          tenant: req.ctx.tenant
        }
      });
    } catch (err) {
      console.error('Error loading treatments:', err);
      res.status(500).json({ error: 'Failed to load treatments' });
    }
  });
  
  // Create treatment endpoint
  treatments.post('/api/create', async function(req, res) {
    try {
      const treatment = req.body;
      
      // Add metadata
      treatment.created_at = new Date().toISOString();
      treatment.tenant = req.ctx.tenant.name;
      
      // Calculate insulin on board if needed
      if (treatment.insulin) {
        // TODO: Calculate IOB based on profile DIA
      }
      
      const treatmentCollection = req.ctx.store.db.collection('treatments');
      const result = await treatmentCollection.insertOne(treatment);
      
      // Emit event for real-time updates
      if (req.ctx.bus) {
        req.ctx.bus.emit('data-received');
      }
      
      res.json({ success: true, _id: result.insertedId });
    } catch (err) {
      console.error('Error saving treatment:', err);
      res.status(500).json({ error: 'Failed to save treatment' });
    }
  });
  
  return treatments;
}
```

### Route Setup
```javascript
// In app-multitenant.js
const simpleTreatments = require('./simple-treatments.js');
app.use("/streatments", bodyParser.json(), tenantResolver, requireWebAuth, tenantDataloader, simpleTreatments());
```

## Treatment Data Structure
```javascript
{
  _id: ObjectId,
  eventType: "Carb Correction" | "Correction Bolus" | "Meal Bolus" | "Combo Bolus" | "Announcement" | "Note" | "Question" | "Exercise" | "Site Change" | "Sensor Start" | "Sensor Change" | "Profile Switch" | "Temp Basal" | "Temp Target",
  created_at: "2025-01-22T12:00:00.000Z",
  carbs: 45,                    // Carbohydrate amount
  insulin: 5.5,                 // Insulin units
  notes: "Lunch - pizza",       // Free text notes
  glucose: 180,                 // BG value if finger stick
  glucoseType: "Finger",        // Finger or Sensor
  units: "mg/dl",              // mg/dl or mmol
  foodType: "Pizza",           // From food database
  duration: 30,                // For temp basal/target
  absolute: 0.5,               // For temp basal rate
  percent: -20,                // For temp basal percentage
  profile: "Default",          // Profile name for switch
  reason: "Exercise",          // For temp targets
  targetTop: 140,              // Temp target high
  targetBottom: 120,           // Temp target low
  tenant: "tenant_name"        // Tenant identifier
}
```

## UI Requirements

### Treatment Entry Form
1. **Quick Buttons**: Common carb amounts (15g, 30g, 45g, 60g)
2. **Food Selection**: Dropdown with search from food database
3. **Insulin Calculator**: 
   - Based on current BG and profile settings
   - Show IOB (insulin on board)
   - Carb ratio from profile
   - Correction factor from profile
4. **Event Types**: All standard Nightscout event types
5. **Time Entry**: Default to now, allow backdating
6. **Recent Treatments**: Show last 20 entries

### Key Features
- Integrate with food database for easy carb entry
- Use profile settings for calculations
- Real-time validation
- Mobile-friendly design
- Quick entry for common scenarios

## Testing Plan
1. Create various treatment types
2. Verify calculations match profile settings
3. Test food integration
4. Ensure tenant isolation
5. Check real-time updates
6. Validate mobile UI

## Success Criteria
- [ ] Treatment entry form loads without errors
- [ ] All event types can be created
- [ ] Food database integration works
- [ ] Profile-based calculations correct
- [ ] Data stored in tenant database
- [ ] Recent treatments display properly
- [ ] No cross-tenant data leakage

## Common Pitfalls to Avoid
1. Don't forget to emit 'data-received' event
2. Validate insulin and carb inputs
3. Handle timezone correctly
4. Ensure profile is loaded for calculations
5. Test with missing profile data

## Environment Details
- **App**: btech on Heroku
- **Working Pattern**: Server-side rendering
- **Auth**: Cookie-based with requireWebAuth
- **Success Examples**: `/sclock`, `/sfood`, `/sprofile`

## Next Steps After Implementation
1. Update menu link to new treatment entry
2. Test bolus wizard calculations
3. Add treatment editing capability
4. Implement treatment deletion
5. Consider batch entry for multiple treatments

## Alternative: Fix Main Dashboard
If treatment entry proves complex, consider fixing the main dashboard first:
- Create server-side rendered glucose display
- Replace client-side API calls with server data
- This would make Nightscout fully functional

Remember: The server-side pattern has worked for every feature so far!