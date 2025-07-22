# Multi-Tenant Nightscout Architecture Documentation

## Overview
This document describes how the multi-tenant Nightscout implementation works, with a focus on the clock functionality and other key features.

## Multi-Tenant Architecture

### Database Structure
- **Master Database**: Contains tenant and user information
  - `tenants` collection: Stores tenant configurations
  - `users` collection: Stores user accounts with tenant associations
- **Tenant Databases**: Each tenant has a separate database containing:
  - `entries`: Glucose readings from CGM devices
  - `treatments`: Insulin, carbs, and other treatments
  - `devicestatus`: Device status updates
  - `settings`: Tenant-specific Nightscout settings
  - `clockconfig`: Clock customization preferences (custom addition)
  - `food`: Food database entries

### Request Flow
1. Request arrives at the application
2. `tenantResolver` middleware extracts tenant from subdomain or query parameter
3. `tenantDataloader` middleware:
   - Loads tenant configuration from master database
   - Connects to tenant-specific database
   - Loads tenant data and settings
   - Creates sandbox environment with plugins
4. Request is processed with tenant context

## Clock Implementation

### Why a Separate Clock Module?
The original Nightscout clock views (`/clock/*`) relied on client-side JavaScript making API calls to fetch glucose data. In multi-tenant mode, these API calls required complex JWT authentication that wasn't properly configured, resulting in 401 Unauthorized errors.

### Solution: Server-Side Clock (`/sclock`)
Located in `/lib/server/simple-clock.js`, this module:
- Renders glucose data server-side (bypasses client-side API authentication)
- Directly accesses the tenant's database through the request context
- Supports multiple clock faces (bgclock, color, simple)
- Auto-refreshes via meta refresh tag

### Clock Features
1. **Three Clock Faces**:
   - **BGClock** (`/sclock`): Default clock with glucose value, direction, delta, and time
   - **Color Clock** (`/sclock/color`): Background changes color based on glucose ranges
   - **Simple Clock** (`/sclock/simple`): Minimal display with just glucose and direction

2. **Configuration** (`/sclock/config`):
   - Customizable color thresholds for glucose ranges
   - Adjustable font sizes for each clock face
   - Configurable refresh interval (10-300 seconds)
   - Toggle delta and minutes ago display
   - Settings saved in `clockconfig` collection per tenant

3. **Navigation**:
   - All clock pages have a close button (×) to return to main app
   - Clock menu in sidebar provides quick access to all views

### Implementation Details
```javascript
// Route setup in app-multitenant.js
const simpleClock = require('./simple-clock.js');
app.use("/sclock", tenantResolver, tenantDataloader, simpleClock());

// Clock module structure
- GET /:face? - Display clock faces (requires web authentication)
- GET /config - Show configuration page (requires web authentication)
- POST /config - Save configuration (requires web authentication)
```

### Security
**IMPORTANT**: Clock routes are protected by the `requireWebAuth` middleware:
- Checks for valid `nightscout_token` cookie
- Redirects to login page if not authenticated
- Preserves original URL for redirect after login
- Blocks all unauthenticated access (no client-side fallback)

The clock routes have their own middleware chain and must explicitly include authentication. The general auth middleware at lines 232-263 doesn't apply to routes with custom middleware chains.

## Authentication & Security

### Multi-Tenant Authentication Types

#### Web Page Authentication (including clocks)
- Uses cookie-based authentication (`nightscout_token`)
- Checked by middleware at lines 232-263 in app-multitenant.js
- Allows server-side rendering without API tokens
- Same auth as main dashboard - if you can see the dashboard, you can see the clocks

#### API Authentication
- Uses JWT tokens in Authorization header
- Required for all `/api/*` routes
- Handled by `auth.authenticate` middleware
- Used by devices, mobile apps, and external integrations

### Security Principles
- Each tenant has isolated data
- API_SECRET is optional in multi-tenant mode
- Tenant context ensures data isolation
- Web pages and API endpoints use different auth mechanisms

