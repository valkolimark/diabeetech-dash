# Registration API Documentation

## Overview

The Nightscout multi-tenant registration system provides both web-based and API-based registration with the following features:

- **Bot Protection**: hCaptcha integration to prevent automated registrations
- **Rate Limiting**: Configurable rate limits per IP address
- **Real-time Validation**: Subdomain availability checking
- **Settings Cloning**: New tenants inherit proven settings from a reference tenant
- **CGM Integration**: Optional Dexcom and CareLink setup during registration
- **Immediate Access**: JWT tokens provided for instant login after registration

## Configuration

### Environment Variables

```bash
# hCaptcha Configuration
HCAPTCHA_ENABLED=true                    # Enable/disable captcha
HCAPTCHA_SITE_KEY=your-site-key         # hCaptcha site key
HCAPTCHA_SECRET_KEY=your-secret-key     # hCaptcha secret key

# Rate Limiting
RATE_LIMIT_ENABLED=true                  # Enable/disable rate limiting
RATE_LIMIT_WINDOW_MS=900000             # Time window (15 minutes)
RATE_LIMIT_MAX_REQUESTS=5               # Max requests per window

# Reference Tenant
REFERENCE_TENANT=onepanman              # Tenant to clone settings from
```

## API Endpoints

### 1. User-Friendly Registration

**Endpoint**: `POST /api/register`

Creates a new tenant account with username as subdomain.

#### Request Body

```json
{
  "username": "johndoe",              // Required: becomes subdomain
  "email": "john@example.com",        // Required: admin email
  "password": "securepassword",       // Required: min 8 characters
  "displayName": "John Doe",          // Optional
  "units": "mg/dl",                   // Optional: mg/dl or mmol
  "h-captcha-response": "token",      // Required if captcha enabled
  "dexcom": {                         // Optional
    "username": "dexcom_user",
    "password": "dexcom_pass"
  },
  "carelink": {                       // Optional
    "username": "carelink_user",
    "password": "carelink_pass"
  }
}
```

#### Success Response (201)

```json
{
  "message": "Account created successfully",
  "tenant": {
    "tenantId": "tenant_abc123",
    "tenantName": "johndoe",
    "subdomain": "johndoe",
    "url": "https://johndoe.diabeetech.net"
  },
  "user": {
    "userId": "user_xyz789",
    "email": "john@example.com",
    "displayName": "John Doe",
    "roles": ["admin"]
  },
  "auth": {
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "expiresIn": "24h"
  }
}
```

#### Error Responses

- **400 Bad Request**: Invalid input data
- **409 Conflict**: Subdomain already exists
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### 2. Check Subdomain Availability

**Endpoint**: `GET /api/register/check-username/:username`

Checks if a username/subdomain is available.

#### Success Response (200)

```json
{
  "available": true,
  "subdomain": "johndoe",
  "url": "https://johndoe.diabeetech.net"
}
```

### 3. Administrative Registration

**Endpoint**: `POST /api/tenants/register`

More technical registration endpoint for administrative use.

#### Request Body

```json
{
  "tenantName": "John's Nightscout",   // Required
  "subdomain": "johndoe",               // Required
  "adminEmail": "john@example.com",     // Required
  "adminPassword": "securepassword",    // Required
  "contactEmail": "contact@example.com", // Optional
  "h-captcha-response": "token"         // Required if captcha enabled
}
```

## Web Registration

The web registration form is available at `/register` and includes:

- Real-time subdomain availability checking
- Visual feedback for validation
- Optional CGM integration sections
- Integrated hCaptcha widget (when enabled)
- Mobile-responsive design

## Security Features

### 1. Captcha Protection

When `HCAPTCHA_ENABLED=true`:
- Web form displays hCaptcha widget
- API requires `h-captcha-response` field
- Authenticated API requests (with Authorization header) bypass captcha

### 2. Rate Limiting

When `RATE_LIMIT_ENABLED=true`:
- Limits registration attempts per IP
- Default: 5 attempts per 15 minutes
- Returns 429 status with retry information

### 3. Input Validation

- Username: 3-63 characters, alphanumeric and hyphens
- Email: Valid email format
- Password: Minimum 8 characters
- Subdomain: Must be unique, DNS-compatible

## Settings Cloning

New tenants automatically inherit settings from the reference tenant including:

- **Profile**: Default basal rates, carb ratios, insulin sensitivity
- **Settings**: Alarms, thresholds, enabled features
- **Food Database**: Common food entries
- **Clock Configurations**: Display preferences

User-specific selections (like glucose units) override cloned settings.

## CGM Integration

### Dexcom Setup

If Dexcom credentials are provided:
1. Credentials are encrypted using AES-256-CBC
2. Bridge is configured with 5-minute polling interval
3. Connection is tested during registration

### CareLink Setup

If CareLink credentials are provided:
1. Credentials are encrypted
2. MiniMed Connect bridge is configured
3. 1-minute polling interval is set

## Testing

### Test with cURL

```bash
# Without captcha
curl -X POST http://localhost:1337/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123",
    "units": "mg/dl"
  }'

# Check availability
curl http://localhost:1337/api/register/check-username/testuser
```

### Test Keys

For development, use these hCaptcha test keys:
- Site Key: `10000000-ffff-ffff-ffff-000000000001`
- Secret Key: `0x0000000000000000000000000000000000000000`

These keys will always pass validation in test mode.

## Error Handling

The API returns consistent error responses:

```json
{
  "status": 400,
  "message": "Human-readable error message",
  "error": "Technical error details",
  "required": ["field1", "field2"]  // For missing fields
}
```

## Best Practices

1. **Always enable captcha in production** to prevent bot registrations
2. **Set appropriate rate limits** based on expected traffic
3. **Monitor registration logs** for suspicious patterns
4. **Keep reference tenant updated** with optimal settings
5. **Test CGM integrations** thoroughly before enabling

## Migration Notes

For existing Nightscout instances migrating to multi-tenant:
1. Existing data remains in original database
2. New tenants get isolated databases
3. Settings can be imported from existing instances
4. User accounts need to be recreated per tenant