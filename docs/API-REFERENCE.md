# Nightscout Multi-Tenant API Reference

## Overview

The Nightscout Multi-Tenant API provides comprehensive access to diabetes management data including continuous glucose monitoring (CGM) readings, treatments, device status, and user profiles. This API supports both modern JWT-based authentication for multi-tenant deployments and legacy API_SECRET authentication for backwards compatibility.

### Base URL

Multi-tenant deployments:
```
https://{subdomain}.nightscout.com/api
```

Single-tenant deployments:
```
https://your-nightscout-instance.com/api
```

### API Versions

- **v1**: Original API with core functionality
- **v2**: Enhanced API with additional features and authorization endpoints
- **v3**: Modern REST API with standardized CRUD operations and WebSocket support

### Response Format

All API responses follow a consistent JSON format:

```json
{
  "status": 200,
  "result": "success",
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:
```json
{
  "status": 400,
  "result": "error", 
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

## Authentication

Nightscout supports multiple authentication methods to accommodate different use cases and maintain backwards compatibility.

### JWT Authentication (Recommended)

Modern token-based authentication for multi-tenant deployments.

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "role": "admin",
    "tenantId": "tenant-id"
  }
}
```

#### Using the Token

Include the access token in the Authorization header for all authenticated requests:

```http
GET /api/v1/entries
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Refresh Token

When the access token expires, use the refresh token to obtain a new one:

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### API_SECRET Authentication (Legacy)

For backwards compatibility with existing integrations.

#### Using API_SECRET

Include the API secret in the request header or query parameter:

```http
# Header method
GET /api/v1/entries
api-secret: your-hashed-api-secret

# Query parameter method  
GET /api/v1/entries?secret=your-hashed-api-secret
```

The API secret must be hashed using SHA-1. Example in JavaScript:
```javascript
const crypto = require('crypto');
const hashedSecret = crypto.createHash('sha1').update(apiSecret).digest('hex');
```

### Permissions and Roles

#### User Roles

- **admin** - Full access to tenant data and settings
- **caregiver** - Can view data and add treatments
- **viewer** - Read-only access to data

#### Default Permission Roles

- **denied** - No permissions
- **readable** - Read access to all data
- **careportal** - Can create treatments
- **devicestatus-upload** - Can upload device status
- **activity** - Can create activity entries

#### Permission Format

Permissions follow the Apache Shiro format: `resource:action:instance`

Examples:
- `api:entries:read` - Read glucose entries
- `api:treatments:create` - Create treatments
- `api:*:*` - Full API access
- `admin:*:*` - Full admin access

## Core APIs

### Glucose Entries (CGM Data)

The entries API manages continuous glucose monitor (CGM) data.

#### List Entries

```http
GET /api/v1/entries
```

Query Parameters:
- `count` (number) - Number of entries to return (default: 10)
- `find` (object) - MongoDB query filter
- `find[dateString][$gte]` - Start date filter (YYYY-MM-DD)
- `find[dateString][$lte]` - End date filter (YYYY-MM-DD)
- `find[type]` - Entry type filter (e.g., "sgv", "mbg")

Example Request:
```http
GET /api/v1/entries?count=288&find[dateString][$gte]=2024-01-20
Authorization: Bearer {token}
```

Example Response:
```json
[
  {
    "_id": "65abc123def456789",
    "type": "sgv",
    "sgv": 120,
    "direction": "Flat",
    "device": "share2",
    "dateString": "2024-01-20T10:30:00.000Z",
    "date": 1705746600000,
    "mills": 1705746600000,
    "rssi": 178,
    "noise": 1
  }
]
```

#### Create Entry

```http
POST /api/v1/entries
Content-Type: application/json
Authorization: Bearer {token}

{
  "type": "sgv",
  "sgv": 150,
  "direction": "FortyFiveUp",
  "device": "xDrip",
  "dateString": "2024-01-20T10:35:00.000Z"
}
```

#### Entry Data Fields