### Clock Security
- Clock views inherit tenant context from middleware
- No client-side API calls = no authentication issues
- Direct database access only within server context
- Protected by `requireWebAuth` middleware that enforces authentication

### How Clock Authentication Works

#### The Problem We Discovered
1. Express middleware runs in order
2. Routes with custom middleware chains (like `app.use("/sclock", tenantResolver, ...)`) create their own middleware stack
3. These custom stacks bypass earlier middleware unless explicitly included
4. The general auth middleware (lines 232-263) just calls `next()` for unauthenticated users
5. This allowed unauthenticated access to clock routes!

#### The Solution
```javascript
// Custom middleware that actually blocks access
const requireWebAuth = (req, res, next) => {
  if (req.cookies && req.cookies.nightscout_token) {
    const token = req.cookies.nightscout_token;
    try {
      const decoded = auth.verifyToken(token);
      req.user = decoded;
      next();
    } catch (err) {
      // Invalid token, redirect to login
      res.clearCookie('nightscout_token');
      return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
  } else {
    // No auth, redirect to login
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
};

// Applied to clock routes
app.use("/sclock", tenantResolver, requireWebAuth, tenantDataloader, simpleClock());
```

#### Key Points
- Must explicitly include auth middleware in custom route chains
- Use redirects for web pages, not just error responses
- Preserve original URL for post-login redirect
- Clear invalid cookies to prevent auth loops

## Food Editor Implementation

### Why a Separate Food Module?
Similar to the clock solution, the original food editor (`/food`) relied on client-side JavaScript making API calls. In multi-tenant mode, these fail due to JWT authentication complexity. The solution was to create a server-side food editor.

### Solution: Server-Side Food Editor (`/sfood`)
Located in `/lib/server/simple-food.js`, this module:
- Renders the food editor interface server-side
- Provides direct database access for CRUD operations
- Maintains full API compatibility for external clients
- Ensures proper tenant isolation for food data

### Food Editor Features
1. **Food Management**:
   - Add, edit, and delete food items
   - Search by name, category, or subcategory
   - Nutritional data: carbs, protein, fat, energy, GI
   - Portion sizes and units (g, ml, pcs, oz)

2. **Quick Picks**:
   - Create food combinations for frequent meals
   - Calculate total carbohydrates automatically
   - Hide/show functionality
   - Position-based sorting

3. **API Endpoints** (all under `/sfood/api/`):
   - `GET /list` - Get all food items
   - `GET /item/:id` - Get specific food item
   - `POST /create` - Create new food item
   - `PUT /update/:id` - Update existing food
   - `DELETE /delete/:id` - Delete food item
   - `GET /search` - Search foods with filters
   - `GET /categories` - Get all categories/subcategories
   - `GET /quickpicks` - Get all quick picks
   - `POST /quickpick/create` - Create quick pick
   - `PUT /quickpick/update/:id` - Update quick pick

### Implementation Details
```javascript
// Route setup in app-multitenant.js
const simpleFood = require('./simple-food.js');
app.use("/sfood", tenantResolver, requireWebAuth, tenantDataloader, simpleFood());

// Food data structure
{
  _id: ObjectId,
  type: 'food' | 'quickpick',
  name: String,
  category: String,
  subcategory: String,
  carbs: Number,
  protein: Number,
  fat: Number,
  energy: Number,
  gi: Number (1-3),
  unit: String,
  portion: Number,
  created_at: Date
}
```

### Security
- Protected by `requireWebAuth` middleware (same as clocks)
- All data operations are tenant-isolated
- No client-side API authentication required
- Input validation for all nutritional values

### API Access
The food API is fully accessible for external clients. All endpoints require authentication via cookie (web) or can be adapted for JWT tokens.

