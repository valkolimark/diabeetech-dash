# Profile Editor Architecture Documentation

## Overview
The Profile Editor is a server-side implementation for managing Nightscout profiles in a multi-tenant environment. It provides both a web interface and RESTful API endpoints for complete profile management.

## Architecture Components

### 1. Server Module (`/lib/server/simple-profile.js`)
- Express router handling all profile-related routes
- Direct MongoDB access through tenant context
- Handles both legacy string IDs and MongoDB ObjectIds
- Emits `data-received` events for system updates

### 2. Web Interface (`/views/sprofileindex.html`)
- Server-side rendered HTML with embedded JavaScript
- Collapsible sections for better organization
- Real-time form validation
- Timezone dropdown to prevent invalid entries

### 3. Route Configuration
```javascript
// In app-multitenant.js
app.use("/sprofile", bodyParser.json(), tenantResolver, requireWebAuth, tenantDataloader, simpleProfile());
```

Middleware chain:
1. `bodyParser.json()` - Parses JSON request bodies
2. `tenantResolver` - Extracts tenant from subdomain
3. `requireWebAuth` - Enforces authentication
4. `tenantDataloader` - Loads tenant context and database
5. `simpleProfile()` - Handles profile operations

## API Endpoints

All endpoints are available under `/sprofile/api/` and require authentication.

### 1. Get Current Profile
```
GET /sprofile/api/current
```
Returns the most recent profile for the tenant.

**Response:**
```json
{
  "_id": "profileId",
  "defaultProfile": "Default",
  "startDate": "2025-01-22T00:00:00.000Z",
  "units": "mg/dl",
  "timezone": "US/Central",
  "store": {
    "Default": {
      "dia": 3,
      "carbratio": [{"time": "00:00", "value": 30}],
      "carbs_hr": 20,
      "delay": 20,
      "sens": [{"time": "00:00", "value": 100}],
      "basal": [{"time": "00:00", "value": 0.5}],
      "target_low": [{"time": "00:00", "value": 80}],
      "target_high": [{"time": "00:00", "value": 120}],
      "units": "mg/dl"
    }
  },
  "created_at": "2025-01-22T15:00:00.000Z"
}
```

### 2. List All Profiles
```
GET /sprofile/api/list
```
Returns all profiles for the tenant, sorted by start date (newest first).

**Response:**
```json
[
  {
    "_id": "profileId1",
    "defaultProfile": "Default",
    "startDate": "2025-01-22T00:00:00.000Z",
    "store": { /* profile data */ }
  },
  {
    "_id": "profileId2",
    "defaultProfile": "Exercise Days",
    "startDate": "2025-01-15T00:00:00.000Z",
    "store": { /* profile data */ }
  }
]
```

### 3. Save/Update Profile
```
POST /sprofile/api/save
Content-Type: application/json
```
Creates a new profile or updates an existing one.

**Request Body:**
```json
{
  "_id": "optionalProfileId",  // Include for updates, omit for new
  "defaultProfile": "Default",
  "startDate": "2025-01-22T00:00:00.000Z",
  "units": "mg/dl",
  "timezone": "US/Central",
  "store": {
    "Default": {
      "dia": 3,
      "carbratio": [{"time": "00:00", "value": 30}],
      "carbs_hr": 20,
      "delay": 20,
      "sens": [{"time": "00:00", "value": 100}],
      "basal": [{"time": "00:00", "value": 0.5}],
      "target_low": [{"time": "00:00", "value": 80}],
      "target_high": [{"time": "00:00", "value": 120}],
      "units": "mg/dl"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "_id": "profileId"
}
```

### 4. Delete Profile
```
DELETE /sprofile/api/delete/:id
```
Deletes a specific profile by ID.

**Response:**
```json
{
  "success": true
}
```

## Authentication

### Web Interface
Uses cookie-based authentication (`nightscout_token`). The `requireWebAuth` middleware:
- Checks for valid authentication cookie
- Redirects to login if not authenticated
- Preserves original URL for post-login redirect

