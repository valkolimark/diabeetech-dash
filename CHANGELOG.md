# Changelog

All notable changes to the Nightscout Multi-Tenant project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Memory Optimization Deployment** (2025-07-26) - Successfully deployed memory optimizations:
  - Added memory limits in Procfile (`--max-old-space-size=400 --optimize-for-size`)
  - Implemented connection pool configuration (reduced from 100 to 10 connections)
  - Created memory monitoring endpoint at `/api/v1/admin/memory`
  - Added data cleanup scripts for entries older than 90 days
  - Deployed as version v214
  - Result: Memory usage reduced from 512MB+ to ~38MB, eliminating R14 errors

### Fixed
- **Admin Dashboard User Deletion** (2025-07-26) - Fixed critical issues preventing user deletion in the admin dashboard:
  - Fixed environment context error by adding `app.set('ctx', ctx)` to multi-tenant app configuration
  - Fixed auth token propagation by updating frontend to store JWT tokens in localStorage and properly send them with API requests
  - Fixed database access by replacing `ctx.env.storageSupport` with direct MongoClient connections in all admin user endpoints
  - Fixed MongoDB ObjectId handling to support both string UUIDs and ObjectId formats when querying users
  - Result: Admin users can now be successfully deleted through the dashboard (changed from 500/404 errors to successful 200 responses)

## [15.0.2] - 2025-07-25

### Fixed
- **Treatments API for Multi-Tenant Setup** - Fixed treatments creation, update, and deletion for multi-tenant environments:
  - Added proper tenant context to all treatment operations
  - Fixed timestamp handling to use ISO format consistently
  - Ensured tenant isolation for all CRUD operations
  - Added validation for required fields (eventType, created_at)

### Added
- Multi-tenant support for treatments API
- Tenant context validation in treatments endpoints

## [15.0.1] - Previous Release

### Changed
- Initial multi-tenant implementation
- Added tenant isolation for data access
- Implemented subdomain-based tenant routing