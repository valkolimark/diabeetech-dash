# Nightscout Multi-Tenant Continuation Prompt

## Current Status (as of July 19, 2025)

I've been working on implementing a multi-tenant Nightscout system where users can register their own accounts with subdomains (username.diabeetech.net) and connect their Dexcom CGMs.

### What's Working:
1. **Multi-tenant infrastructure** - Each tenant has their own MongoDB database
2. **Registration system** - Users can create accounts at /register with:
   - Username becomes subdomain (e.g., onepanman.diabeetech.net)
   - Optional Dexcom credentials during signup
   - Encrypted credential storage
3. **Per-tenant Dexcom bridge** - Each tenant can have their own bridge instance
4. **Authentication** - Login/logout working with JWT tokens
5. **Profile creation** - Default Nightscout profile created during registration

### Current Issues to Fix:

1. **Profile Loading Error**: The system is looking for a profile named 'Default' but the profile was created with _id 'defaultProfile'. This is causing multiple plugin errors:
   ```
   Plugin error on setProperties(): cob TypeError: Cannot read properties of undefined (reading 'Default')
   ```

2. **Dexcom Data Not Showing**: Even though the bridge is configured, no Dexcom data is appearing on the graph. Need to verify:
   - Bridge is actually running for the tenant
   - Dexcom credentials are correct
   - Data is being fetched and stored

3. **Console Errors**: Several JavaScript errors that need addressing:
   - `force-no-redirect.js`: Cannot redefine property: location
   - `fix-profile-auth.js`: Strict mode error
   - Profile-related errors affecting COB, BWP, and Basal plugins

### User Account Details:
- **URL**: https://onepanman.diabeetech.net
- **Email**: mark@markmireles.com  
- **Password**: GodIsGood23!
- **Tenant ID**: 64215b38-cbb6-4581-8c35-2621ed9b6f33
- **Role**: admin
- **Dexcom credentials were provided during registration**

### Key Files Modified:
- `/lib/plugins/bridge-multitenant.js` - Multi-tenant bridge implementation
- `/lib/services/bridge-manager.js` - Manages bridge instances per tenant
- `/lib/api/tenants/register-enhanced.js` - Registration with Dexcom setup
- `/views/register.html` - Registration form UI
- `/lib/models/tenant-settings.js` - Encrypted credential storage

### Next Steps:
1. Fix the profile loading issue (change profile lookup from 'Default' to 'defaultProfile')
2. Verify Dexcom bridge is running and fetching data
3. Check MongoDB for any Dexcom entries in the tenant database
4. Fix the JavaScript console errors
5. Implement password reset functionality
6. Add UI for managing Dexcom settings after registration

### Environment:
- Heroku app: https://btech-d038118b5224.herokuapp.com
- MongoDB: Atlas cluster (nightscout-master)
- Multi-tenant mode enabled
- Base domain: diabeetech.net

### Useful Commands:
```bash
# Check Heroku logs
heroku logs --tail

# Check MongoDB for tenant data
heroku run node check-cgm-data.js

# Reset user password
node reset-user-password.js <email> <password>
```

## Request for Next Session:
Please help me fix the profile loading issue and get Dexcom data flowing into the system. The user has successfully registered and logged in, but the graph is not showing any CGM data and there are multiple console errors related to the profile not being found.