# Itiflux API Integration Guide

## Problem
Treatments created by the itiflux device were missing the `mills` field, causing rendering errors in the Nightscout web interface.

## Solution
When creating treatments via the API, include the `mills` field which is the epoch timestamp in milliseconds.

## Correct Treatment Format

### Example: Meal Bolus
```json
{
  "eventType": "Meal Bolus",
  "insulin": 5,
  "carbs": 45,
  "created_at": "2025-07-25T12:00:00.000Z",
  "mills": 1753444800000,
  "enteredBy": "itiflux",
  "notes": "Lunch"
}
```

### Example: Carb Correction
```json
{
  "eventType": "Carb Correction",
  "carbs": 15,
  "created_at": "2025-07-25T14:30:00.000Z",
  "mills": 1753453800000,
  "enteredBy": "itiflux",
  "notes": "Low treatment"
}
```

## Calculating the mills field

### JavaScript/Node.js
```javascript
const created_at = new Date().toISOString();
const mills = new Date(created_at).getTime();

const treatment = {
  eventType: "Meal Bolus",
  insulin: 5,
  carbs: 45,
  created_at: created_at,
  mills: mills,
  enteredBy: "itiflux"
};
```

### Python
```python
from datetime import datetime

created_at = datetime.utcnow().isoformat() + 'Z'
mills = int(datetime.fromisoformat(created_at.replace('Z', '+00:00')).timestamp() * 1000)

treatment = {
    "eventType": "Meal Bolus",
    "insulin": 5,
    "carbs": 45,
    "created_at": created_at,
    "mills": mills,
    "enteredBy": "itiflux"
}
```

### Alternative: Let Nightscout calculate mills
If you cannot modify your device code, you can try sending just the `created_at` field and see if Nightscout calculates `mills` automatically. However, based on the issues we saw, it's safer to include it.

## Testing Your Integration

After updating your device, test with:
```bash
curl -X POST "https://onepanman.diabeetech.net/api/v1/treatments" \
  -H "api-secret: 51a26cb40dcca4fd97601d00f8253129091c06ca" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "Note",
    "notes": "Test from itiflux",
    "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "mills": '$(node -e "console.log(Date.now())")',
    "enteredBy": "itiflux"
  }'
```

## Important Notes
1. Always include the `mills` field to ensure proper rendering
2. Use consistent casing for `enteredBy` (recommend "itiflux" or "Itiflux")
3. Ensure `created_at` is in ISO 8601 format with timezone
4. The `mills` value should match the `created_at` timestamp