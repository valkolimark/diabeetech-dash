# Treatments API Implementation Guide

## Overview
The Treatments API allows you to create, read, update, and manage treatment records in Nightscout. This guide provides comprehensive information on how to correctly implement API calls for treatments in a multi-tenant environment.

## Table of Contents
1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Treatment Types](#treatment-types)
4. [API Implementation Examples](#api-implementation-examples)
5. [Best Practices](#best-practices)
6. [Error Handling](#error-handling)
7. [Testing](#testing)

## Authentication

### API Secret
All treatments API calls require authentication using an API secret hash.

```bash
# Generate SHA-1 hash of your API secret
API_SECRET="your-api-secret"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
```

### Required Headers
```http
api-secret: <sha1-hash-of-api-secret>
Content-Type: application/json
Accept: application/json
```

### Multi-tenant Headers (Optional)
```http
X-Tenant-Subdomain: <tenant-subdomain>
X-Tenant-ID: <tenant-id>
```

## API Endpoints

### Base URL
```
https://<subdomain>.diabeetech.net/api/v1/treatments
```

### Available Operations

#### 1. List Treatments (GET)
```http
GET /api/v1/treatments
```

**Query Parameters:**
- `count` - Number of records to return (default: 10, max: 1000)
- `find[eventType]` - Filter by event type
- `find[created_at][$gte]` - Start date (ISO 8601)
- `find[created_at][$lte]` - End date (ISO 8601)
- `find[_id]` - Find specific treatment by ID

**Example:**
```bash
curl -X GET "https://subdomain.diabeetech.net/api/v1/treatments?count=20&find[eventType]=Meal%20Bolus" \
  -H "api-secret: $API_SECRET_HASH" \
  -H "Accept: application/json"
```

#### 2. Create Treatment(s) (POST)
```http
POST /api/v1/treatments
```

Accepts single object or array of objects.

**Example - Single Treatment:**
```bash
curl -X POST "https://subdomain.diabeetech.net/api/v1/treatments" \
  -H "api-secret: $API_SECRET_HASH" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "Meal Bolus",
    "insulin": 5.5,
    "carbs": 45,
    "created_at": "2025-07-25T12:00:00.000Z",
    "notes": "Lunch"
  }'
```

**Example - Multiple Treatments:**
```bash
curl -X POST "https://subdomain.diabeetech.net/api/v1/treatments" \
  -H "api-secret: $API_SECRET_HASH" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "eventType": "Meal Bolus",
      "carbs": 30,
      "insulin": 3.0,
      "created_at": "2025-07-25T08:00:00.000Z"
    },
    {
      "eventType": "Correction Bolus",
      "insulin": 1.5,
      "created_at": "2025-07-25T10:00:00.000Z"
    }
  ]'
```

## Treatment Types

### Common Treatment Types and Their Fields

#### 1. Note
Simple text note entry.
```json
{
  "eventType": "Note",
  "notes": "Feeling low, had orange juice",
  "created_at": "2025-07-25T14:30:00.000Z"
}
```

#### 2. BG Check
Blood glucose reading.
```json
{
  "eventType": "BG Check",
  "glucose": 120,
  "glucoseType": "Finger",
  "units": "mg/dl",
  "created_at": "2025-07-25T14:00:00.000Z"
}
```

#### 3. Meal Bolus
Insulin dose for meals.
```json
{
  "eventType": "Meal Bolus",
  "insulin": 6.5,
  "carbs": 55,
  "notes": "Dinner - pasta",
  "created_at": "2025-07-25T18:00:00.000Z"
}
```

#### 4. Correction Bolus
Insulin dose for high BG correction.
```json
{
  "eventType": "Correction Bolus",
  "insulin": 2.0,
  "notes": "High BG correction",
  "created_at": "2025-07-25T16:00:00.000Z"
}
```

#### 5. Carb Correction
Carbohydrate intake without insulin.
```json
{
  "eventType": "Carb Correction",
  "carbs": 15,
  "notes": "Low BG treatment",
  "created_at": "2025-07-25T15:30:00.000Z"
}
```

#### 6. Temp Basal
Temporary basal rate adjustment.
```json
{
  "eventType": "Temp Basal",
  "duration": 30,
  "absolute": 0.5,
  "notes": "Exercise",
  "created_at": "2025-07-25T09:00:00.000Z"
}
```

#### 7. Exercise
Physical activity logging.
```json
{
  "eventType": "Exercise",
  "duration": 45,
  "notes": "Morning run - 5km",
  "created_at": "2025-07-25T07:00:00.000Z"
}
```

### Complete List of Supported Event Types
- `"Note"`
- `"BG Check"`
- `"Meal Bolus"`
- `"Correction Bolus"`
- `"Carb Correction"`
- `"Temp Basal"`
- `"Exercise"`
- `"Insulin Change"`
- `"Sensor Change"`
- `"Pump Battery Change"`
- `"Announcement"`
- `"Profile Switch"`
- `"Combo Bolus"`
- `"Temporary Target"`

## API Implementation Examples

### JavaScript/Node.js Example
```javascript
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const API_SECRET = 'your-api-secret';
const API_SECRET_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');
const BASE_URL = 'https://subdomain.diabeetech.net';

// Create a treatment
async function createTreatment(treatment) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/v1/treatments`,
      treatment,
      {
        headers: {
          'api-secret': API_SECRET_HASH,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating treatment:', error.response?.data || error.message);
    throw error;
  }
}

// Example usage
const newTreatment = {
  eventType: 'Meal Bolus',
  insulin: 5.5,
  carbs: 45,
  created_at: new Date().toISOString(),
  notes: 'Lunch'
};

createTreatment(newTreatment)
  .then(result => console.log('Treatment created:', result))
  .catch(error => console.error('Failed to create treatment:', error));
```

### Python Example
```python
import requests
import hashlib
from datetime import datetime

# Configuration
API_SECRET = 'your-api-secret'
API_SECRET_HASH = hashlib.sha1(API_SECRET.encode()).hexdigest()
BASE_URL = 'https://subdomain.diabeetech.net'

def create_treatment(treatment):
    """Create a new treatment"""
    headers = {
        'api-secret': API_SECRET_HASH,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    
    response = requests.post(
        f'{BASE_URL}/api/v1/treatments',
        json=treatment,
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Error: {response.status_code} - {response.text}")

# Example usage
new_treatment = {
    'eventType': 'Meal Bolus',
    'insulin': 5.5,
    'carbs': 45,
    'created_at': datetime.utcnow().isoformat() + 'Z',
    'notes': 'Lunch'
}

try:
    result = create_treatment(new_treatment)
    print('Treatment created:', result)
except Exception as e:
    print('Failed to create treatment:', e)
```

### cURL Script Example
```bash
#!/bin/bash

# Configuration
SUBDOMAIN="your-subdomain"
API_SECRET="your-api-secret"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://${SUBDOMAIN}.diabeetech.net"

# Function to create treatment
create_treatment() {
    local treatment_json="$1"
    
    curl -s -X POST "${BASE_URL}/api/v1/treatments" \
        -H "api-secret: ${API_SECRET_HASH}" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "$treatment_json"
}

# Example: Create a meal bolus
TREATMENT='{
  "eventType": "Meal Bolus",
  "insulin": 5.5,
  "carbs": 45,
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "notes": "Lunch"
}'

RESPONSE=$(create_treatment "$TREATMENT")
echo "Response: $RESPONSE"
```

## Best Practices

### 1. Timestamp Handling
- Always use ISO 8601 format: `YYYY-MM-DDTHH:MM:SS.sssZ`
- Include timezone information or use UTC
- If `created_at` is not provided, the server will use the current time

### 2. Data Validation
- Always include `eventType` field
- Validate numeric fields (insulin, carbs, glucose) before sending
- Use appropriate units for glucose (mg/dl or mmol)

### 3. Error Handling
- Check HTTP status codes
- Parse error messages from response body
- Implement retry logic for network failures
- Log failed requests for debugging

### 4. Batch Operations
- Use array format to create multiple treatments in one request
- Limit batch size to reasonable numbers (e.g., 100 treatments)
- Monitor response for partial failures

### 5. Security
- Never expose API secrets in client-side code
- Use HTTPS for all API calls
- Store API secrets securely (environment variables, secure vaults)
- Rotate API secrets periodically

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "status": 401,
  "message": "Unauthorized",
  "error": "Invalid API secret"
}
```

#### 400 Bad Request
```json
{
  "status": 400,
  "message": "Bad Request",
  "error": "Invalid treatment data"
}
```

#### 500 Internal Server Error
```json
{
  "status": 500,
  "message": "Internal server error",
  "error": "An error occurred"
}
```

### Error Handling Strategy
```javascript
function handleApiError(error) {
  if (error.response) {
    switch (error.response.status) {
      case 401:
        console.error('Authentication failed - check API secret');
        break;
      case 400:
        console.error('Invalid data:', error.response.data);
        break;
      case 500:
        console.error('Server error - try again later');
        break;
      default:
        console.error('Unexpected error:', error.response.status);
    }
  } else if (error.request) {
    console.error('Network error - no response received');
  } else {
    console.error('Error setting up request:', error.message);
  }
}
```

## Testing

### Test Checklist
1. ✅ Authentication with valid API secret
2. ✅ Authentication with invalid API secret (should fail)
3. ✅ Create single treatment
4. ✅ Create multiple treatments
5. ✅ Read treatments with filters
6. ✅ Handle missing required fields
7. ✅ Handle invalid data types
8. ✅ Test all treatment types your app uses
9. ✅ Verify timezone handling
10. ✅ Test error scenarios

### Sample Test Script
See `/scripts/tests/test-treatments-comprehensive.sh` for a complete testing example.

## Troubleshooting

### Common Issues

1. **500 Error on POST**
   - Check that all required headers are present
   - Verify JSON syntax is valid
   - Ensure `created_at` is properly formatted

2. **Empty Response on GET**
   - Check date range filters
   - Verify treatments exist for the tenant
   - Check authentication is working

3. **401 Unauthorized**
   - Verify API secret is correct
   - Check SHA-1 hash generation
   - Ensure header name is exactly `api-secret`

4. **Treatments Not Appearing**
   - Allow time for data propagation (1-2 seconds)
   - Check correct tenant/subdomain
   - Verify `created_at` timestamp is reasonable

## Additional Resources

- [Nightscout Documentation](http://www.nightscout.info/)
- [API Testing Scripts](/scripts/tests/)
- [Multi-tenant Setup Guide](/docs/MULTI-TENANT-SETUP.md)