#### Example API Usage
```bash
# List all foods (requires authentication cookie)
curl -H "Cookie: nightscout_token=YOUR_TOKEN" \
  https://tenant.domain.com/sfood/api/list

# Create a new food item
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: nightscout_token=YOUR_TOKEN" \
  -d '{"name":"Apple","carbs":14,"unit":"g","portion":100}' \
  https://tenant.domain.com/sfood/api/create

# Update a food item
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Cookie: nightscout_token=YOUR_TOKEN" \
  -d '{"name":"Apple - Large","carbs":25}' \
  https://tenant.domain.com/sfood/api/update/FOOD_ID

# Search foods by name
curl -H "Cookie: nightscout_token=YOUR_TOKEN" \
  https://tenant.domain.com/sfood/api/search?name=apple
```

### Implementation Success (January 2025)
- ✅ Server-side rendering bypasses client API auth issues
- ✅ Full CRUD operations working via UI and API
- ✅ Body parsing fixed with `bodyParser.json()` in middleware chain
- ✅ Tenant isolation verified
- ✅ Food data persists in tenant-specific MongoDB collections

## Profile Editor Implementation

### Why a Separate Profile Module?
Like clocks and food, the original profile editor (`/profile`) relied on client-side JavaScript making API calls. In multi-tenant mode, these fail due to JWT authentication complexity. The solution was to create a server-side profile editor.

### Solution: Server-Side Profile Editor (`/sprofile`)
Located in `/lib/server/simple-profile.js`, this module:
- Renders the profile editor interface server-side
- Provides direct database access for profile management
- Supports multiple profiles per tenant with switching
- Ensures proper tenant isolation for profile data

### Profile Editor Features
1. **Profile Management**:
   - Create, edit, and delete profiles
   - Switch between multiple profiles
   - Profile naming and start date configuration
   - Units selection (mg/dL or mmol/L)

2. **Time-Based Settings**:
   - Carb ratios (I:C) - grams per unit of insulin
   - Insulin sensitivity factors (ISF) - BG drop per unit
   - Basal rates - units per hour
   - Target glucose ranges (low and high)
   - Multiple time entries for each setting

3. **Insulin & Carb Settings**:
   - Duration of insulin action (DIA)
   - Carb absorption rate (g/hour)
   - Carb absorption delay (minutes)
   - Timezone configuration

4. **API Endpoints** (all under `/sprofile/api/`):
   - `GET /current` - Get most recent profile
   - `GET /list` - List all profiles
   - `POST /save` - Create or update profile
   - `DELETE /delete/:id` - Delete specific profile

### Implementation Details
```javascript
// Route setup in app-multitenant.js
const simpleProfile = require('./simple-profile.js');
app.use("/sprofile", bodyParser.json(), tenantResolver, requireWebAuth, tenantDataloader, simpleProfile());

// Profile data structure
{
  _id: ObjectId,
  defaultProfile: "Default",
  startDate: "2025-01-22T00:00:00.000Z",
  units: "mg/dl",
  timezone: "US/Central",
  store: {
    Default: {
      dia: 3,
      carbratio: [{ time: "00:00", value: 30 }],
      carbs_hr: 20,
      delay: 20,
      sens: [{ time: "00:00", value: 100 }],
      basal: [{ time: "00:00", value: 0.5 }],
      target_low: [{ time: "00:00", value: 80 }],
      target_high: [{ time: "00:00", value: 120 }],
      units: "mg/dl"
    }
  },
  created_at: Date
}
```

### Security
- Protected by `requireWebAuth` middleware (same as clocks and food)
- All data operations are tenant-isolated
- No client-side API authentication required
- Input validation for all numeric values and time entries

### Implementation Success (January 2025)
- ✅ Server-side rendering bypasses client API auth issues
- ✅ Full profile CRUD operations working
- ✅ Time-based settings with dynamic UI
- ✅ Profile switching functionality
- ✅ Tenant isolation verified
- ✅ Profile data persists in tenant-specific MongoDB collections

## Key Files

### Core Multi-Tenant Files
- `/lib/server/app-multitenant.js` - Main application setup
- `/lib/server/bootevent-multitenant.js` - Multi-tenant boot process
- `/lib/middleware/tenantResolver.js` - Extracts tenant from request
- `/lib/middleware/tenantDataloader.js` - Loads tenant data and creates context

