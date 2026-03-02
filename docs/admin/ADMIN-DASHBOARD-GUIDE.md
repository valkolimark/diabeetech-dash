# Diabeetech Admin Dashboard - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Features](#features)
4. [API Reference](#api-reference)
5. [Development Guide](#development-guide)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)
8. [Security](#security)

## Overview

The Diabeetech Admin Dashboard is a comprehensive management interface for the multi-tenant Nightscout platform. It provides superadmin users with complete control over tenants, users, and system configuration.

### Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│  Admin API       │────▶│    MongoDB      │
│  (Material-UI)  │     │  (Express.js)    │     │  (Master DB)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
              [JWT Auth/Cookies]
```

## Getting Started

### Prerequisites
- Node.js 14-20
- MongoDB connection
- Heroku CLI (for deployment)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nightscout
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd admin-dashboard && npm install && cd ..
   ```

3. **Set environment variables**
   ```bash
   export FEATURE_ADMIN_DASHBOARD=true
   export FEATURE_USER_MGMT=true
   export FEATURE_TENANT_MGMT=true
   export JWT_SECRET=your-secret-key
   export MONGODB_URI=mongodb://localhost:27017/nightscout
   ```

4. **Build admin dashboard**
   ```bash
   npm run build:admin
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the dashboard**
   ```
   http://localhost:1337/admin
   ```

## Features

### 1. Dashboard Overview
The main dashboard provides:
- Total tenants and users count
- Active users in last 30 days
- System uptime and memory usage
- Enabled features list

### 2. Tenant Management
- **List Tenants**: View all tenants with pagination and search
- **Create Tenant**: Add new tenants with custom settings
- **Edit Tenant**: Update tenant configuration
- **Suspend/Activate**: Control tenant access
- **Delete Tenant**: Remove tenants (with confirmation)

### 3. User Management
- **List Users**: View all users across tenants
- **Create User**: Add new users with role assignment
- **Edit User**: Update user information
- **Reset Password**: Force password reset
- **Disable 2FA**: Remove two-factor authentication
- **Bulk Operations**: Perform actions on multiple users

### 4. Analytics (Coming Soon)
- Tenant usage statistics
- User activity tracking
- System performance metrics
- Growth trends

### 5. System Monitoring (Coming Soon)
- Real-time system health
- Resource utilization
- Error tracking
- Performance metrics

### 6. Audit Logging
- Track all admin actions
- Filter by user, action, or date
- Export audit logs
- Automatic cleanup policies

## API Reference

### Authentication

#### Login
```http
POST /api/v1/admin/auth/login
Content-Type: application/json

{
  "email": "superadmin@diabeetech.net",
  "password": "your-password"
}
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "email": "superadmin@diabeetech.net",
    "name": "Super Admin",
    "role": "superadmin"
  },
  "token": "jwt-token"
}
```

#### Get Current User
```http
GET /api/v1/admin/auth/user
Cookie: admin_token=jwt-token
```

#### Logout
```http
POST /api/v1/admin/auth/logout
Cookie: admin_token=jwt-token
```

### Tenants

#### List Tenants
```http
GET /api/v1/admin/tenants?page=1&limit=20&search=clinic
Cookie: admin_token=jwt-token
```

#### Get Tenant Details
```http
GET /api/v1/admin/tenants/:id
Cookie: admin_token=jwt-token
```

#### Create Tenant
```http
POST /api/v1/admin/tenants
Cookie: admin_token=jwt-token
Content-Type: application/json

{
  "name": "New Clinic",
  "subdomain": "newclinic",
  "contactEmail": "admin@newclinic.com",
  "settings": {
    "units": "mg/dl",
    "timeFormat": 12
  }
}
```

#### Update Tenant
```http
PUT /api/v1/admin/tenants/:id
Cookie: admin_token=jwt-token
Content-Type: application/json

{
  "name": "Updated Clinic Name",
  "settings": {
    "units": "mmol"
  }
}
```

#### Suspend Tenant
```http
POST /api/v1/admin/tenants/:id/suspend
Cookie: admin_token=jwt-token
Content-Type: application/json

{
  "reason": "Non-payment"
}
```

#### Activate Tenant
```http
POST /api/v1/admin/tenants/:id/activate
Cookie: admin_token=jwt-token
```

#### Delete Tenant
```http
DELETE /api/v1/admin/tenants/:id?confirm=true
Cookie: admin_token=jwt-token
```

### Users

#### List Users
```http
GET /api/v1/admin/users?page=1&limit=20&tenant=tenant-id&role=admin
Cookie: admin_token=jwt-token
```

#### Get User Details
```http
GET /api/v1/admin/users/:id
Cookie: admin_token=jwt-token
```

#### Create User
```http
POST /api/v1/admin/users
Cookie: admin_token=jwt-token
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "secure-password",
  "role": "admin",
  "tenant": "tenant-id"
}
```

#### Update User
```http
PUT /api/v1/admin/users/:id
Cookie: admin_token=jwt-token
Content-Type: application/json

{
  "name": "Updated Name",
  "role": "user"
}
```

#### Reset Password
```http
POST /api/v1/admin/users/:id/reset-password
Cookie: admin_token=jwt-token
Content-Type: application/json