### API Access
Currently uses the same cookie-based authentication as the web interface. For external API clients:

```bash
# Example with curl
curl -H "Cookie: nightscout_token=YOUR_TOKEN" \
  https://tenant.yourdomain.com/sprofile/api/current
```

### Future Enhancement: JWT Support
To support mobile apps and external integrations, consider adding JWT token support:
```javascript
// Potential enhancement
profile.use('/api', (req, res, next) => {
  if (req.headers.authorization) {
    // Validate JWT token
    const token = req.headers.authorization.replace('Bearer ', '');
    // ... validate and set req.user
  }
  next();
});
```

## Data Model

### Profile Structure
```javascript
{
  _id: ObjectId | String,        // Legacy profiles may use string IDs
  defaultProfile: String,        // Profile name
  startDate: ISODate,           // When this profile becomes active
  units: "mg/dl" | "mmol",      // Blood glucose units
  timezone: String,             // IANA timezone (e.g., "US/Central")
  store: {
    "Default": {                // Profile set name (usually "Default")
      dia: Number,              // Duration of insulin action (hours)
      carbratio: [{             // Carb ratios by time of day
        time: String,           // "HH:MM" format
        value: Number           // Grams per unit of insulin
      }],
      carbs_hr: Number,         // Carb absorption rate (g/hour)
      delay: Number,            // Carb absorption delay (minutes)
      sens: [{                  // Insulin sensitivity factors
        time: String,           // "HH:MM" format
        value: Number           // mg/dL or mmol/L per unit
      }],
      basal: [{                 // Basal rates
        time: String,           // "HH:MM" format
        value: Number           // Units per hour
      }],
      target_low: [{            // Target BG range low values
        time: String,           // "HH:MM" format
        value: Number           // mg/dL or mmol/L
      }],
      target_high: [{           // Target BG range high values
        time: String,           // "HH:MM" format
        value: Number           // mg/dL or mmol/L
      }],
      units: String             // Redundant units field
    }
  },
  created_at: ISODate          // Profile creation timestamp
}
```

### Time-Based Settings
All time-based settings (carb ratios, ISF, basal rates, targets) follow the pattern:
- Array of objects with `time` and `value` properties
- Times in "HH:MM" format (24-hour)
- Sorted by time for proper application
- System uses the most recent time entry that hasn't passed yet

## Security Considerations

### Tenant Isolation
- All operations are scoped to the current tenant
- Database access through `req.ctx.store.db` ensures tenant context
- No cross-tenant data access possible

### Input Validation
- Numeric values validated on client-side
- Server should add additional validation:
  - DIA: 1-10 hours
  - Carb ratios: positive numbers
  - Basal rates: 0-35 units/hour
  - Time formats: valid HH:MM

### ID Handling
The system handles both legacy string IDs and MongoDB ObjectIds:
```javascript
if (ObjectId.isValid(id) && id.length === 24) {
  query = { _id: new ObjectId(id) };
} else {
  query = { _id: id };  // Legacy string ID
}
```

## Integration Points

### 1. Treatment Calculations
Profile data is used for:
- Bolus wizard calculations
- IOB (Insulin on Board) calculations
- COB (Carbs on Board) calculations
- Predictive glucose algorithms

### 2. Reports
Profile settings affect:
- Basal vs bolus insulin ratios
- Time in range calculations
- Average daily insulin calculations

### 3. Real-time Updates
The `data-received` event emission ensures:
- WebSocket clients get updated profile data
- Cached calculations are invalidated
- UI updates reflect new settings

## API Usage Examples

### Get Current Profile (External Client)
```bash
# Using curl
curl -X GET \
  -H "Cookie: nightscout_token=YOUR_TOKEN" \
  https://tenant.yourdomain.com/sprofile/api/current

# Using fetch in JavaScript
const response = await fetch('https://tenant.yourdomain.com/sprofile/api/current', {
  credentials: 'include',
  headers: {
    'Accept': 'application/json'
  }
});
const profile = await response.json();
```