### Clock-Specific Files
- `/lib/server/simple-clock.js` - Server-side clock implementation
- `/views/index.html` - Main app with clock menu links

### Food-Specific Files
- `/lib/server/simple-food.js` - Server-side food editor implementation
- `/views/sfoodindex.html` - Food editor interface

### Profile-Specific Files
- `/lib/server/simple-profile.js` - Server-side profile editor implementation
- `/views/sprofileindex.html` - Profile editor interface

## Environment Variables
```bash
MULTI_TENANT_ENABLED=true
MASTER_MONGODB_URI=<master-database-uri>
BASE_DOMAIN=<your-domain.com>
JWT_SECRET=<secure-secret>
```

## Known Issues & Workarounds

### Main Dashboard Shows "---"
- The main dashboard still shows "---" for glucose values
- This is due to complex client-side API authentication requirements
- **Workaround**: Use `/sclock` for live glucose display

### Original Clock Views Broken
- `/clock/*` routes show authentication errors
- These rely on client-side API calls that don't work in multi-tenant mode
- **Solution**: Use `/sclock/*` routes instead

### Authentication Middleware Order
- Routes with custom middleware chains bypass the general auth middleware
- Must explicitly include `requireWebAuth` middleware for protected routes
- The general auth middleware only applies to routes using the default Express routing

## Future Improvements
- Fix main dashboard glucose display
- ~~Implement food log functionality~~ ✓ Completed
- ~~Implement profile editor~~ ✓ Completed
- Add more clock customization options
- Improve mobile responsiveness
- Add bulk import for common foods
- Enhance quick pick management UI
- Add profile import/export functionality
- Integrate profile with treatment calculations

## Testing
- Clock views tested with live Dexcom data
- Configuration persistence verified
- Multi-tenant isolation confirmed
- Auto-refresh functionality working
- Food editor CRUD operations verified
- Food API endpoints tested
- Tenant isolation for food data confirmed
- Profile editor CRUD operations verified
- Profile switching functionality tested
- Time-based settings UI working
- Tenant isolation for profile data confirmed

## Admin Tools Restriction Implementation (January 2025)

### Problem
Admin tools were accessible to all tenants, creating security and management concerns in multi-tenant deployments.

### Solution: Tenant-Level Admin Restriction
Implemented server-side control over admin tools access based on tenant configuration.

### Implementation Details
1. **Database Schema Update**:
   - Added `isAdmin` boolean field to tenant model
   - Default value is `false` for security

2. **Server-Side Protection**:
   - `/admin` route checks `req.tenant.isAdmin` before rendering
   - Returns 403 error for non-admin tenants
   - Authorization API endpoints protected in multi-tenant mode
   - Admin notifications API requires tenant admin status

3. **UI Changes**:
   - Admin tools link conditionally rendered based on `tenant.isAdmin`
   - Changed CSS class from `needsadminaccess` to `tenant-admin-only`
   - Prevents client-side JavaScript from overriding server control

4. **Middleware Updates**:
   - Added `tenantResolver` to all app page routes
   - Ensures tenant context available for rendering decisions
   - Created `requireTenantAdmin` middleware for API protection

### Files Modified
- `/lib/models/tenant.js` - Added isAdmin field
- `/lib/server/app-multitenant.js` - Route protection and middleware
- `/views/index.html` - Conditional rendering
- `/lib/api2/index.js` - Authorization API protection
- `/lib/api/adminnotifiesapi.js` - Admin notifications protection

### MongoDB Commands
```javascript
// Enable admin for a tenant
db.tenants.updateOne(
  { subdomain: "tenant-name" },
  { $set: { isAdmin: true } }
)

// Check tenant admin status
db.tenants.findOne({ subdomain: "tenant-name" }, { isAdmin: 1 })
```

### Security Benefits
- Admin tools only available to explicitly authorized tenants
- Server-side enforcement prevents bypass attempts
- Maintains backward compatibility (undefined = false)
- No performance impact on non-admin tenants

Last Updated: January 2025