- `type` (string) - Entry type: "sgv" (sensor glucose value), "mbg" (meter blood glucose), "cal" (calibration)
- `sgv` (number) - Sensor glucose value in mg/dL
- `mbg` (number) - Meter blood glucose in mg/dL
- `direction` (string) - Trend direction: "NONE", "DoubleUp", "SingleUp", "FortyFiveUp", "Flat", "FortyFiveDown", "SingleDown", "DoubleDown"
- `device` (string) - Source device identifier
- `dateString` (string) - ISO 8601 timestamp
- `date` (number) - Unix timestamp in milliseconds
- `noise` (number) - CGM noise level (1=Clean, 2=Light, 3=Medium, 4=Heavy)
- `rssi` (number) - Signal strength

### Treatments

The treatments API manages diabetes treatments including insulin doses, carbohydrates, and other events.

#### List Treatments

```http
GET /api/v1/treatments
```

Query Parameters:
- `count` (number) - Number of treatments to return
- `find[eventType]` - Filter by event type
- `find[created_at][$gte]` - Start date filter
- `find[created_at][$lte]` - End date filter

Example Request:
```http
GET /api/v1/treatments?find[eventType]=Meal Bolus&count=50
Authorization: Bearer {token}
```

#### Create Treatment

```http
POST /api/v1/treatments
Content-Type: application/json
Authorization: Bearer {token}

{
  "eventType": "Meal Bolus",
  "carbs": 45,
  "insulin": 6.5,
  "created_at": "2024-01-20T12:00:00.000Z",
  "notes": "Lunch - pizza"
}
```

#### Treatment Event Types

- **Bolus Types**
  - `Meal Bolus` - Insulin for food
  - `Correction Bolus` - Insulin for high BG
  - `Combo Bolus` - Extended bolus

- **Basal Changes**
  - `Temp Basal` - Temporary basal rate
  - `Basal Profile Change` - Profile switch

- **Carbohydrates**
  - `Carbs` - Carbohydrate entry
  - `Carb Correction` - Additional carbs

- **Other Events**
  - `Exercise` - Physical activity
  - `Site Change` - Pump site change
  - `Sensor Change` - CGM sensor change
  - `Note` - General note
  - `Announcement` - Important message

#### Treatment Data Fields

- `eventType` (string, required) - Type of treatment event
- `insulin` (number) - Insulin amount in units
- `carbs` (number) - Carbohydrate amount in grams
- `glucose` (number) - Blood glucose value
- `glucoseType` (string) - "Sensor" or "Finger"
- `units` (string) - "mg/dl" or "mmol/l"
- `duration` (number) - Duration in minutes (for temp basal)
- `percent` (number) - Percentage for temp basal (-100 to 100)
- `absolute` (number) - Absolute temp basal rate
- `notes` (string) - Additional notes
- `enteredBy` (string) - User who entered treatment
- `created_at` (string) - ISO 8601 timestamp

### Profiles

Diabetes management profiles containing basal rates, carb ratios, and sensitivity factors.

#### Get Current Profile

```http
GET /api/v1/profile/current
Authorization: Bearer {token}
```

Response:
```json
{
  "_id": "65abc123def456789",
  "defaultProfile": "Default",
  "mills": 1705746600000,
  "created_at": "2024-01-20T10:30:00.000Z",
  "store": {
    "Default": {
      "dia": 4,
      "carbratio": [
        {
          "time": "00:00",
          "value": 10,
          "timeAsSeconds": 0
        },
        {
          "time": "06:00", 
          "value": 8,
          "timeAsSeconds": 21600
        }
      ],
      "sens": [
        {
          "time": "00:00",
          "value": 40,
          "timeAsSeconds": 0
        }
      ],
      "basal": [
        {
          "time": "00:00",
          "value": 0.8,
          "timeAsSeconds": 0
        },
        {
          "time": "03:00",
          "value": 0.6,
          "timeAsSeconds": 10800
        }
      ],
      "target_low": [
        {
          "time": "00:00",
          "value": 80,
          "timeAsSeconds": 0
        }
      ],
      "target_high": [
        {
          "time": "00:00",
          "value": 120,
          "timeAsSeconds": 0
        }
      ],
      "units": "mg/dl",
      "timezone": "America/New_York"
    }
  }
}
```

