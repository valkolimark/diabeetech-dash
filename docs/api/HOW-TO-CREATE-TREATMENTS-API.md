# How to Properly Create Treatments via Nightscout API

## Overview
This guide explains how to correctly create treatments using the Nightscout API to ensure they display properly in the web interface.

## Required Fields

### Minimum Required Fields
Every treatment MUST have these fields:
- `eventType` - The type of treatment
- `created_at` - ISO 8601 timestamp
- `mills` - Epoch timestamp in milliseconds

### Recommended Fields
- `enteredBy` - Who/what created the entry
- `notes` - Additional context

## Field Specifications

### eventType (Required)
The type of treatment being logged. Valid values:
- `"Note"` - Text note only
- `"BG Check"` - Blood glucose measurement
- `"Meal Bolus"` - Insulin for food
- `"Correction Bolus"` - Insulin for high BG
- `"Carb Correction"` - Carbs without insulin
- `"Temp Basal"` - Temporary basal rate
- `"Exercise"` - Physical activity
- `"Insulin Change"` - New insulin cartridge/vial
- `"Sensor Change"` - New CGM sensor
- `"Pump Battery Change"` - Pump battery replacement

### created_at (Required)
ISO 8601 formatted timestamp with timezone:
- Format: `YYYY-MM-DDTHH:MM:SS.sssZ`
- Example: `"2025-07-25T14:30:00.000Z"`
- Must include timezone (Z for UTC)

### mills (Required)
Epoch timestamp in milliseconds:
- Must match the `created_at` time
- Calculate: `new Date(created_at).getTime()`
- Example: `1753453800000`

### enteredBy (Recommended)
Source of the treatment:
- Device/app name: `"itiflux"`, `"xDrip"`, `"Loop"`
- User name: `"John"`, `"Mary"`
- Keep consistent across entries

## Complete Examples

### 1. Meal Bolus (Insulin + Carbs)
```json
{
  "eventType": "Meal Bolus",
  "insulin": 6.5,
  "carbs": 55,
  "created_at": "2025-07-25T12:00:00.000Z",
  "mills": 1753444800000,
  "enteredBy": "itiflux",
  "notes": "Lunch - pasta"
}
```

### 2. Correction Bolus (Insulin Only)
```json
{
  "eventType": "Correction Bolus",
  "insulin": 2.0,
  "created_at": "2025-07-25T14:00:00.000Z",
  "mills": 1753451200000,
  "enteredBy": "itiflux",
  "notes": "High BG correction"
}
```

### 3. Carb Correction (Carbs Only)
```json
{
  "eventType": "Carb Correction",
  "carbs": 15,
  "created_at": "2025-07-25T15:30:00.000Z",
  "mills": 1753456600000,
  "enteredBy": "itiflux",
  "notes": "Low BG treatment"
}
```

### 4. Blood Glucose Check
```json
{
  "eventType": "BG Check",
  "glucose": 120,
  "glucoseType": "Finger",
  "units": "mg/dl",
  "created_at": "2025-07-25T14:00:00.000Z",
  "mills": 1753451200000,
  "enteredBy": "itiflux"
}
```

### 5. Exercise
```json
{
  "eventType": "Exercise",
  "duration": 30,
  "created_at": "2025-07-25T07:00:00.000Z",
  "mills": 1753426800000,
  "enteredBy": "itiflux",
  "notes": "Morning run"
}
```

### 6. Note
```json
{
  "eventType": "Note",
  "created_at": "2025-07-25T16:00:00.000Z",
  "mills": 1753459200000,
  "enteredBy": "itiflux",
  "notes": "Feeling tired, possible low coming"
}
```

## Code Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const API_SECRET = 'your-api-secret';
const API_SECRET_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');
const BASE_URL = 'https://your-subdomain.diabeetech.net';

// Create treatment with proper mills field
function createTreatment(eventType, data) {
  const now = new Date();
  const treatment = {
    eventType: eventType,
    created_at: now.toISOString(),
    mills: now.getTime(),
    enteredBy: 'itiflux',
    ...data
  };

  return axios.post(
    `${BASE_URL}/api/v1/treatments`,
    treatment,
    {
      headers: {
        'api-secret': API_SECRET_HASH,
        'Content-Type': 'application/json'
      }
    }
  );
}

