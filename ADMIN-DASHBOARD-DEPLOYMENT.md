# Diabeetech Admin Dashboard Deployment Guide

This guide covers the setup and deployment of the Diabeetech Admin Dashboard for the multi-tenant Nightscout system.

## 🚀 Quick Start

### 1. Enable Feature Flags

Add these to your `.env` file:

```bash
# Enable admin dashboard
FEATURE_ADMIN_DASHBOARD=true
FEATURE_USER_MGMT=true
FEATURE_TENANT_MGMT=true
FEATURE_MONITORING=true
FEATURE_AUDIT_LOGS=true
```

### 2. Create SuperAdmin User

Run the setup script with default credentials:

```bash
node setup-superadmin.js --default
```

Or run interactively to set custom credentials:

```bash
node setup-superadmin.js
```

Default credentials:
- Email: `superadmin@diabeetech.net`
- Password: `Db#SuperAdmin2025!Secure`

### 3. Build Admin Dashboard

```bash
cd admin-dashboard
npm install
npm run build
```

### 4. Start the Application

```bash
# From root directory
npm start
```

### 5. Access Admin Dashboard

Navigate to: `http://localhost:1337/admin`

## 📦 Detailed Installation

### Prerequisites

- Node.js 14+ 
- MongoDB 4.4+
- npm or yarn

### Step 1: Install Dependencies

```bash
# Install main app dependencies
npm install

# Install admin dashboard dependencies
cd admin-dashboard
npm install
cd ..
```

### Step 2: Configure Environment

Create or update `.env` file:

```bash
# MongoDB connection
MONGODB_URI=mongodb://localhost:27017/nightscout

# Admin features
FEATURE_ADMIN_DASHBOARD=true
FEATURE_USER_MGMT=true
FEATURE_TENANT_MGMT=true
FEATURE_MONITORING=true
FEATURE_BILLING=false
FEATURE_AUDIT_LOGS=true
FEATURE_2FA=true

# Security
FEATURE_IP_WHITELIST=false
FEATURE_SESSION_MGMT=true

# Developer tools
FEATURE_DEV_TOOLS=false
FEATURE_API_PLAYGROUND=false
```

### Step 3: Database Setup

Ensure MongoDB is running and create required indexes:

```bash
# The setup script will create necessary collections
node setup-superadmin.js
```

### Step 4: Build Assets

Development build:
```bash
cd admin-dashboard
npm run build:dev
```

Production build:
```bash
cd admin-dashboard
npm run build
```

Watch mode (for development):
```bash
cd admin-dashboard
npm run watch
```

### Step 5: Run Application

Development:
```bash
npm run dev
```

Production:
```bash
NODE_ENV=production npm start
```

## 🔧 Configuration Options

### Feature Flags

Control which features are available:

| Flag | Description | Default |
|------|-------------|---------|
| FEATURE_ADMIN_DASHBOARD | Main admin dashboard toggle | false |
| FEATURE_USER_MGMT | User management features | false |
| FEATURE_TENANT_MGMT | Tenant management features | false |
| FEATURE_MONITORING | System monitoring | false |
| FEATURE_BILLING | Billing features (future) | false |
| FEATURE_AUDIT_LOGS | Audit logging | false |
| FEATURE_2FA | Two-factor authentication | false |

### Gradual Rollout

Enable features for specific users or tenants:

```bash
# Percentage rollout (0-100)
FEATURE_ROLLOUT_PERCENT=25

# Beta users (comma-separated emails)
FEATURE_BETA_USERS=user1@example.com,user2@example.com

# Test tenants (comma-separated IDs)
FEATURE_TEST_TENANTS=tenant-id-1,tenant-id-2
```

## 🚀 Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
# Dockerfile example
FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY admin-dashboard/package*.json ./admin-dashboard/

# Install dependencies
RUN npm ci --only=production
RUN cd admin-dashboard && npm ci --only=production

# Copy application files
COPY . .

# Build admin dashboard
RUN cd admin-dashboard && npm run build

# Expose port
EXPOSE 1337

# Start application
CMD ["node", "server.js"]
```

### Heroku Deployment

1. Enable buildpacks:
```bash
heroku buildpacks:add heroku/nodejs
```

2. Add build script to `package.json`:
```json
{
  "scripts": {
    "heroku-postbuild": "cd admin-dashboard && npm install && npm run build"
  }
}
```

3. Deploy:
```bash
git push heroku main
```

## 🔒 Security Considerations

### 1. Change Default Credentials

After first login, immediately:
- Change the superadmin password
- Enable 2FA for the superadmin account

### 2. HTTPS Configuration

Always use HTTPS in production:

```javascript
// In your reverse proxy (nginx example)
server {
    listen 443 ssl;
    server_name admin.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:1337;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. IP Whitelisting

Enable IP whitelisting for admin access:

```bash
FEATURE_IP_WHITELIST=true
ADMIN_IP_WHITELIST=192.168.1.0/24,10.0.0.0/8
```

### 4. Session Security

Configure session timeout:

```bash
SESSION_TIMEOUT=3600000 # 1 hour in milliseconds
SESSION_EXTEND_ON_ACTIVITY=true
```

## 📊 Monitoring

### Health Check Endpoint

Monitor the admin API health:

```bash
curl http://localhost:1337/api/v1/admin/health
```

### Logs

Admin actions are logged to the `admin_audit` collection.

View recent logs:
```bash
# Using MongoDB shell
db.admin_audit.find().sort({timestamp: -1}).limit(10)
```

## 🐛 Troubleshooting

### Dashboard Not Loading

1. Check feature flags are enabled
2. Verify build completed successfully
3. Check browser console for errors
4. Ensure user has superadmin role

### Authentication Issues

1. Verify cookies are enabled
2. Check CORS settings if using different domains
3. Ensure session middleware is configured

### Build Failures

1. Clear node_modules and reinstall:
```bash
rm -rf node_modules admin-dashboard/node_modules
npm install
cd admin-dashboard && npm install
```

2. Check Node.js version (14+ required)
3. Ensure enough disk space for build

### Performance Issues

1. Enable production mode
2. Use CDN for static assets
3. Enable gzip compression
4. Implement caching headers

## 🔄 Updates and Maintenance

### Updating the Dashboard

1. Pull latest changes
2. Install new dependencies
3. Rebuild dashboard
4. Restart application

```bash
git pull
npm install
cd admin-dashboard && npm install && npm run build
pm2 restart nightscout
```

### Database Maintenance

Run maintenance tasks periodically:

```bash
# Clean old audit logs (keep 90 days)
curl -X DELETE http://localhost:1337/api/v1/admin/audit/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"retentionDays": 90}'
```

## 📚 Additional Resources

- API Documentation: `/docs/API-REFERENCE.md`
- Rollback Procedures: `/ROLLBACK-PROCEDURE.md`
- Session Documentation: `/NIGHTSCOUT-MULTITENANT-SESSION.md`

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs in `admin_audit` collection
3. Enable debug mode: `DEBUG=nightscout:*`

---

Remember to always test changes in a staging environment before deploying to production!