# New Tenant Dexcom Bridge Requirements

## Overview
For a new tenant to successfully pull glucose data from Dexcom into Nightscout, several requirements must be met. This guide details all necessary steps.

## Prerequisites

### 1. Dexcom Account Requirements
- **Active Dexcom Share account** with follower access enabled
- **Valid credentials**: Username (email or username) and password
- **Recent glucose data**: Dexcom must be actively collecting data
- **Share enabled**: The Dexcom user must have sharing turned on in their app

### 2. Tenant Database Setup
The tenant must have:
- A dedicated database (e.g., `nightscout-tenant-[subdomain]`)
- Proper collections created: `settings`, `profile`, `entries`
- Valid tenant registration in master database

## Configuration Steps

### 1. Database Configuration
The bridge configuration must be stored in both `settings` and `profile` collections:

```javascript
{
  bridge: {
    userName: "dexcom_username",
    password: "dexcom_password",
    enable: true,
    interval: 150000  // 2.5 minutes in milliseconds
  }
}
```

### 2. Required Fields
- **userName**: Dexcom account username (email or username)
- **password**: Dexcom account password
- **enable**: Must be `true` to activate the bridge
- **interval**: Data fetch interval (recommended: 150000ms / 2.5 minutes)

### 3. Environment Variables (Global)
These should be set in Heroku:
```bash
ENABLE_BRIDGE=true
BRIDGE_SERVER=US  # or EU for European servers
```

## Setup Process for New Tenants

### Step 1: Register the Tenant
```bash
# Use the registration API or admin dashboard
# This creates the tenant database and initial structure
```

### Step 2: Configure Dexcom Bridge
Use the provided script to set up credentials:
```bash
# Get MongoDB URI
heroku config:get MONGODB_URI -a btech

# Update the script with new tenant info
# Edit tools/update-live-dexcom-credentials.js to add:
{
  database: 'nightscout-tenant-[subdomain]',
  username: 'dexcom_username',
  password: 'dexcom_password',
  name: 'Tenant Name'
}

# Run the update
node tools/update-live-dexcom-credentials.js "mongodb+srv://..."
```

### Step 3: Restart Application
```bash
heroku restart -a btech
```

### Step 4: Verify Data Collection
```bash
# Wait 2-5 minutes for first data
curl "https://[subdomain].diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
```

## Common Issues and Solutions

### No Data After Setup
1. **Check credentials**: Verify username/password are correct
2. **Check Dexcom Share**: Ensure sharing is enabled in Dexcom app
3. **Check logs**: `heroku logs --tail -a btech | grep -i bridge`
4. **Verify database**: Ensure settings were saved correctly

### Authentication Errors
- **Wrong credentials**: Double-check username and password
- **Account locked**: Try logging into Dexcom Share directly
- **Regional issues**: Ensure using correct server (US vs EU)

### Stale Data
- **Bridge stopped**: Restart the application
- **Dexcom issues**: Check if Dexcom app is updating
- **Network issues**: Check Heroku logs for connection errors

## Testing Tools

### Test Dexcom Credentials
```bash
node tools/test-dexcom-credentials.js
```

### Check Bridge Status
```bash
node tools/check-dexcom-bridge.js
```

### Monitor Bridge Activity
```bash
heroku logs --tail -a btech | grep -i bridge
```

## Security Notes
1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data when possible
3. **Rotate credentials** regularly
4. **Monitor access logs** for unauthorized attempts

## API Secret for All Tenants
All tenants use the same global API secret for data access:
```
secret=51a26cb40dcca4fd97601d00f8253129091c06ca
```

This is a SHA-1 hash of the master API_SECRET environment variable.