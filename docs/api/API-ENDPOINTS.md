# Nightscout API Endpoints Documentation

This document provides a comprehensive list of all API endpoints available in the Nightscout application, organized by category for easy reference.

## Table of Contents

1. [Authentication API](#authentication-api)
2. [Admin API](#admin-api)
3. [API v1 (Legacy)](#api-v1-legacy)
4. [API v2](#api-v2)
5. [API v3](#api-v3)
6. [Tenant Management API](#tenant-management-api)
7. [Utility Endpoints](#utility-endpoints)

---

## Authentication API

### User Authentication (`/api/auth`)
- **POST** `/api/auth/login` - User login
- **POST** `/api/auth/logout` - User logout
- **POST** `/api/auth/refresh` - Refresh authentication token
- **GET** `/api/auth/profile` - Get user profile
- **PUT** `/api/auth/profile` - Update user profile
- **POST** `/api/auth/change-password` - Change user password
- **POST** `/api/auth/forgot-password` - Request password reset
- **POST** `/api/auth/reset-password` - Reset password with token
- **GET** `/api/auth/verify` - Verify authentication status

### Admin Authentication (`/api/v1/admin/auth`)
- **POST** `/api/v1/admin/auth/login` - Admin login (requires superadmin role)
- **GET** `/api/v1/admin/auth/user` - Get current admin user info
- **POST** `/api/v1/admin/auth/logout` - Admin logout

---

## Admin API

All admin endpoints require superadmin authentication.

### Overview & System (`/api/v1/admin`)
- **GET** `/api/v1/admin/overview` - Get system overview (tenants, users, uptime)
- **GET** `/api/v1/admin/health` - System health check
- **GET** `/api/v1/admin/features` - Get enabled feature flags

### Dashboard (`/api/v1/admin/dashboard`)
- **GET** `/api/v1/admin/dashboard/stats` - Real-time dashboard statistics
- **GET** `/api/v1/admin/dashboard/activity` - Recent system activity
- **GET** `/api/v1/admin/dashboard/charts` - Chart data for visualizations
- **GET** `/api/v1/admin/dashboard/alerts` - System alerts and notifications

### Tenant Management (`/api/v1/admin/tenants`)
- **GET** `/api/v1/admin/tenants` - List all tenants
- **GET** `/api/v1/admin/tenants/:id` - Get tenant details
- **POST** `/api/v1/admin/tenants` - Create new tenant
- **PUT** `/api/v1/admin/tenants/:id` - Update tenant
- **DELETE** `/api/v1/admin/tenants/:id` - Delete tenant
- **POST** `/api/v1/admin/tenants/:id/suspend` - Suspend tenant
- **POST** `/api/v1/admin/tenants/:id/activate` - Activate tenant
- **GET** `/api/v1/admin/tenants/:id/users` - Get tenant users
- **GET** `/api/v1/admin/tenants/:id/stats` - Get tenant statistics
- **GET** `/api/v1/admin/tenants/:id/activity` - Get tenant activity
- **POST** `/api/v1/admin/tenants/check-subdomain` - Check subdomain availability
- **POST** `/api/v1/admin/tenants/bulk` - Bulk tenant operations
- **GET** `/api/v1/admin/tenants/export` - Export tenants data

### User Management (`/api/v1/admin/users`)
- **GET** `/api/v1/admin/users` - List all users
- **GET** `/api/v1/admin/users/:id` - Get user details
- **POST** `/api/v1/admin/users` - Create new user
- **PUT** `/api/v1/admin/users/:id` - Update user
- **DELETE** `/api/v1/admin/users/:id` - Delete user
- **POST** `/api/v1/admin/users/:id/reset-password` - Reset user password
- **POST** `/api/v1/admin/users/:id/disable-2fa` - Disable user 2FA
- **POST** `/api/v1/admin/users/bulk` - Bulk user operations

### Analytics (`/api/v1/admin/analytics`)
- **GET** `/api/v1/admin/analytics/overview` - Analytics overview
- **GET** `/api/v1/admin/analytics/tenants/:id` - Tenant-specific analytics
- **GET** `/api/v1/admin/analytics/usage` - System usage analytics
- **GET** `/api/v1/admin/analytics/trends` - Usage trends

### System Management (`/api/v1/admin/system`)
- **GET** `/api/v1/admin/system/info` - System information
- **GET** `/api/v1/admin/system/health` - Detailed health check
- **GET** `/api/v1/admin/system/config` - System configuration
- **GET** `/api/v1/admin/system/logs` - System logs
- **POST** `/api/v1/admin/system/maintenance` - Maintenance operations

### Audit (`/api/v1/admin/audit`)
- **GET** `/api/v1/admin/audit` - Audit log entries
- **GET** `/api/v1/admin/audit/stats` - Audit statistics
- **POST** `/api/v1/admin/audit/export` - Export audit logs
- **DELETE** `/api/v1/admin/audit/cleanup` - Clean up old audit logs

---

## API v1 (Legacy)

### Data Endpoints (`/api/v1`)
- **ALL** `/api/v1/entries*` - Blood glucose entries
- **ALL** `/api/v1/echo/*` - Echo endpoint for testing
- **ALL** `/api/v1/times/*` - Time-based queries
- **ALL** `/api/v1/slice/*` - Data slicing operations
- **ALL** `/api/v1/count/*` - Count operations
- **ALL** `/api/v1/treatments*` - Treatment records
- **ALL** `/api/v1/profile*` - User profiles
- **ALL** `/api/v1/devicestatus*` - Device status updates
- **ALL** `/api/v1/notifications*` - Notification management
- **ALL** `/api/v1/activity*` - Activity logs
- **ALL** `/api/v1/food*` - Food database
- **ALL** `/api/v1/status*` - API status

### Integration Endpoints
- **ALL** `/api/v1/alexa*` - Amazon Alexa integration
- **ALL** `/api/v1/googlehome*` - Google Home integration
- **ALL** `/api/v1/experiments/*` - Experimental features

### Verification
- **GET** `/api/v1/verifyauth` - Verify API authentication

---

## API v2

### Core Endpoints (`/api/v2`)
- **GET** `/api/v2/properties` - System properties
- **GET/POST** `/api/v2/authorization/*` - Authorization management
- **ALL** `/api/v2/ddata/*` - Direct data access
- **ALL** `/api/v2/notifications/*` - Enhanced notifications
- **ALL** `/api/v2/summary/*` - Data summaries

---

## API v3

### System Endpoints (`/api/v3`)
- **GET** `/api/v3/version` - API version information
- **GET** `/api/v3/status` - API status
- **GET** `/api/v3/lastModified` - Last modification timestamps
- **GET** `/api/v3/test` - Test endpoint (development only)

### Generic Collection Endpoints

Each collection supports the following operations:

#### Entries (`/api/v3/entries`)
- **GET** `/api/v3/entries` - Search/list entries
- **POST** `/api/v3/entries` - Create new entry
- **GET** `/api/v3/entries/history` - Get history
- **GET** `/api/v3/entries/history/:lastModified` - Get history since timestamp
- **GET** `/api/v3/entries/:identifier` - Read specific entry
- **PUT** `/api/v3/entries/:identifier` - Update entry
- **PATCH** `/api/v3/entries/:identifier` - Partial update
- **DELETE** `/api/v3/entries/:identifier` - Delete entry

#### Treatments (`/api/v3/treatments`)
- **GET** `/api/v3/treatments` - Search/list treatments
- **POST** `/api/v3/treatments` - Create new treatment
- **GET** `/api/v3/treatments/history` - Get history
- **GET** `/api/v3/treatments/history/:lastModified` - Get history since timestamp
- **GET** `/api/v3/treatments/:identifier` - Read specific treatment
- **PUT** `/api/v3/treatments/:identifier` - Update treatment
- **PATCH** `/api/v3/treatments/:identifier` - Partial update
- **DELETE** `/api/v3/treatments/:identifier` - Delete treatment

#### Device Status (`/api/v3/devicestatus`)
- **GET** `/api/v3/devicestatus` - Search/list device statuses
- **POST** `/api/v3/devicestatus` - Create new status
- **GET** `/api/v3/devicestatus/history` - Get history
- **GET** `/api/v3/devicestatus/history/:lastModified` - Get history since timestamp
- **GET** `/api/v3/devicestatus/:identifier` - Read specific status
- **PUT** `/api/v3/devicestatus/:identifier` - Update status
- **PATCH** `/api/v3/devicestatus/:identifier` - Partial update
- **DELETE** `/api/v3/devicestatus/:identifier` - Delete status

#### Food (`/api/v3/food`)
- **GET** `/api/v3/food` - Search/list food items
- **POST** `/api/v3/food` - Create new food item
- **GET** `/api/v3/food/history` - Get history
- **GET** `/api/v3/food/history/:lastModified` - Get history since timestamp
- **GET** `/api/v3/food/:identifier` - Read specific food item
- **PUT** `/api/v3/food/:identifier` - Update food item
- **PATCH** `/api/v3/food/:identifier` - Partial update
- **DELETE** `/api/v3/food/:identifier` - Delete food item

#### Profile (`/api/v3/profile`)
- **GET** `/api/v3/profile` - Search/list profiles
- **POST** `/api/v3/profile` - Create new profile
- **GET** `/api/v3/profile/history` - Get history
- **GET** `/api/v3/profile/history/:lastModified` - Get history since timestamp
- **GET** `/api/v3/profile/:identifier` - Read specific profile
- **PUT** `/api/v3/profile/:identifier` - Update profile
- **PATCH** `/api/v3/profile/:identifier` - Partial update
- **DELETE** `/api/v3/profile/:identifier` - Delete profile

#### Settings (`/api/v3/settings`)
- **GET** `/api/v3/settings` - Search/list settings
- **POST** `/api/v3/settings` - Create new setting
- **GET** `/api/v3/settings/history` - Get history
- **GET** `/api/v3/settings/history/:lastModified` - Get history since timestamp
- **GET** `/api/v3/settings/:identifier` - Read specific setting
- **PUT** `/api/v3/settings/:identifier` - Update setting
- **PATCH** `/api/v3/settings/:identifier` - Partial update
- **DELETE** `/api/v3/settings/:identifier` - Delete setting

---

## Tenant Management API

### Registration & Management (`/api/v1/tenants`)
- **POST** `/api/v1/tenants/register` - Register new tenant
- **GET** `/api/v1/tenants/check-username/:username` - Check username availability
- **GET** `/api/v1/tenants/current` - Get current tenant info
- **PUT** `/api/v1/tenants/current` - Update current tenant
- **GET** `/api/v1/tenants/users` - List tenant users
- **POST** `/api/v1/tenants/users` - Create tenant user
- **PUT** `/api/v1/tenants/users/:userId` - Update tenant user
- **DELETE** `/api/v1/tenants/users/:userId` - Delete tenant user

---

## Utility Endpoints

### Static Resources
- **GET** `/robots.txt` - Robots file
- **GET** `/sw.js` - Service worker
- **GET** `/swagger.json` - OpenAPI specification (JSON)
- **GET** `/swagger.yaml` - OpenAPI specification (YAML)
- **GET** `/api3-docs` - API documentation

### UI Pages
- **GET** `/` - Main application
- **GET** `/login` - Login page
- **GET** `/register` - Registration page
- **GET** `/admin` - Admin dashboard
- **GET** `/admin/*` - Admin dashboard routes
- **GET** `/pebble` - Pebble watch interface

### Clock Interfaces
- **GET** `/clock` - Simple clock interface
- **GET** `/clock/:face` - Clock with specific face
- **GET** `/clock/config` - Clock configuration
- **POST** `/clock/config` - Update clock configuration

### Security
- **POST** `/report-violation` - Content Security Policy violation reports

---

## Authentication Requirements

- **Public endpoints**: Registration, login, and some status endpoints
- **User authentication**: Required for all data manipulation endpoints (entries, treatments, etc.)
- **Admin authentication**: Required for tenant management endpoints (admin role)
- **Superadmin authentication**: Required for all `/api/v1/admin/*` endpoints

## Rate Limiting

- Registration endpoints are rate-limited to prevent abuse
- API endpoints may have request limits based on tenant configuration

## Multi-tenant Considerations

- Most endpoints are tenant-scoped when multi-tenant mode is enabled
- Tenant identification is typically done via subdomain or request headers
- Admin endpoints operate across all tenants (superadmin only)

## API Versioning

- **v1**: Legacy API, maintained for backward compatibility
- **v2**: Enhanced API with better authorization and data access
- **v3**: Modern RESTful API with standardized operations

## Response Formats

- Most endpoints support JSON responses
- Some endpoints support additional formats: CSV, TSV, XML, HTML
- Use `Accept` header or file extension to specify desired format