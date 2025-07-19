# Nightscout Multi-Tenant Device Integration Guide

## Overview

This guide explains how to integrate glucose monitoring devices (CGMs, pumps, etc.) with the multi-tenant Nightscout system.

## Authentication Methods

### 1. JWT Token Authentication (Recommended)

Devices should authenticate using JWT tokens for maximum security and flexibility.

#### Step 1: Obtain Authentication Token

```bash
POST https://clinic1.diabeetech.net/api/auth/login
Content-Type: application/json

{
  "email": "device@clinic1.diabeetech.com",
  "password": "device-password"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": "24h"
}
```

#### Step 2: Use Token in Requests

Include the token in all API requests:

```bash
GET https://clinic1.diabeetech.net/api/v1/entries
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### 2. API Secret Authentication (Legacy Support)

For devices that can't handle JWT tokens, API_SECRET is still supported:

```bash
POST https://clinic1.diabeetech.net/api/v1/entries
Content-Type: application/json
api-secret: your-hashed-api-secret

{
  "type": "sgv",
  "sgv": 120,
  "date": 1234567890000,
  "dateString": "2023-01-01T12:00:00.000Z"
}
```

## Device User Creation

### Create a Device-Specific User

It's recommended to create a dedicated user for each device:

```bash
POST https://clinic1.diabeetech.net/api/tenants/users
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "dexcom-g6-12345@clinic1.diabeetech.com",
  "password": "secure-device-password",
  "role": "caregiver",
  "profile": {
    "displayName": "Dexcom G6 - Patient John Doe",
    "deviceType": "dexcom-g6",
    "deviceSerial": "12345"
  }
}
```

## Common Device Endpoints

### Upload Glucose Readings

```bash
POST https://clinic1.diabeetech.net/api/v1/entries
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "type": "sgv",
    "sgv": 120,
    "direction": "Flat",
    "date": 1234567890000,
    "dateString": "2023-01-01T12:00:00.000Z",
    "device": "dexcom-g6"
  }
]
```

### Upload Device Status

```bash
POST https://clinic1.diabeetech.net/api/v1/devicestatus
Authorization: Bearer <token>
Content-Type: application/json

{
  "device": "openaps://raspberrypi",
  "pump": {
    "battery": {
      "status": "normal",
      "voltage": 1.52
    },
    "reservoir": 205.4,
    "clock": "2023-01-01T12:00:00.000Z"
  }
}
```

### Upload Treatments

```bash
POST https://clinic1.diabeetech.net/api/v1/treatments
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventType": "Correction Bolus",
  "insulin": 2.5,
  "created_at": "2023-01-01T12:00:00.000Z",
  "carbs": 0,
  "notes": "Correction for high BG"
}
```

## Device Integration Examples

### Example: Dexcom Share Integration

```python
import requests
import json

class DexcomNightscoutUploader:
    def __init__(self, nightscout_url, email, password):
        self.base_url = nightscout_url
        self.token = None
        self.email = email
        self.password = password
        self.authenticate()
    
    def authenticate(self):
        """Authenticate and get JWT token"""
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"email": self.email, "password": self.password}
        )
        if response.ok:
            data = response.json()
            self.token = data['accessToken']
        else:
            raise Exception("Authentication failed")
    
    def upload_glucose(self, glucose_value, trend, timestamp):
        """Upload glucose reading to Nightscout"""
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        entry = {
            "type": "sgv",
            "sgv": glucose_value,
            "direction": trend,
            "date": timestamp,
            "device": "dexcom-share"
        }
        
        response = requests.post(
            f"{self.base_url}/api/v1/entries",
            headers=headers,
            json=[entry]
        )
        
        return response.ok

# Usage
uploader = DexcomNightscoutUploader(
    "https://clinic1.diabeetech.net",
    "device@clinic1.diabeetech.com",
    "device-password"
)

# Upload a reading
uploader.upload_glucose(120, "Flat", 1234567890000)
```

### Example: xDrip+ Configuration

For xDrip+ app configuration:

1. **Base URL**: `https://clinic1.diabeetech.net`
2. **API Secret**: Leave empty (use JWT instead)
3. **Custom Headers**: 
   ```
   Authorization: Bearer <your-jwt-token>
   ```

### Example: OpenAPS/Loop Integration

For OpenAPS or Loop, configure the uploader:

```bash
# nightscout.ini or similar config
NIGHTSCOUT_HOST=https://clinic1.diabeetech.net
NS_AUTH_TYPE=jwt
NS_JWT_TOKEN=eyJhbGciOiJIUzI1NiIs...
```

## Rate Limiting

To prevent abuse, the API implements rate limiting:

- **Authentication**: 5 requests per minute
- **Data Upload**: 100 requests per minute per device
- **Data Query**: 30 requests per minute

## Best Practices

1. **Use Device-Specific Users**: Create a separate user for each device
2. **Secure Token Storage**: Store tokens securely on the device
3. **Token Refresh**: Implement token refresh before expiration
4. **Error Handling**: Implement retry logic with exponential backoff
5. **Batch Uploads**: Upload multiple readings in a single request when possible
6. **Time Synchronization**: Ensure device time is synchronized

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Token expired - refresh the token
   - Invalid credentials - check email/password
   - Wrong tenant - ensure using correct subdomain

2. **403 Forbidden**
   - User doesn't have required permissions
   - User role should be 'caregiver' or 'admin'

3. **429 Too Many Requests**
   - Rate limit exceeded
   - Implement backoff and retry

4. **500 Server Error**
   - Check request format
   - Ensure all required fields are present

## Security Considerations

1. **HTTPS Only**: Always use HTTPS for API calls
2. **Token Rotation**: Rotate device tokens periodically
3. **Minimal Permissions**: Give devices only necessary permissions
4. **Audit Logs**: Monitor device upload patterns for anomalies

## Support

For device integration support:
- Check device logs for error messages
- Verify authentication is working
- Test with curl or Postman first
- Contact tenant administrator for device user creation