#### Create/Update Profile

```http
POST /api/v1/profile
Content-Type: application/json
Authorization: Bearer {token}

{
  "defaultProfile": "Default",
  "store": {
    "Default": {
      "dia": 4,
      "carbratio": [{
        "time": "00:00",
        "value": 10
      }],
      "sens": [{
        "time": "00:00", 
        "value": 40
      }],
      "basal": [{
        "time": "00:00",
        "value": 0.8
      }],
      "target_low": [{
        "time": "00:00",
        "value": 80
      }],
      "target_high": [{
        "time": "00:00",
        "value": 120
      }],
      "units": "mg/dl",
      "timezone": "America/New_York"
    }
  }
}
```

### Device Status

Upload and retrieve device status information from pumps, uploaders, and closed-loop systems.

#### Get Device Status

```http
GET /api/v1/devicestatus
Authorization: Bearer {token}
```

Query Parameters:
- `count` (number) - Number of records to return
- `find[created_at][$gte]` - Start date filter

#### Upload Device Status

```http
POST /api/v1/devicestatus
Content-Type: application/json
Authorization: Bearer {token}

{
  "device": "openaps://raspberrypi",
  "pump": {
    "battery": {
      "status": "normal",
      "voltage": 1.35
    },
    "reservoir": 142.6,
    "clock": "2024-01-20T10:30:00.000Z"
  },
  "openaps": {
    "iob": {
      "iob": 2.35,
      "activity": 0.0456,
      "basaliob": 0.234
    },
    "suggested": {
      "bg": 145,
      "temp": "absolute",
      "rate": 1.2,
      "duration": 30
    }
  },
  "uploader": {
    "battery": 85
  }
}
```

### Food Database

Manage custom food entries for carbohydrate counting.

#### Search Food

```http
GET /api/v1/food
Authorization: Bearer {token}
```

Query Parameters:
- `find` (string) - Search term
- `category` (string) - Filter by category

#### Add Food Entry

```http
POST /api/v1/food
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Pizza Slice",
  "category": "Dinner",
  "subcategory": "Italian",
  "carbs": 30,
  "unit": "slice",
  "notes": "Thin crust pepperoni"
}
```

## Multi-Tenant APIs

### Tenant Registration

Register a new tenant (organization) in the system.

```http
POST /api/tenants/register
Content-Type: application/json

{
  "subdomain": "my-clinic",
  "adminEmail": "admin@clinic.com",
  "adminPassword": "secure-password",
  "adminName": "Admin User",
  "hCaptchaResponse": "captcha-token"
}
```

Response:
```json
{
  "message": "Tenant registered successfully",
  "tenant": {
    "id": "tenant-id",
    "subdomain": "my-clinic",
    "createdAt": "2024-01-20T10:30:00.000Z"
  },
  "loginUrl": "https://my-clinic.nightscout.com/api/auth/login"
}
```

### Tenant Management

#### Get Current Tenant Info

```http
GET /api/tenants/current
Authorization: Bearer {token}
```

#### Update Tenant Settings

```http
PUT /api/tenants/current
Content-Type: application/json
Authorization: Bearer {token}

{
  "settings": {
    "units": "mmol/l",
    "timeFormat": 24,
    "language": "en"
  }
}
```

### User Management

#### List Tenant Users

```http
GET /api/tenants/users
Authorization: Bearer {token}
```

Required Role: `admin`

#### Create New User

```http
POST /api/tenants/users
Content-Type: application/json
Authorization: Bearer {token}

{
  "email": "user@example.com",
  "name": "New User",
  "role": "caregiver",
  "password": "initial-password"
}
```

Required Role: `admin`

#### Update User

