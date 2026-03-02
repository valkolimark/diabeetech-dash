# Nightscout Multi-Tenant Documentation

## Overview

This fork of Nightscout adds multi-tenant capabilities, allowing a single Nightscout installation to serve multiple organizations or users with complete data isolation. Each tenant has their own subdomain, users, and isolated database.

## Features

- **Complete Data Isolation**: Each tenant has a separate MongoDB database
- **Subdomain-based Routing**: Access tenants via subdomain (e.g., clinic1.nightscout.com)
- **User Authentication**: JWT-based authentication with role-based access control
- **Tenant Management**: Create and manage multiple tenants
- **User Management**: Admin users can manage users within their tenant
- **Backward Compatibility**: Supports existing Nightscout API with API_SECRET

## Architecture

### Database Structure

```
Master Database (nightscout-master):
├── tenants (collection)
│   ├── tenantId
│   ├── subdomain
│   ├── databaseName
│   └── settings
└── users (collection)
    ├── userId
    ├── tenantId
    ├── email
    └── role

Tenant Databases (nightscout-tenant-<subdomain>):
├── entries
├── treatments
├── devicestatus
├── profile
├── food
├── activity
└── settings
```

### User Roles

1. **Admin**: Full access to tenant settings and user management
2. **Caregiver**: Can view and add CGM data
3. **Viewer**: Read-only access to CGM data

## Installation

### Prerequisites

- Node.js 14+ LTS
- MongoDB 4.4+
- Domain with wildcard subdomain support (for production)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/nightscout-multitenant.git
   cd nightscout-multitenant
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.multitenant.example .env
   # Edit .env with your settings
   ```

3. **Run migration (if you have existing data)**
   ```bash
   node scripts/migrate-to-multitenant.js
   ```

4. **Start the server**
   ```bash
   npm start
   ```

## Configuration

### Required Environment Variables

```bash
# Enable multi-tenant mode
MULTI_TENANT_ENABLED=true

# Master database URI
MASTER_MONGODB_URI=mongodb://localhost:27017/nightscout-master

# JWT secret for authentication
JWT_SECRET=your-secret-key-min-32-chars

# Base domain for subdomains
BASE_DOMAIN=nightscout.com
```

### Optional Environment Variables

```bash
# Default tenant for single-tenant compatibility
DEFAULT_TENANT=demo

# JWT token expiration
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Enable API_SECRET fallback
ENABLE_API_SECRET_FALLBACK=true
```

## API Documentation

### Authentication Endpoints

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "tokenType": "Bearer",
  "expiresIn": "24h"
}
```

#### Refresh Token
```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-token"
}
```

#### Get Profile
```
GET /api/auth/profile
Authorization: Bearer <token>
```

### Tenant Management

#### Register New Tenant
```
POST /api/tenants/register
Content-Type: application/json

{
  "tenantName": "My Clinic",
  "subdomain": "myclinic",
  "adminEmail": "admin@myclinic.com",
  "adminPassword": "secure-password"
}
```

#### Get Current Tenant Info
```
GET /api/tenants/current
Authorization: Bearer <token>
```

#### List Tenant Users (Admin only)
```
GET /api/tenants/users
Authorization: Bearer <token>
```

#### Create User (Admin only)
```
POST /api/tenants/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "role": "viewer"
}
```

### Using Existing Nightscout APIs

All existing Nightscout APIs work with multi-tenant by:

1. **Including tenant context via subdomain**
   ```
   https://myclinic.nightscout.com/api/v1/entries
   ```

2. **Authenticating with JWT**
   ```
   Authorization: Bearer <jwt-token>
   ```

3. **Or using API_SECRET (if enabled)**
   ```
   https://myclinic.nightscout.com/api/v1/entries?secret=your-api-secret
   ```

## Deployment

### Heroku Deployment

1. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Add MongoDB Atlas**
   ```bash
   heroku addons:create mongolab:sandbox
   ```

3. **Configure environment**
   ```bash
   heroku config:set MULTI_TENANT_ENABLED=true
   heroku config:set MASTER_MONGODB_URI=your-atlas-uri
   heroku config:set JWT_SECRET=your-secret
   heroku config:set BASE_DOMAIN=your-app.herokuapp.com
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **Configure custom domain with wildcard**
   - Add wildcard domain in Heroku settings
   - Configure DNS with wildcard CNAME

### Docker Deployment

```dockerfile
FROM node:14-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV MULTI_TENANT_ENABLED=true
EXPOSE 1337

CMD ["node", "server.js"]
```

## Migration from Single-Tenant

1. **Backup your data**
   ```bash
   mongodump --uri="your-current-mongodb-uri"
   ```

2. **Run migration script**
   ```bash
   node scripts/migrate-to-multitenant.js
   ```

3. **Update environment variables**

4. **Test with new subdomain URL**

5. **Update CGM uploaders with new URL and credentials**

## Security Considerations

1. **JWT Secret**: Use a strong, random secret (min 32 characters)
2. **HTTPS Required**: Always use HTTPS in production
3. **Database Security**: Use MongoDB authentication and network restrictions
4. **Password Policy**: Enforce strong passwords (min 8 characters)
5. **Rate Limiting**: Consider adding rate limiting for auth endpoints

## Troubleshooting

### Common Issues

1. **"Tenant not found" error**
   - Check subdomain is correct
   - Verify BASE_DOMAIN setting
   - Ensure tenant exists in database

2. **Authentication failures**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Ensure user belongs to tenant

3. **Data not showing**
   - Verify tenant database exists
   - Check user has correct role
   - Ensure data is in correct tenant database

### Debug Mode

Enable debug logging:
```bash
DEBUG=nightscout:* npm start
```

## Development

### Local Development Setup

1. **Install MongoDB locally**
2. **Create test tenants**
   ```bash
   node scripts/create-test-tenants.js
   ```
3. **Use /etc/hosts for subdomains**
   ```
   127.0.0.1 tenant1.localhost
   127.0.0.1 tenant2.localhost
   ```

### Running Tests

```bash
npm test
npm run test:multitenant
```

## Support

For multi-tenant specific issues:
- Open an issue with [multitenant] tag
- Include environment details
- Provide error logs

## License

Same as original Nightscout - AGPL v3