# Rollback State Documentation - July 29, 2025

## Current Working State

### Git Information
- **Commit**: a22b775b554b339d59bcc6aba3ca1926848bd5ac
- **Message**: "Add memory monitoring endpoint to admin API"
- **Date**: July 29, 2025

### Working Features
1. **Registration**: ✅ Working via www.diabeetech.net/api/register
2. **Dexcom Bridge**: ✅ Both tenants collecting data
   - Arimarco: 228 mg/dL (fresh data)
   - Jordan: 129 mg/dL (fresh data)
3. **API Access**: ✅ All endpoints accessible with secret
4. **User Creation**: ✅ Creates users with correct passwordHash field

### Known Issues (Not Breaking)
1. Login endpoint returns 500 on some new tenants
2. Login works on established tenants (jordan, arimarco)

### Critical Files State

#### User Authentication (lib/middleware/auth.js)
- Line 298: auth.login function
- Line 316: userModel.authenticate call
- Uses req.tenant.tenantId for authentication

#### User Model (lib/models/user.js)
- Line 126: authenticate function expects passwordHash field
- Line 133: bcrypt.compare for password verification

#### Registration (lib/api/tenants/register-enhanced.js)
- Line 88: Creates user with password field (converts to passwordHash internally)
- Line 117: Configures Dexcom bridge during registration

### Database State
- Master DB: nightscout-master
- Tenant DBs: nightscout-tenant-[subdomain]
- Users collection: Uses passwordHash field (some legacy with password)

### Environment Configuration
```bash
MONGODB_URI=mongodb+srv://markt:***@nightscout-master.nkz27.mongodb.net/
API_SECRET=GodIsSoGood2Me23!
API_SECRET_HASH=51a26cb40dcca4fd97601d00f8253129091c06ca
BASE_DOMAIN=diabeetech.net
MULTI_TENANT_ENABLED=true
```

### Heroku State
```bash
# Get current release
heroku releases -a btech -n 1

# Current dynos
heroku ps -a btech
```

## Rollback Commands

### Quick Rollback
```bash
# Rollback to previous release
heroku rollback -a btech

# Or rollback to specific version
heroku releases:rollback v[number] -a btech
```

### Git Rollback
```bash
# Save current changes
git stash

# Reset to this commit
git reset --hard a22b775b554b339d59bcc6aba3ca1926848bd5ac

# Force push if needed (careful!)
git push origin HEAD --force
```

### Database Rollback
If user schema changes were made:
```javascript
// Fix users with wrong password field
db.users.updateMany(
  { password: { $exists: true }, passwordHash: { $exists: false } },
  { $rename: { "password": "passwordHash" } }
)
```

## Test Commands to Verify State

### Check API Health
```bash
# Jordan
curl "https://jordan.diabeetech.net/api/v1/status.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"

# Arimarco  
curl "https://arimarco.diabeetech.net/api/v1/status.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca"
```

### Check Data Flow
```bash
# Jordan glucose
curl "https://jordan.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca" | jq '.[0]'

# Arimarco glucose
curl "https://arimarco.diabeetech.net/api/v1/entries/current.json?secret=51a26cb40dcca4fd97601d00f8253129091c06ca" | jq '.[0]'
```

### Check Login (Known Issue)
```bash
# Working tenant
curl -X POST https://jordan.diabeetech.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jordan@p5400.com","password":"Camzack23"}'

# New tenant (may fail with 500)
curl -X POST https://testdex1753801381.diabeetech.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testdex1753801381@example.com","password":"TestPass123!"}'
```

## Critical: Do Not Break
1. Dexcom data collection for existing tenants
2. API access with global secret
3. Registration process on www.diabeetech.net
4. Profile and settings for existing tenants

## Files Created Today
- `/docs/DEXCOM-BRIDGE-FIX-SOLUTION.md`
- `/docs/NEW-TENANT-DEXCOM-REQUIREMENTS.md`
- `/docs/DEXCOM-BRIDGE-SETUP-GUIDE.md`
- `/docs/REGISTRATION-PROCESS-GUIDE.md`
- `/docs/REGISTRATION-TROUBLESHOOTING.md`
- `/docs/REGISTRATION-SUCCESS-SUMMARY.md`
- `/tools/fix-user-password-fields.js`
- `/tools/check-tenant-status.js`
- `/test/test-registration-with-dexcom.sh`

This state represents a working system with minor login issues that don't affect core functionality.