```http
PUT /api/tenants/users/{userId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Updated Name",
  "role": "viewer",
  "isActive": true
}
```

Required Role: `admin`

#### Deactivate User

```http
DELETE /api/tenants/users/{userId}
Authorization: Bearer {token}
```

Required Role: `admin`

## Real-World Examples

### Mobile App Integration

#### Initial Setup

```javascript
// 1. Login and store tokens
async function login(email, password) {
  const response = await fetch('https://my-clinic.nightscout.com/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  // Store tokens securely
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
  
  return data;
}

// 2. Make authenticated requests
async function getRecentGlucose() {
  const token = await SecureStore.getItemAsync('accessToken');
  
  const response = await fetch('https://my-clinic.nightscout.com/api/v1/entries?count=1', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.status === 401) {
    // Token expired, refresh it
    await refreshAccessToken();
    return getRecentGlucose(); // Retry
  }
  
  return await response.json();
}
```

### Python Script for Data Export

```python
import requests
import pandas as pd
from datetime import datetime, timedelta

class NightscoutClient:
    def __init__(self, base_url, api_secret=None):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        
        if api_secret:
            # Legacy auth
            import hashlib
            hashed = hashlib.sha1(api_secret.encode()).hexdigest()
            self.session.headers['api-secret'] = hashed
    
    def login(self, email, password):
        """JWT authentication"""
        response = self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        response.raise_for_status()
        
        data = response.json()
        self.session.headers['Authorization'] = f"Bearer {data['accessToken']}"
        return data
    
    def get_entries(self, hours=24):
        """Get glucose entries for the past N hours"""
        end_date = datetime.now()
        start_date = end_date - timedelta(hours=hours)
        
        params = {
            'find[dateString][$gte]': start_date.isoformat(),
            'find[dateString][$lte]': end_date.isoformat(),
            'count': hours * 12  # Assuming 5-minute intervals
        }
        
        response = self.session.get(
            f"{self.base_url}/api/v1/entries",
            params=params
        )
        response.raise_for_status()
        
        return response.json()
    
    def export_to_csv(self, filename='glucose_data.csv'):
        """Export glucose data to CSV"""
        entries = self.get_entries(hours=168)  # 1 week
        
        df = pd.DataFrame(entries)
        df['datetime'] = pd.to_datetime(df['dateString'])
        df = df.sort_values('datetime')
        
        # Select relevant columns
        columns = ['datetime', 'sgv', 'direction', 'device']
        df[columns].to_csv(filename, index=False)
        
        print(f"Exported {len(df)} entries to {filename}")

# Usage
client = NightscoutClient('https://my-clinic.nightscout.com')
client.login('user@example.com', 'password')
client.export_to_csv()
```

### Real-time Data with WebSockets

```javascript
// Connect to Nightscout WebSocket for real-time updates
const io = require('socket.io-client');

function connectToNightscout(url, token) {
  const socket = io(url, {
    query: {
      token: token
    },
    transports: ['websocket']
  });
  
  socket.on('connect', () => {
    console.log('Connected to Nightscout');
    
    // Subscribe to data updates
    socket.emit('subscribe', {
      entries: true,
      treatments: true,
      devicestatus: true
    });
  });
  
  socket.on('dataUpdate', (data) => {
    console.log('New data received:', data);
    
    if (data.entries) {
      // Handle new glucose readings
      data.entries.forEach(entry => {
        console.log(`BG: ${entry.sgv} ${entry.direction} at ${entry.dateString}`);
      });
    }
    
    if (data.treatments) {
      // Handle new treatments
      data.treatments.forEach(treatment => {
        console.log(`Treatment: ${treatment.eventType} at ${treatment.created_at}`);
      });
    }
  });
  
  socket.on('announcement', (message) => {
    console.log('Announcement:', message);
  });
  
  return socket;
}
```

### Automated Insulin Calculations

