# Deploy API_SECRET Fix to Production

## Prerequisites
- Heroku CLI installed
- Access to the Heroku app
- Git repository with the latest changes

## Step-by-Step Deployment

### 1. Push the Code to Heroku
```bash
# Assuming your Heroku app is named 'your-app-name'
# Replace 'your-app-name' with your actual Heroku app name

# First, ensure you have the Heroku remote configured
heroku git:remote -a your-app-name

# Push the feature branch to Heroku's main branch
git push heroku feat/restrict-admin-to-tenants:main
```

### 2. Monitor the Deployment
```bash
# Watch the deployment logs
heroku logs --tail -a your-app-name
```

### 3. Run Migration for Existing Tenants
```bash
# Generate random API_SECRETs for all existing tenants
heroku run node scripts/add-tenant-api-secret.js --generate-random -a your-app-name
```

**IMPORTANT**: Save the output! This will show the generated API_SECRETs for each tenant.

### 4. Verify Specific Tenant (onepanman)
If you want to set a specific API_SECRET for onepanman instead of a random one:
```bash
heroku run node scripts/add-tenant-api-secret.js --subdomain=onepanman --secret="GodIsSoGood2Me23!" -a your-app-name
```

### 5. Test the API
```bash
# Test with onepanman's API_SECRET (SHA-1 hash)
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3" \
    -H "api-secret: 5a9baf88e82b6b171ed3e3a962ed7dc2c10eaad9" \
    -H "Accept: application/json"

# Or with plain text
curl -X GET "https://onepanman.diabeetech.net/api/v1/entries?count=3" \
    -H "api-secret: GodIsSoGood2Me23!" \
    -H "Accept: application/json"
```

### 6. Debug JWT Login Issue
If the login endpoint still returns 500:
```bash
# Check recent logs
heroku logs --tail -a your-app-name | grep -i error

# Check database connection
heroku run node -e "require('./lib/server/env')(); console.log('DB connection test')" -a your-app-name
```

### 7. Verify New Tenant Registration
Test that new tenants get API_SECRET automatically:
```bash
# This should return the API_SECRET in the response
curl -X POST "https://your-app-name.herokuapp.com/api/tenants/register-enhanced" \
    -H "Content-Type: application/json" \
    -d '{
      "tenantName": "Test Tenant",
      "subdomain": "testapi",
      "email": "test@example.com",
      "password": "SecurePassword123!",
      "displayName": "Test User"
    }'
```

## Rollback Instructions
If something goes wrong:
```bash
# List recent releases
heroku releases -a your-app-name

# Rollback to previous version
heroku rollback -a your-app-name
```

## Post-Deployment Checklist
- [ ] Code deployed successfully
- [ ] Migration script ran without errors
- [ ] API_SECRETs generated for all tenants
- [ ] API authentication works with API_SECRET
- [ ] New tenant registration includes API_SECRET
- [ ] Document generated API_SECRETs securely

## Troubleshooting

### If API still returns 401:
1. Verify tenant has API_SECRET: 
   ```bash
   heroku run node scripts/check-tenants.js -a your-app-name
   ```

2. Check if authentication middleware is loaded:
   ```bash
   heroku run node -e "console.log(require('./lib/middleware/auth'))" -a your-app-name
   ```

### If migration fails:
1. Check MongoDB connection
2. Verify tenant collection exists
3. Check for duplicate subdomains

## Security Notes
- Store the generated API_SECRETs securely
- Each tenant should only know their own API_SECRET
- The SHA-1 hash can be shared more freely than the plain text