# Diabeetech.net API Reference

## Overview

Diabeetech.net is a multi-tenant Nightscout deployment that provides comprehensive diabetes management APIs. Each tenant (organization) has their own subdomain and isolated data, accessible through both modern JWT authentication and legacy API_SECRET methods.

### Base URLs

**Tenant-specific URL format:**
```
https://{subdomain}.diabeetech.net/api
```

**Example for onepanman tenant:**
```
https://onepanman.diabeetech.net/api
```

### API Versions

- **v1**: Core functionality with backwards compatibility
- **v2**: Enhanced features with authorization endpoints
- **v3**: Modern REST API with WebSocket support

### Response Format

All successful API responses return JSON:
```json
{
  "status": 200,
  "result": "success",
  "data": { ... }
}
```

Error responses:
```json
{
  "status": 400,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## Authentication

Diabeetech.net supports two authentication methods:

### 1. JWT Authentication (Recommended for Web/Mobile Apps)

#### Login
```bash
curl -X POST https://onepanman.diabeetech.net/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "mark@markmireles.com", "password": "GodIsGood23!"}'
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": "24h",
  "user": {
    "userId": "41921f49-60b0-4f10-844b-eb06021acbb5",
    "email": "mark@markmireles.com",
    "role": "admin",
    "profile": {
      "displayName": "MarkT",
      "units": "mg/dl"
    }
  }
}
```

#### Using the Token
Include the access token in all authenticated requests:
```bash
curl -X GET https://onepanman.diabeetech.net/api/v1/entries?count=10 \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### Refresh Token
```bash
curl -X POST https://onepanman.diabeetech.net/api/auth/refresh \
    -H "Content-Type: application/json" \
    -d '{"refreshToken": "eyJhbGciOiJIUzI1NiIs..."}'
```

### 2. API_SECRET Authentication (For Devices/CGM Uploaders)

Each tenant has a unique API_SECRET that can be used as plain text or SHA-1 hash:

#### Using Plain Text API Secret
```bash
# Header method
curl -X GET https://onepanman.diabeetech.net/api/v1/entries?count=3 \
    -H "api-secret: GodIsSoGood2Me23!"

# Query parameter method
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3&secret=GodIsSoGood2Me23!"
```

#### Using SHA-1 Hash (More Secure)
```bash
# Generate SHA-1 hash
echo -n "GodIsSoGood2Me23!" | sha1sum
# Output: 51a26cb40dcca4fd97601d00f8253129091c06ca

# Use the hash
curl -X GET https://onepanman.diabeetech.net/api/v1/entries?count=3 \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca"
```

## Multi-Tenant Endpoints

### Tenant Registration

#### Register New Tenant
```bash
curl -X POST https://diabeetech.net/api/tenants/register \
    -H "Content-Type: application/json" \
    -d '{
      "subdomain": "myclinic",
      "adminEmail": "admin@myclinic.com",
      "adminPassword": "SecurePassword123!",
      "adminName": "Clinic Admin",
      "hCaptchaResponse": "captcha-token-here"
    }'
```

### User Management

#### Get Current User Profile
```bash
curl -X GET https://onepanman.diabeetech.net/api/auth/profile \
    -H "Authorization: Bearer {token}"
```

#### Update Profile
```bash
curl -X PUT https://onepanman.diabeetech.net/api/auth/profile \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "profile": {
        "timezone": "America/New_York",
        "units": "mg/dl"
      }
    }'
```

#### Change Password
```bash
curl -X POST https://onepanman.diabeetech.net/api/auth/change-password \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "currentPassword": "oldpassword",
      "newPassword": "newpassword123!"
    }'
```

### Tenant Administration (Admin Only)

#### List Tenant Users
```bash
curl -X GET https://onepanman.diabeetech.net/api/tenants/users \
    -H "Authorization: Bearer {admin-token}"
```

#### Create New User
```bash
curl -X POST https://onepanman.diabeetech.net/api/tenants/users \
    -H "Authorization: Bearer {admin-token}" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "newuser@example.com",
      "name": "New User",
      "role": "caregiver",
      "password": "initialPassword123!"
    }'
```

## Core API Endpoints

### Glucose Entries (CGM Data)

#### Get Recent Entries
```bash
# Get last 10 entries
curl -X GET https://onepanman.diabeetech.net/api/v1/entries?count=10 \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca"
```