```javascript
// Calculate insulin on board (IOB) and carbs on board (COB)
async function calculateIOBCOB(nightscoutUrl, token) {
  const headers = {
    'Authorization': `Bearer ${token}`
  };
  
  // Get recent treatments
  const treatmentsResponse = await fetch(
    `${nightscoutUrl}/api/v1/treatments?count=100`,
    { headers }
  );
  const treatments = await treatmentsResponse.json();
  
  // Get current profile
  const profileResponse = await fetch(
    `${nightscoutUrl}/api/v1/profile/current`,
    { headers }
  );
  const profile = await profileResponse.json();
  
  const now = new Date();
  const dia = profile.store[profile.defaultProfile].dia;
  
  // Calculate IOB
  let iob = 0;
  treatments
    .filter(t => t.insulin && t.insulin > 0)
    .forEach(treatment => {
      const minutesAgo = (now - new Date(treatment.created_at)) / 60000;
      if (minutesAgo < dia * 60) {
        // Simplified linear IOB decay
        const remaining = 1 - (minutesAgo / (dia * 60));
        iob += treatment.insulin * remaining;
      }
    });
  
  // Calculate COB (assuming 3-hour absorption)
  let cob = 0;
  treatments
    .filter(t => t.carbs && t.carbs > 0)
    .forEach(treatment => {
      const minutesAgo = (now - new Date(treatment.created_at)) / 60000;
      if (minutesAgo < 180) { // 3 hours
        const remaining = 1 - (minutesAgo / 180);
        cob += treatment.carbs * remaining;
      }
    });
  
  return {
    iob: Math.round(iob * 100) / 100,
    cob: Math.round(cob),
    timestamp: now.toISOString()
  };
}
```

## Data Standards

### Timestamps

All timestamps in the API use ISO 8601 format in UTC:
```
2024-01-20T10:30:00.000Z
```

For compatibility, some endpoints also accept/return Unix timestamps in milliseconds:
```json
{
  "date": 1705746600000,
  "mills": 1705746600000
}
```

### Units

#### Glucose Units
- **mg/dL** (default) - Milligrams per deciliter (US standard)
- **mmol/L** - Millimoles per liter (international standard)

Conversion: `mmol/L = mg/dL ÷ 18.018`

#### Time Formats
- **12** - 12-hour format with AM/PM
- **24** - 24-hour format (default)

### Direction Values

CGM trend arrows use these standard values:
- `"NONE"` - No trend data
- `"DoubleUp"` - Rising rapidly (> 3 mg/dL/min)
- `"SingleUp"` - Rising (2-3 mg/dL/min)
- `"FortyFiveUp"` - Rising slowly (1-2 mg/dL/min)
- `"Flat"` - Stable (< 1 mg/dL/min)
- `"FortyFiveDown"` - Falling slowly (1-2 mg/dL/min)
- `"SingleDown"` - Falling (2-3 mg/dL/min)
- `"DoubleDown"` - Falling rapidly (> 3 mg/dL/min)

## Security Best Practices

### Token Management

1. **Store tokens securely**
   - Never store tokens in plain text
   - Use secure storage (Keychain on iOS, Keystore on Android)
   - Encrypt tokens in browser localStorage

2. **Implement token refresh**
   - Refresh tokens before they expire
   - Handle 401 responses gracefully
   - Don't expose refresh tokens to client-side JavaScript

3. **Validate SSL certificates**
   - Always use HTTPS
   - Verify certificate validity
   - Pin certificates for mobile apps

### API Key Security

1. **Hash API secrets**
   - Always SHA-1 hash before sending
   - Never log or display raw secrets
   - Rotate secrets regularly

2. **Limit API key scope**
   - Create role-specific keys
   - Implement IP whitelisting
   - Set expiration dates

### Rate Limiting

Respect rate limits to ensure service availability:

- **Authentication endpoints**: 5 requests per minute
- **Data endpoints**: 60 requests per minute
- **Bulk operations**: 10 requests per minute

Handle rate limit responses:
```json
{
  "status": 429,
  "message": "Too many requests",
  "retryAfter": 60
}
```

