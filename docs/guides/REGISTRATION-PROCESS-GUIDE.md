# Registration Process Guide for Diabeetech

## Overview
This guide documents the complete registration process for new tenants on Diabeetech, including all requirements, common issues, and troubleshooting steps.

## Registration Flow

### 1. User Registration Page
- **URL**: https://diabeetech.net/register
- **API Endpoint**: POST `/api/register` (routes to `/api/tenants/register-enhanced`)

### 2. Required Information
- **Username**: 3-63 characters, alphanumeric and hyphens only
- **Email**: Valid email address
- **Password**: Minimum 8 characters
- **Display Name**: Optional
- **Units**: mg/dl or mmol/L
- **Dexcom Credentials**: Optional (username/password)
- **CareLink Credentials**: Optional (username/password)

### 3. What Happens During Registration

#### Step 1: Tenant Creation
```javascript
// Creates tenant record in master database
{
  tenantName: "User's Nightscout",
  subdomain: "username",
  contactEmail: "user@email.com",
  databaseName: "nightscout-tenant-username",
  apiSecret: "[generated]",
  apiSecretHash: "[SHA-1 hash]"
}
```

#### Step 2: Database Creation
- Creates dedicated MongoDB database for tenant
- Initializes collections: `entries`, `treatments`, `devicestatus`, `profile`, `settings`

#### Step 3: User Creation
```javascript
// Creates admin user in master database
{
  userId: "[UUID]",
  tenantId: "[tenant ID]",
  email: "user@email.com",
  passwordHash: "[bcrypt hash]",  // CRITICAL: Must be 'passwordHash' not 'password'
  role: "admin",
  isActive: true
}
```

#### Step 4: Settings Configuration
- Clones settings from reference tenant (onepanman)
- Creates default Nightscout profile
- Configures Dexcom bridge if credentials provided
- Enables data collection plugins

#### Step 5: Bridge Initialization
If Dexcom credentials provided:
```javascript
{
  bridge: {
    enable: true,
    userName: "dexcom_username",
    password: "dexcom_password",
    interval: 150000  // 2.5 minutes
  }
}
```

## Critical Requirements

### 1. Password Field Naming
**ISSUE**: User password MUST be stored as `passwordHash` not `password`
- The user model expects `passwordHash` field
- Authentication will fail if stored as `password`
- Use bcrypt to hash passwords before storing

### 2. API Secret Configuration
All tenants share a global API secret hash:
```
secret=51a26cb40dcca4fd97601d00f8253129091c06ca
```
This is generated from the master `API_SECRET` environment variable.

### 3. Dexcom Bridge Requirements
For successful data collection:
- Valid Dexcom Share credentials
- Share must be enabled in Dexcom app
- Bridge configuration in both `settings` and `profile` collections
- Application restart after configuration

### 4. Database Structure
Each tenant needs:
- Dedicated database: `nightscout-tenant-[subdomain]` or `nightscout_[id]`
- Proper collections with correct schemas
- Settings document with bridge configuration
- Profile document with Nightscout settings

## Common Issues and Solutions

### Issue 1: Login Fails After Registration
**Symptom**: "Illegal arguments: string, undefined" error

**Cause**: Password stored as `password` instead of `passwordHash`

**Solution**:
```bash
node tools/fix-user-password-fields.js "mongodb+srv://..."
```

### Issue 2: No Glucose Data
**Symptom**: Empty entries array, no data collection

**Cause**: Bridge not configured or credentials incorrect

**Solution**:
1. Verify Dexcom credentials
2. Update bridge configuration
3. Restart application
```bash
node tools/update-live-dexcom-credentials.js "mongodb+srv://..."
heroku restart -a btech
```

### Issue 3: Registration Fails
**Symptom**: 500 error during registration

**Possible Causes**:
- Username already taken
- Database connection issues
- Invalid data format

**Solution**: Check logs and verify all fields

## Testing Registration

### 1. Test Username Availability
```bash
curl https://diabeetech.net/api/register/check-username/testuser
```

### 2. Test Registration
```bash
curl -X POST https://diabeetech.net/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPass123!",
    "units": "mg/dl",
    "dexcom": {
      "username": "dexcom_user",
      "password": "dexcom_pass"
    }
  }'
```

### 3. Verify Account
```bash
# Test login
curl -X POST https://testuser.diabeetech.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'

# Check data
curl "https://testuser.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
```

## Maintenance Scripts

### Fix Password Fields
```bash
# Fix all users with incorrect password field
node tools/fix-user-password-fields.js "mongodb+srv://..."
```

### Update Dexcom Credentials
```bash
# Update credentials for specific tenants
node tools/update-live-dexcom-credentials.js "mongodb+srv://..."
```

### Check User Status
```bash
# Check specific user
node tools/check-jordan-user.js "mongodb+srv://..."
```

## Best Practices

1. **Always hash passwords** using bcrypt before storing
2. **Use correct field names** (`passwordHash` not `password`)
3. **Validate all input** before creating accounts
4. **Test credentials** before storing (especially Dexcom)
5. **Monitor registration logs** for errors
6. **Restart app** after bridge configuration changes

## Environment Variables
Required for registration to work:
```bash
MONGODB_URI=mongodb+srv://...
API_SECRET=your_secret
JWT_SECRET=your_jwt_secret
BASE_DOMAIN=diabeetech.net
ENABLE_BRIDGE=true
REFERENCE_TENANT=onepanman
```

## Security Considerations

1. **Password Storage**: Always use bcrypt with salt rounds >= 10
2. **API Secrets**: Never expose the master API_SECRET
3. **Dexcom Credentials**: Encrypt in database if possible
4. **Rate Limiting**: Enable to prevent registration spam
5. **CAPTCHA**: Enable hCaptcha for production

## Monitoring

### Check Registration Success Rate
```sql
db.admin_audit.find({ action: "tenant.create" }).sort({ timestamp: -1 }).limit(10)
```

### Check Failed Logins
```sql
db.admin_audit.find({ action: "auth.login.failed" }).sort({ timestamp: -1 }).limit(10)
```

### Monitor Bridge Status
```bash
heroku logs --tail -a btech | grep -i "bridge"
```

## Support Checklist

When a user reports registration/login issues:

1. ✓ Check if user exists in master database
2. ✓ Verify password field is `passwordHash`
3. ✓ Check tenant database was created
4. ✓ Verify bridge configuration if using Dexcom
5. ✓ Test login with their credentials
6. ✓ Check for recent errors in logs
7. ✓ Ensure app was restarted after changes