#### Get Entries for Date Range
```bash
# Get entries for the last 24 hours
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?find[dateString][\$gte]=2025-07-22&find[dateString][\$lte]=2025-07-23&count=288" \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca"
```

#### Upload New Entry
```bash
curl -X POST https://onepanman.diabeetech.net/api/v1/entries \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
    -H "Content-Type: application/json" \
    -d '[{
      "sgv": 120,
      "date": 1753280000000,
      "dateString": "2025-07-23T14:00:00.000Z",
      "direction": "Flat",
      "type": "sgv",
      "device": "xDrip"
    }]'
```

#### Entry Field Reference
- `sgv`: Sensor glucose value in mg/dL
- `mbg`: Meter blood glucose in mg/dL (for calibrations)
- `direction`: Trend arrow - "NONE", "DoubleUp", "SingleUp", "FortyFiveUp", "Flat", "FortyFiveDown", "SingleDown", "DoubleDown"
- `type`: "sgv" (sensor glucose), "mbg" (meter blood glucose), "cal" (calibration)
- `device`: Source device identifier (e.g., "xDrip", "share2", "Spike")
- `dateString`: ISO 8601 timestamp
- `date`: Unix timestamp in milliseconds
- `noise`: CGM noise level (1=Clean, 2=Light, 3=Medium, 4=Heavy)

### Treatments

#### Get Recent Treatments
```bash
curl -X GET https://onepanman.diabeetech.net/api/v1/treatments?count=50 \
    -H "Authorization: Bearer {token}"
```

#### Create Meal Bolus
```bash
curl -X POST https://onepanman.diabeetech.net/api/v1/treatments \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "eventType": "Meal Bolus",
      "carbs": 45,
      "insulin": 6.5,
      "created_at": "2025-07-23T12:00:00.000Z",
      "notes": "Lunch - sandwich and fruit"
    }'
```

#### Create Correction Bolus
```bash
curl -X POST https://onepanman.diabeetech.net/api/v1/treatments \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "eventType": "Correction Bolus",
      "insulin": 2.0,
      "glucose": 250,
      "glucoseType": "Finger",
      "units": "mg/dl",
      "created_at": "2025-07-23T14:30:00.000Z"
    }'
```

#### Create Temp Basal
```bash
curl -X POST https://onepanman.diabeetech.net/api/v1/treatments \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "eventType": "Temp Basal",
      "duration": 60,
      "percent": -50,
      "created_at": "2025-07-23T15:00:00.000Z",
      "notes": "Exercise"
    }'
```

#### Treatment Event Types
- **Bolus**: "Meal Bolus", "Correction Bolus", "Combo Bolus"
- **Basal**: "Temp Basal", "Basal Profile Change"
- **Carbs**: "Carbs", "Carb Correction"
- **Other**: "Exercise", "Site Change", "Sensor Change", "Note", "Announcement"

### Profiles

#### Get Current Profile
```bash
curl -X GET https://onepanman.diabeetech.net/api/v1/profile/current \
    -H "Authorization: Bearer {token}"
```

#### Create/Update Profile
```bash
curl -X POST https://onepanman.diabeetech.net/api/v1/profile \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "defaultProfile": "Default",
      "store": {
        "Default": {
          "dia": 4,
          "carbratio": [
            {"time": "00:00", "value": 10},
            {"time": "06:00", "value": 8},
            {"time": "12:00", "value": 10}
          ],
          "sens": [
            {"time": "00:00", "value": 40},
            {"time": "22:00", "value": 50}
          ],
          "basal": [
            {"time": "00:00", "value": 0.8},
            {"time": "03:00", "value": 0.6},
            {"time": "07:00", "value": 1.0}
          ],
          "target_low": [{"time": "00:00", "value": 80}],
          "target_high": [{"time": "00:00", "value": 120}],
          "units": "mg/dl",
          "timezone": "America/New_York"
        }
      }
    }'
```

### Device Status

#### Upload Pump/Loop Status
```bash
curl -X POST https://onepanman.diabeetech.net/api/v1/devicestatus \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "device": "openaps://myloop",
      "pump": {
        "battery": {"status": "normal", "voltage": 1.35},
        "reservoir": 142.6,
        "clock": "2025-07-23T14:00:00.000Z"
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
          "duration": 30,
          "reason": "BG 145>120, IOB 2.35"
        }
      },
      "uploader": {
        "battery": 85
      },
      "created_at": "2025-07-23T14:00:00.000Z"
    }'
```