### Data Privacy

1. **Minimize data exposure**
   - Request only needed fields
   - Use date filters to limit data
   - Implement client-side data retention policies

2. **Secure data transmission**
   - Use TLS 1.2 or higher
   - Implement certificate pinning
   - Validate data integrity

3. **Handle sensitive data properly**
   - Don't log personal information
   - Implement data anonymization
   - Follow HIPAA/GDPR guidelines

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "status": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "carbs",
      "message": "Must be a positive number"
    }
  ]
}
```

#### 401 Unauthorized
```json
{
  "status": 401,
  "message": "Invalid or expired token"
}
```

#### 403 Forbidden
```json
{
  "status": 403,
  "message": "Insufficient permissions for this operation"
}
```

#### 422 Unprocessable Entity
```json
{
  "status": 422,
  "message": "Duplicate entry",
  "details": {
    "dateString": "2024-01-20T10:30:00.000Z",
    "device": "xDrip"
  }
}
```

### Error Recovery Strategies

1. **Implement exponential backoff**
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

2. **Handle network failures**
```javascript
async function resilientFetch(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'NetworkError') {
      // Queue for later retry
      await queueForSync({ url, options });
      throw new Error('Network unavailable, queued for sync');
    }
    throw error;
  }
}
```

## Testing

### Test Environment Setup

1. **Local Development**
```bash
# Clone the repository
git clone https://github.com/nightscout/cgm-remote-monitor.git

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Run in development mode
npm run dev
```

2. **Test Data Generation**
```javascript
// Generate test glucose data
function generateTestEntries(hours = 24) {
  const entries = [];
  const now = Date.now();
  const interval = 5 * 60 * 1000; // 5 minutes
  
  for (let i = 0; i < hours * 12; i++) {
    const timestamp = now - (i * interval);
    const value = 100 + Math.sin(i / 10) * 50 + Math.random() * 20;
    
    entries.push({
      type: 'sgv',
      sgv: Math.round(value),
      direction: value > 140 ? 'FortyFiveUp' : 'Flat',
      device: 'test-generator',
      dateString: new Date(timestamp).toISOString(),
      date: timestamp
    });
  }
  
  return entries;
}
```

### API Testing with cURL

```bash
# Login
curl -X POST https://test.nightscout.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Get entries with token
curl -X GET https://test.nightscout.com/api/v1/entries?count=10 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

# Create treatment
curl -X POST https://test.nightscout.com/api/v1/treatments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{
    "eventType": "Meal Bolus",
    "carbs": 30,
    "insulin": 4,
    "created_at": "2024-01-20T12:00:00.000Z"
  }'
```

## API Versioning

### Version Strategy

- **Stable versions**: v1, v2, v3
- **Version in URL**: `/api/v1/`, `/api/v2/`, `/api/v3/`
- **Backwards compatibility**: Maintained for 2 major versions
- **Deprecation notices**: 6 months advance warning

### Migration Guide

#### v1 to v2
- Enhanced authorization endpoints
- Improved error responses
- Additional query parameters

#### v2 to v3
- Standardized REST operations
- WebSocket support
- Unified response format

### Feature Availability by Version

| Feature | v1 | v2 | v3 |
|---------|----|----|----| 
| Basic CRUD | ✓ | ✓ | ✓ |
| JWT Auth | ✓ | ✓ | ✓ |
| WebSockets | ✗ | ✗ | ✓ |
| Batch Operations | ✗ | ✓ | ✓ |
| GraphQL | ✗ | ✗ | Planned |

---

## Additional Resources

- [Nightscout Documentation](https://nightscout.github.io/)
- [OpenAPI Specification](/docs/openapi.yaml)
- [Postman Collection](/docs/nightscout-api.postman_collection.json)
- [Example Applications](/examples/)
- [Community Support](https://discord.gg/nightscout)

For questions and support, please visit our [GitHub repository](https://github.com/nightscout/cgm-remote-monitor) or join our Discord community.