// Example usage
createTreatment('Meal Bolus', {
  insulin: 5.5,
  carbs: 45,
  notes: 'Lunch'
});
```

### Python
```python
import requests
import hashlib
from datetime import datetime

# Configuration
API_SECRET = 'your-api-secret'
API_SECRET_HASH = hashlib.sha1(API_SECRET.encode()).hexdigest()
BASE_URL = 'https://your-subdomain.diabeetech.net'

def create_treatment(event_type, **data):
    """Create a treatment with proper mills field"""
    now = datetime.utcnow()
    
    treatment = {
        'eventType': event_type,
        'created_at': now.isoformat() + 'Z',
        'mills': int(now.timestamp() * 1000),
        'enteredBy': 'itiflux',
        **data
    }
    
    response = requests.post(
        f'{BASE_URL}/api/v1/treatments',
        json=treatment,
        headers={
            'api-secret': API_SECRET_HASH,
            'Content-Type': 'application/json'
        }
    )
    
    return response.json()

# Example usage
create_treatment('Meal Bolus', insulin=5.5, carbs=45, notes='Lunch')
```

### cURL
```bash
#!/bin/bash

# Configuration
API_SECRET="your-api-secret"
API_SECRET_HASH=$(echo -n "$API_SECRET" | shasum | cut -d ' ' -f1)
BASE_URL="https://your-subdomain.diabeetech.net"

# Create treatment with proper timestamp
CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
MILLS=$(node -e "console.log(new Date('$CREATED_AT').getTime())")

curl -X POST "${BASE_URL}/api/v1/treatments" \
  -H "api-secret: ${API_SECRET_HASH}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "Meal Bolus",
    "insulin": 5.5,
    "carbs": 45,
    "created_at": "'"$CREATED_AT"'",
    "mills": '"$MILLS"',
    "enteredBy": "itiflux",
    "notes": "Lunch"
  }'
```

## Common Mistakes to Avoid

### ❌ Missing mills field
```json
{
  "eventType": "Meal Bolus",
  "insulin": 5,
  "created_at": "2025-07-25T12:00:00.000Z"
  // Missing mills - will cause rendering errors!
}
```

### ❌ Mills doesn't match created_at
```json
{
  "eventType": "Meal Bolus",
  "created_at": "2025-07-25T12:00:00.000Z",
  "mills": 1234567890000  // Wrong! Doesn't match created_at
}
```

### ❌ Invalid timestamp format
```json
{
  "eventType": "Note",
  "created_at": "2025-07-25 12:00:00",  // Wrong format!
  "mills": 1753444800000
}
```

### ❌ Missing eventType
```json
{
  "carbs": 30,
  "created_at": "2025-07-25T12:00:00.000Z",
  "mills": 1753444800000
  // Missing eventType!
}
```

## Validation Checklist

Before sending a treatment, verify:
- [ ] `eventType` is present and valid
- [ ] `created_at` is in ISO 8601 format with timezone
- [ ] `mills` is present and matches `created_at`
- [ ] Numeric values (insulin, carbs, glucose) are numbers, not strings
- [ ] `enteredBy` identifies your app/device

## Troubleshooting

### Treatment not appearing
1. Check API response for errors
2. Verify `mills` field is included
3. Ensure timestamp is not in the future
4. Confirm authentication is working

### Rendering errors (NaN)
1. Missing or null `mills` field
2. Invalid timestamp format
3. Non-numeric values in numeric fields

### API returns 500 error
1. Check all required fields are present
2. Verify JSON syntax is valid
3. Ensure proper authentication headers

## Best Practices

1. **Always include mills** - Calculate it from created_at
2. **Use consistent enteredBy** - Helps track treatment sources
3. **Add meaningful notes** - Provides context for treatments
4. **Validate before sending** - Check required fields
5. **Handle errors gracefully** - Log failures for debugging
6. **Use batch operations** - Send multiple treatments in array when possible

## Support

If treatments still don't appear correctly:
1. Check browser console for errors
2. Verify treatment data with GET request
3. Test with minimal treatment first
4. Check Nightscout logs for errors