### Food Database

#### Search Food
```bash
curl -X GET "https://onepanman.diabeetech.net/api/v1/food?find=pizza" \
    -H "Authorization: Bearer {token}"
```

#### Add Custom Food
```bash
curl -X POST https://onepanman.diabeetech.net/api/v1/food \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Homemade Pizza Slice",
      "category": "Dinner",
      "subcategory": "Italian",
      "carbs": 35,
      "unit": "slice",
      "notes": "Thin crust with veggies"
    }'
```

### System Status

#### Check API Status
```bash
curl -X GET https://onepanman.diabeetech.net/api/v1/status
```

#### Verify Authentication
```bash
curl -X GET https://onepanman.diabeetech.net/api/v1/verifyauth \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca"
```

## API v3 Endpoints

API v3 provides standardized REST operations for all collections:

### Generic Operations

For collections: `entries`, `treatments`, `devicestatus`, `profile`, `food`, `settings`

#### Search/List Documents
```bash
# Get entries with filtering
curl -X GET "https://onepanman.diabeetech.net/api/v3/entries?limit=10&sort\$desc=date" \
    -H "Authorization: Bearer {token}"
```

#### Create Document
```bash
curl -X POST https://onepanman.diabeetech.net/api/v3/entries \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "type": "sgv",
      "sgv": 150,
      "date": 1753280000000,
      "device": "xDrip"
    }'
```

#### Get Specific Document
```bash
curl -X GET https://onepanman.diabeetech.net/api/v3/entries/{identifier} \
    -H "Authorization: Bearer {token}"
```

#### Update Document
```bash
# Full replacement
curl -X PUT https://onepanman.diabeetech.net/api/v3/entries/{identifier} \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{ ... complete document ... }'

# Partial update
curl -X PATCH https://onepanman.diabeetech.net/api/v3/entries/{identifier} \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{ "notes": "Updated note" }'
```

#### Delete Document
```bash
curl -X DELETE https://onepanman.diabeetech.net/api/v3/entries/{identifier} \
    -H "Authorization: Bearer {token}"
```

### WebSocket Support

API v3 supports real-time data via WebSockets:

```javascript
const io = require('socket.io-client');

const socket = io('https://onepanman.diabeetech.net', {
  query: { token: 'your-jwt-token' },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to Nightscout');
  socket.emit('subscribe', {
    entries: true,
    treatments: true,
    devicestatus: true
  });
});

socket.on('dataUpdate', (data) => {
  console.log('New data:', data);
});
```

## Device Configuration

### xDrip+ Setup
1. Settings → Cloud Upload → Nightscout Sync
2. Base URL: `https://onepanman.diabeetech.net`
3. API Secret: `GodIsSoGood2Me23!` (use plain text)
4. Enable "Upload BG as JSON"

### Spike Setup
1. Settings → Integration → Nightscout
2. URL: `https://onepanman.diabeetech.net`
3. API Secret: `GodIsSoGood2Me23!`
4. Enable "Upload Readings"

### Loop/AAPS Setup
1. Nightscout URL: `https://onepanman.diabeetech.net`
2. API Secret: `GodIsSoGood2Me23!`
3. Enable remote monitoring

### Dexcom Bridge Configuration
For automatic Dexcom data import:
```bash
curl -X POST https://onepanman.diabeetech.net/api/tenant-settings/bridge \
    -H "Authorization: Bearer {admin-token}" \
    -H "Content-Type: application/json" \
    -d '{
      "bridge": {
        "userName": "dexcom-username",
        "password": "dexcom-password",
        "interval": 300000,
        "fetch": true
      }
    }'
```

## Rate Limits & Best Practices

### Rate Limiting
- Authentication endpoints: 5 requests/minute
- Data endpoints: 60 requests/minute
- Bulk operations: 10 requests/minute

### Best Practices

1. **Use JWT for Interactive Apps**
   - More secure than API_SECRET
   - Supports user roles and permissions
   - Token refresh mechanism

2. **Use API_SECRET for Devices**
   - Simple authentication for CGM uploaders
   - No token management required
   - SHA-1 hash for better security

