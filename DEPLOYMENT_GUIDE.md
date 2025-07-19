# Nightscout Multi-Tenant Deployment Guide

This guide will help you deploy the multi-tenant Nightscout to Heroku with MongoDB Atlas.

## Prerequisites

- Heroku account with app created (`btech`)
- MongoDB Atlas M10 cluster (`nightscout-multitenant`)
- GoDaddy domain (`diabeetech.com`)
- Gmail account for email notifications
- Git installed locally

## Step 1: MongoDB Atlas Setup

1. **Get your connection string:**
   - Go to MongoDB Atlas dashboard
   - Click on your `nightscout-multitenant` cluster
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - It should look like: `mongodb+srv://username:password@nightscout-multitenant.xxxxx.mongodb.net/nightscout_master?retryWrites=true&w=majority`

2. **Configure network access:**
   - Go to Network Access in MongoDB Atlas
   - Add `0.0.0.0/0` to allow connections from anywhere (required for Heroku)

3. **Create database user:**
   - Go to Database Access
   - Create a new user with readWrite permissions
   - Save the username and password

## Step 2: Gmail App Password Setup

1. **Enable 2-factor authentication** on your Gmail account (required for app passwords)

2. **Generate app password:**
   - Go to https://myaccount.google.com/security
   - Click on "2-Step Verification"
   - Scroll down to "App passwords"
   - Generate a new app password for "Mail"
   - Save this 16-character password

## Step 3: Generate JWT Secret

Run this command to generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Save the output - you'll need it for the environment variables.

## Step 4: Configure Heroku

1. **Set environment variables:**

```bash
# Clone your repository first
git clone <your-repo-url>
cd nightscout

# Login to Heroku
heroku login

# Connect to your app
heroku git:remote -a btech

# Set all environment variables
heroku config:set MULTI_TENANT_ENABLED=true
heroku config:set MASTER_MONGODB_URI="<your-mongodb-connection-string>"
heroku config:set JWT_SECRET="<your-generated-jwt-secret>"
heroku config:set BASE_DOMAIN=diabeetech.com
heroku config:set EMAIL_HOST=smtp.gmail.com
heroku config:set EMAIL_PORT=587
heroku config:set EMAIL_SECURE=false
heroku config:set EMAIL_USER="<your-gmail-address>"
heroku config:set EMAIL_PASS="<your-gmail-app-password>"
heroku config:set EMAIL_FROM=noreply@diabeetech.com
heroku config:set NODE_ENV=production
heroku config:set DISPLAY_UNITS=mg/dl
heroku config:set TIME_FORMAT=12
heroku config:set THEME=colors
heroku config:set ENABLE="careportal iob cob bwp cage sage iage treatmentnotify basal dbsize"
heroku config:set USE_NPM_INSTALL=true
```

2. **Deploy to Heroku:**

```bash
# Commit any changes
git add .
git commit -m "Configure multi-tenant deployment"

# Deploy to Heroku
git push heroku main
```

3. **Scale the dyno:**

```bash
heroku ps:scale web=1:standard-1x
```

## Step 5: Configure GoDaddy DNS

1. **Login to GoDaddy** and go to your domain management

2. **Add DNS records:**

   **A. CNAME for base domain:**
   - Type: CNAME
   - Name: @
   - Value: btech-d038118b5224.herokuapp.com
   - TTL: 600

   **B. Wildcard CNAME for subdomains:**
   - Type: CNAME
   - Name: *
   - Value: btech-d038118b5224.herokuapp.com
   - TTL: 600

3. **Wait for DNS propagation** (usually 5-30 minutes)

## Step 6: Configure Heroku Custom Domains

```bash
# Add your domain to Heroku
heroku domains:add diabeetech.com
heroku domains:add *.diabeetech.com

# Enable automatic SSL certificates
heroku certs:auto:enable
```

## Step 7: Verify Deployment

1. **Check application logs:**
```bash
heroku logs --tail
```

2. **Access your tenants:**
   - Clinic 1: https://clinic1.diabeetech.com
   - Clinic 2: https://clinic2.diabeetech.com

3. **Check your email** (mark@p5400.com) for the admin credentials

## Step 8: Post-Deployment Tasks

1. **Login to each tenant** with the provided credentials
2. **Change admin passwords** immediately
3. **Create additional users** as needed
4. **Configure CGM data sources** for each tenant

## Troubleshooting

### MongoDB Connection Issues
- Verify your connection string includes `/nightscout_master` as the database name
- Check that your MongoDB user has proper permissions
- Ensure IP whitelist includes 0.0.0.0/0

### DNS Issues
- Use `nslookup clinic1.diabeetech.com` to verify DNS resolution
- Clear your browser cache if subdomains aren't working
- Wait up to 48 hours for full DNS propagation

### Email Issues
- Verify your Gmail app password is correct
- Check that 2-factor authentication is enabled on Gmail
- Look for "Less secure app access" settings if needed

### Heroku Issues
- Check logs: `heroku logs --tail`
- Restart the app: `heroku restart`
- Check dyno status: `heroku ps`

## Security Checklist

- [ ] Changed all default admin passwords
- [ ] JWT_SECRET is at least 32 characters
- [ ] MongoDB connection uses SSL
- [ ] HTTPS is enforced on all domains
- [ ] Email passwords are app-specific, not your main Gmail password

## Support

For issues specific to multi-tenant functionality:
- Check logs in Papertrail (automatically configured)
- MongoDB Atlas monitoring dashboard
- Heroku metrics dashboard

## Next Steps

1. **Configure monitoring:**
   - Set up MongoDB Atlas alerts
   - Configure Heroku alerts
   - Set up uptime monitoring for your domains

2. **Backup strategy:**
   - Enable MongoDB Atlas automated backups
   - Consider setting up manual backup scripts

3. **Scaling:**
   - Monitor usage and scale dynos as needed
   - Consider upgrading MongoDB cluster for more tenants