{
  "password": "new-secure-password"
}
```

#### Disable 2FA
```http
POST /api/v1/admin/users/:id/disable-2fa
Cookie: admin_token=jwt-token
```

#### Delete User
```http
DELETE /api/v1/admin/users/:id
Cookie: admin_token=jwt-token
```

### System

#### Overview
```http
GET /api/v1/admin/overview
Cookie: admin_token=jwt-token
```

#### Features
```http
GET /api/v1/admin/features
Cookie: admin_token=jwt-token
```

#### Health Check
```http
GET /api/v1/admin/health
Cookie: admin_token=jwt-token
```

## Development Guide

### Project Structure
```
nightscout/
├── admin-dashboard/          # React admin dashboard
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── App.js          # Main app component
│   ├── webpack.config.js   # Webpack configuration
│   └── package.json        # Dashboard dependencies
├── lib/
│   ├── api/
│   │   └── admin/          # Admin API routes
│   │       ├── index.js    # Main router
│   │       ├── tenants.js  # Tenant endpoints
│   │       ├── users.js    # User endpoints
│   │       └── audit.js    # Audit endpoints
│   └── server/
│       └── app-multitenant.js  # Route configuration
├── config/
│   └── features.js         # Feature flags
└── views/
    └── admin-dashboard.html # Dashboard entry point
```

### Adding New Features

1. **Backend API Endpoint**
   ```javascript
   // lib/api/admin/newfeature.js
   const router = express.Router();
   
   router.get('/', async function(req, res) {
     // Implementation
   });
   
   module.exports = router;
   ```

2. **Mount in Admin Router**
   ```javascript
   // lib/api/admin/index.js
   const newFeature = require('./newfeature');
   router.use('/newfeature', newFeature);
   ```

3. **Frontend Component**
   ```javascript
   // admin-dashboard/src/pages/NewFeature.js
   import React from 'react';
   import { adminApi } from '../services/api';
   
   const NewFeature = () => {
     // Component implementation
   };
   ```

4. **Add Route**
   ```javascript
   // admin-dashboard/src/App.js
   import NewFeature from './pages/NewFeature';
   
   <Route path="/newfeature" component={NewFeature} />
   ```

### Testing

1. **API Testing**
   ```bash
   # Test login
   curl -X POST http://localhost:1337/api/v1/admin/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"superadmin@diabeetech.net","password":"password"}'
   ```

2. **Frontend Testing**
   ```bash
   cd admin-dashboard
   npm test
   ```

## Deployment

### Heroku Deployment

1. **Ensure environment variables are set**
   ```bash
   heroku config:set FEATURE_ADMIN_DASHBOARD=true
   heroku config:set FEATURE_USER_MGMT=true
   heroku config:set FEATURE_TENANT_MGMT=true
   heroku config:set JWT_SECRET=your-secret-key
   ```

2. **Deploy to Heroku**
   ```bash
   git push heroku main
   ```

3. **Create SuperAdmin User**
   ```bash
   heroku run node scripts/setup-superadmin.js
   ```

### Docker Deployment

1. **Build the image**
   ```bash
   docker build -t diabeetech-admin .
   ```

2. **Run the container**
   ```bash
   docker run -d \
     -p 1337:1337 \
     -e FEATURE_ADMIN_DASHBOARD=true \
     -e MONGODB_URI=mongodb://mongo:27017/nightscout \
     diabeetech-admin
   ```

## Troubleshooting

### Common Issues

#### 1. Admin Dashboard Not Loading
- Check if `FEATURE_ADMIN_DASHBOARD=true` is set
- Verify admin routes are placed before tenant resolver
- Check browser console for JavaScript errors

#### 2. Authentication Failing
- Ensure JWT_SECRET is set and consistent
- Check cookie settings for production (secure flag)
- Verify MongoDB connection

#### 3. API Endpoints Returning 500
- Check MongoDB connection string
- Verify database permissions
- Review server logs for detailed errors

#### 4. Build Failures
- Ensure Node.js version is 14-20
- Clear node_modules and reinstall
- Check for missing dependencies

### Debug Mode

Enable debug logging:
```bash
DEBUG=nightscout:* npm start
```

View Heroku logs:
```bash
heroku logs --tail
```

## Security

### Best Practices

1. **Strong JWT Secret**
   - Use a cryptographically secure random string
   - Rotate regularly
   - Never commit to version control

2. **HTTPS Only**
   - Always use HTTPS in production
   - Enable HSTS headers
   - Set secure cookie flag

3. **Access Control**
   - Only superadmin role can access dashboard
   - Regular audit of admin users
   - Implement session timeouts

4. **Database Security**
   - Use separate database users with minimal permissions
   - Enable MongoDB authentication
   - Regular backups

5. **Audit Logging**
   - Monitor all admin actions
   - Regular review of audit logs
   - Set up alerts for suspicious activity

### Security Headers

The application sets the following security headers:
- Strict-Transport-Security
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

### Rate Limiting

Consider implementing rate limiting for admin endpoints:
```javascript
const rateLimit = require('express-rate-limit');

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/v1/admin', adminLimiter);
```

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review server logs
3. Submit issues to the repository
4. Contact the development team

---

Last Updated: July 2025