3. **Batch Operations**
   ```bash
   # Upload multiple entries at once
   curl -X POST https://onepanman.diabeetech.net/api/v1/entries \
       -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
       -H "Content-Type: application/json" \
       -d '[
         {"sgv": 120, "date": 1753280000000, ...},
         {"sgv": 125, "date": 1753280300000, ...},
         {"sgv": 130, "date": 1753280600000, ...}
       ]'
   ```

4. **Error Handling**
   - Check response status codes
   - Implement exponential backoff for retries
   - Handle 401 errors by refreshing tokens

5. **Data Filtering**
   - Use date ranges to limit data
   - Specify count parameter
   - Use field selection when available

## Example Integration

### Python Client
```python
import requests
import hashlib
from datetime import datetime

class DiabeetechClient:
    def __init__(self, subdomain, api_secret):
        self.base_url = f"https://{subdomain}.diabeetech.net"
        self.api_secret = api_secret
        self.api_secret_hash = hashlib.sha1(api_secret.encode()).hexdigest()
    
    def get_entries(self, count=10):
        response = requests.get(
            f"{self.base_url}/api/v1/entries",
            headers={"api-secret": self.api_secret_hash},
            params={"count": count}
        )
        response.raise_for_status()
        return response.json()
    
    def upload_entry(self, sgv, direction="Flat", device="python-client"):
        entry = {
            "type": "sgv",
            "sgv": sgv,
            "direction": direction,
            "device": device,
            "date": int(datetime.now().timestamp() * 1000),
            "dateString": datetime.now().isoformat() + "Z"
        }
        
        response = requests.post(
            f"{self.base_url}/api/v1/entries",
            headers={
                "api-secret": self.api_secret_hash,
                "Content-Type": "application/json"
            },
            json=[entry]
        )
        response.raise_for_status()
        return response.json()

# Usage
client = DiabeetechClient("onepanman", "GodIsSoGood2Me23!")
entries = client.get_entries(count=5)
print(f"Latest BG: {entries[0]['sgv']} mg/dL")
```

### JavaScript/Node.js Client
```javascript
const crypto = require('crypto');
const axios = require('axios');

class DiabeetechClient {
  constructor(subdomain, apiSecret) {
    this.baseUrl = `https://${subdomain}.diabeetech.net`;
    this.apiSecret = apiSecret;
    this.apiSecretHash = crypto.createHash('sha1').update(apiSecret).digest('hex');
  }
  
  async getEntries(count = 10) {
    const response = await axios.get(`${this.baseUrl}/api/v1/entries`, {
      headers: { 'api-secret': this.apiSecretHash },
      params: { count }
    });
    return response.data;
  }
  
  async uploadEntry(sgv, direction = 'Flat', device = 'js-client') {
    const entry = {
      type: 'sgv',
      sgv,
      direction,
      device,
      date: Date.now(),
      dateString: new Date().toISOString()
    };
    
    const response = await axios.post(
      `${this.baseUrl}/api/v1/entries`,
      [entry],
      {
        headers: {
          'api-secret': this.apiSecretHash,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }
}

// Usage
const client = new DiabeetechClient('onepanman', 'GodIsSoGood2Me23!');
const entries = await client.getEntries(5);
console.log(`Latest BG: ${entries[0].sgv} mg/dL`);
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check API_SECRET is correct
   - Verify JWT token hasn't expired
   - Ensure using correct subdomain

2. **500 Internal Server Error**
   - Check JSON formatting in request body
   - Verify all required fields are provided
   - Check server logs: `heroku logs --tail -a btech`

3. **No Data Returned**
   - Verify date filters are correct
   - Check timezone settings
   - Ensure data exists in the time range

### Debug Commands

```bash
# Test API connectivity
curl -I https://onepanman.diabeetech.net/api/v1/status

# Verify authentication
curl -X GET https://onepanman.diabeetech.net/api/v1/verifyauth \
    -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
    -v

# Check recent errors
heroku logs --tail -a btech | grep ERROR
```

## Support

For issues or questions:
- GitHub: https://github.com/nightscout/cgm-remote-monitor
- Documentation: This file
- Test Tenant: onepanman.diabeetech.net

---

Last Updated: July 23, 2025
API Version: v1, v2, v3
Multi-tenant Version: 15.0.2