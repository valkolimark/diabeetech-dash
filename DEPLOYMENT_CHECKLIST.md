# Nightscout Multi-Tenant Deployment Checklist

## Pre-Deployment

- [ ] MongoDB Atlas M10 cluster is ready (`nightscout-multitenant`)
- [ ] MongoDB network access allows `0.0.0.0/0`
- [ ] MongoDB database user created with readWrite permissions
- [ ] MongoDB connection string copied
- [ ] Heroku app created (`btech`)
- [ ] Heroku CLI installed locally
- [ ] Gmail 2-factor authentication enabled
- [ ] Gmail app password generated
- [ ] GoDaddy domain ready (`diabeetech.com`)

## Deployment Steps

### 1. Quick Deploy (Recommended)
```bash
cd /path/to/nightscout
./scripts/deploy-to-heroku.sh
```

### 2. Manual Deploy
If you prefer to deploy manually:

```bash
# Set Heroku remote
heroku git:remote -a btech

# Generate JWT Secret
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Set environment variables (replace with your values)
heroku config:set \
  MULTI_TENANT_ENABLED=true \
  MASTER_MONGODB_URI="mongodb+srv://user:pass@nightscout-multitenant.xxxxx.mongodb.net/nightscout_master?retryWrites=true&w=majority" \
  JWT_SECRET="$JWT_SECRET" \
  BASE_DOMAIN=diabeetech.com \
  EMAIL_HOST=smtp.gmail.com \
  EMAIL_PORT=587 \
  EMAIL_SECURE=false \
  EMAIL_USER="your-gmail@gmail.com" \
  EMAIL_PASS="your-16-char-app-password" \
  EMAIL_FROM=noreply@diabeetech.com

# Deploy
git push heroku main

# Scale dyno
heroku ps:scale web=1:standard-1x

# Add domains
heroku domains:add diabeetech.com
heroku domains:add "*.diabeetech.com"

# Enable SSL
heroku certs:auto:enable
```

## Post-Deployment

### Configure GoDaddy DNS

1. Login to GoDaddy Domain Management
2. Add these DNS records:

| Type  | Name | Value | TTL |
|-------|------|-------|-----|
| CNAME | @    | btech-d038118b5224.herokuapp.com | 600 |
| CNAME | *    | btech-d038118b5224.herokuapp.com | 600 |

3. Delete any conflicting A records for @ or *

### Verify Deployment

- [ ] Check Heroku logs: `heroku logs --tail`
- [ ] MongoDB connection successful in logs
- [ ] Post-deploy script completed
- [ ] Email sent to mark@p5400.com with credentials
- [ ] DNS propagation complete (test with `nslookup clinic1.diabeetech.com`)
- [ ] Access https://clinic1.diabeetech.com
- [ ] Access https://clinic2.diabeetech.com
- [ ] Login successful with emailed credentials

### Security Tasks

- [ ] Change admin passwords for both tenants
- [ ] Verify HTTPS is working on all domains
- [ ] Test password reset functionality
- [ ] Remove test data if any

### Optional Configuration

- [ ] Set up additional monitoring (Pingdom, UptimeRobot)
- [ ] Configure MongoDB Atlas alerts
- [ ] Set up backup automation
- [ ] Configure Papertrail alerts in Heroku
- [ ] Add more tenants as needed

## Troubleshooting Commands

```bash
# View logs
heroku logs --tail

# Restart app
heroku restart

# Check app status
heroku ps

# Run console
heroku run node

# Check environment variables
heroku config

# MongoDB connection test
heroku run node -e "require('mongodb').MongoClient.connect(process.env.MASTER_MONGODB_URI, (err, client) => { console.log(err ? 'Failed' : 'Connected'); process.exit(); })"
```

## Support Information

- **MongoDB Issues**: Check Atlas dashboard and logs
- **DNS Issues**: Wait up to 48 hours for propagation
- **SSL Issues**: Run `heroku certs:auto:refresh`
- **App Crashes**: Check `heroku logs --tail` for errors

## Initial Tenant Credentials

After deployment, check email at mark@p5400.com for:
- Clinic 1 admin credentials
- Clinic 2 admin credentials

Access URLs:
- Clinic 1: https://clinic1.diabeetech.com
- Clinic 2: https://clinic2.diabeetech.com