### Create New Profile
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: nightscout_token=YOUR_TOKEN" \
  -d '{
    "defaultProfile": "Weekend",
    "startDate": "2025-01-25T00:00:00.000Z",
    "units": "mg/dl",
    "timezone": "US/Central",
    "store": {
      "Default": {
        "dia": 4,
        "carbratio": [
          {"time": "00:00", "value": 25},
          {"time": "12:00", "value": 30}
        ],
        "carbs_hr": 20,
        "delay": 20,
        "sens": [
          {"time": "00:00", "value": 80},
          {"time": "14:00", "value": 100}
        ],
        "basal": [
          {"time": "00:00", "value": 0.6},
          {"time": "06:00", "value": 0.8},
          {"time": "20:00", "value": 0.5}
        ],
        "target_low": [{"time": "00:00", "value": 90}],
        "target_high": [{"time": "00:00", "value": 140}],
        "units": "mg/dl"
      }
    }
  }' \
  https://tenant.yourdomain.com/sprofile/api/save
```

### Update Existing Profile
```javascript
// In a Node.js application
const axios = require('axios');

async function updateProfile(profileId, updates) {
  const response = await axios.post(
    'https://tenant.yourdomain.com/sprofile/api/save',
    {
      _id: profileId,
      ...updates
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `nightscout_token=${authToken}`
      }
    }
  );
  return response.data;
}
```

### Delete Profile
```bash
curl -X DELETE \
  -H "Cookie: nightscout_token=YOUR_TOKEN" \
  https://tenant.yourdomain.com/sprofile/api/delete/PROFILE_ID
```

## Testing Considerations

### Unit Tests
- Test ID format detection (ObjectId vs string)
- Validate time-based array sorting
- Test timezone handling
- Verify data structure integrity

### Integration Tests
- Multi-tenant isolation
- Authentication enforcement
- Event emission verification
- Database operation success

### API Tests
```bash
# Test profile creation
curl -X POST ... # Create profile
curl -X GET ... # Verify creation
curl -X DELETE ... # Clean up

# Test error handling
curl -X POST ... # Invalid data
curl -X DELETE ... # Non-existent ID
```

## Performance Considerations

### Caching
Consider caching the current profile:
- Profiles change infrequently
- Many calculations need profile data
- Cache invalidation on `data-received` event

### Indexes
Ensure MongoDB indexes on:
- `startDate` for sorting
- `_id` for lookups
- Compound index on tenant + startDate

## Future Enhancements

### 1. Profile Templates
- Pre-defined profiles for common scenarios
- "Exercise", "Sick Day", "High Carb" templates
- Copy existing profile as template

### 2. Profile Scheduling
- Automatic profile switching by schedule
- Day of week patterns
- Temporary profile overrides

### 3. Import/Export
- JSON export for backup
- CSV import from pump software
- Profile sharing between users

### 4. Validation Rules
- Clinical safety limits
- Sanity checks on values
- Warnings for unusual settings

### 5. API Improvements
- GraphQL endpoint for flexible queries
- Webhook notifications on profile changes
- Batch operations support

## Troubleshooting

### Common Issues

1. **Save fails with ObjectId error**
   - Check if profile has legacy string ID
   - Ensure ID handling code is in place

2. **Profile not loading**
   - Verify tenant context is available
   - Check database connection
   - Ensure profile collection exists

3. **API returns 401**
   - Verify authentication cookie/token
   - Check middleware order
   - Ensure tenant resolution worked

### Debug Queries
```javascript
// In MongoDB shell
use tenant_DATABASE_NAME;
db.profile.find().pretty();
db.profile.find({_id: "defaultProfile"});
db.profile.find().sort({startDate: -1}).limit(1);
```

## Conclusion
The Profile Editor provides a complete solution for profile management in multi-tenant Nightscout:
- Full CRUD operations via web and API
- Tenant isolation and security
- Legacy data compatibility
- Real-time system integration

The API endpoints make it suitable for integration with mobile apps, automation tools, and third-party services while maintaining the security and isolation required in a multi-tenant environment.