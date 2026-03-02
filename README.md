# Diabeetech

Multi-tenant CGM (Continuous Glucose Monitor) remote monitoring platform built on Nightscout v15.0.2. Enables diabetics and caregivers to view real-time blood glucose data from Dexcom CGM devices through individualized web dashboards.

## Overview

Diabeetech extends Nightscout with full multi-tenant architecture. Each user gets an isolated subdomain, database, and Dexcom bridge — all managed through a centralized admin dashboard.

```
Request → Subdomain Routing → Tenant Resolver → Isolated Tenant DB
          (ari.diabeetech.net)                   (nightscout-tenant-ari)
```

**Production:** Heroku (`btech`) with MongoDB Atlas
**Admin Dashboard:** React 18 + Material-UI 5

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v14-20 LTS |
| Framework | Express.js 4.18 |
| Database | MongoDB (per-tenant isolation) |
| Real-Time | Socket.io 4.6 |
| Admin UI | React 18, Material-UI 5, React Query |
| Auth | JWT + bcryptjs + API Secret (SHA-1) |
| CGM Data | Dexcom Share Bridge (per-tenant polling) |
| Bundling | Webpack 5 + Babel |
| Notifications | Pushover, Nodemailer (SMTP) |

## Architecture

### Multi-Tenant Model

- **Master DB** — Stores tenants, users, and audit logs (shared across all tenants)
- **Tenant DBs** — Each tenant gets `nightscout-tenant-{subdomain}` with entries, treatments, profiles, devicestatus, food, settings
- **Routing** — Subdomain extraction, `X-Tenant-ID` header, query param, or default tenant fallback
- **Bridge Manager** — Per-tenant Dexcom Share bridge instances with independent credentials and polling

### Key Directories

```
lib/
  api/admin/          Admin API (tenants, users, bridges, glucose, analytics, system)
  api/auth/           User authentication (JWT login, logout, refresh, profile)
  api/tenants/        Tenant registration (enhanced + basic)
  middleware/          Tenant resolver, auth, rate limiting, captcha
  models/             Tenant, user, tenant-settings models
  plugins/            40+ Nightscout plugins + multi-tenant bridge
  services/           Bridge manager lifecycle
  server/             Express app, boot sequence, websocket handlers
  utils/              Connection manager, settings cloner

admin-dashboard/
  src/pages/           Dashboard, Tenants, Users, DexcomCredentials, GlucoseOverview,
                       Analytics, System, AuditLogs, Settings
  src/services/        API client (axios), auth service
  src/components/      Layout (sidebar), DataTable (reusable)

views/                 EJS templates (login, register, admin dashboard)
static/                Built admin JS bundles, CSS, client-side assets
```

## Admin Dashboard

Accessible at `/admin` with superadmin JWT authentication.

### Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Overview stats, system health, active tenants |
| **Tenants** | List, create, edit, suspend, delete tenants. Full creation form with Dexcom setup |
| **Users** | User management across all tenants |
| **Dexcom Bridges** | View/edit Dexcom credentials, start/stop/restart bridges per tenant |
| **Glucose Overview** | Live glucose readings for all tenants with color coding and auto-refresh (30s) |
| **Analytics** | Usage metrics and trends |
| **System** | Server info, health checks, maintenance |
| **Audit Logs** | Admin action history |
| **Settings** | Configuration management |

## API Endpoints

### Admin API (`/api/v1/admin/`)
Requires superadmin JWT. Mounted before tenant resolver.

- `POST /auth/login` — Admin login
- `GET/POST /tenants` — Tenant CRUD
- `POST /tenants/create-full` — Full tenant setup (DB + user + bridge)
- `GET/PUT /bridges/:tenantId` — Dexcom credential management
- `POST /bridges/:tenantId/restart` — Restart bridge
- `POST /bridges/:tenantId/stop` — Stop bridge
- `GET /glucose/overview` — All tenants' latest glucose readings
- `GET/POST/PUT/DELETE /users` — User management
- `GET /analytics/overview` — Usage analytics
- `GET /system/health` — System health
- `GET /audit` — Audit logs

### Nightscout API (`/api/v1/`)
Requires tenant context (subdomain or header) + API secret or JWT.

- `GET/POST /entries` — Glucose readings (SGV data)
- `GET/POST /treatments` — Insulin, carbs, notes
- `GET/POST /devicestatus` — Pump/receiver status
- `GET/PUT /profile` — Treatment profiles
- `GET /status` — Health check

### Registration (`/api/register`)
- `POST /` — Create account with optional Dexcom/CareLink credentials
- `GET /check-username/:username` — Subdomain availability check

## Authentication

| Method | Use Case |
|--------|----------|
| JWT (24h tokens) | User login, admin dashboard |
| API Secret (SHA-1) | CGM uploaders, API clients |
| Per-tenant API Secret | Tenant-specific API access |

### Roles
- `superadmin` — Global admin across all tenants
- `admin` — Full tenant management
- `caregiver` — View data, add treatments
- `viewer` — Read-only glucose access

## Dexcom Share Bridge

Each tenant can have an independent Dexcom Share bridge that polls `share2.dexcom.com` for glucose data.

- **Polling interval:** ~2.5 minutes per tenant
- **Retry logic:** Max 3 failures with backoff
- **Credential storage:** Per-tenant `settings` collection in tenant DB
- **Lifecycle:** Managed by bridge-manager service (`lib/services/bridge-manager.js`)
- **Admin control:** Start/stop/restart via admin dashboard or API

## Plugin System

40+ plugins for glucose analysis, device monitoring, and integrations:

**Core:** delta, direction, ar2 (forecast), simplealarms, upbat, timeago, errorcodes, profile
**Treatment:** careportal, iob, cob, boluscalc, bwp, basal, bolus
**Device Age:** cage, sage, iage, bage
**Integrations:** alexa, googlehome, pushover, maker (IFTTT), speech
**CGM:** bridge (Dexcom Share), rawbg, pump, openaps, loop

## Local Development

### Prerequisites
- Node.js v20 LTS (via nvm)
- MongoDB 7.0+ running locally

### Setup

```bash
# Clone
git clone https://github.com/valkolimark/diabeetech-dash.git
cd diabeetech-dash

# Node version
nvm install 20
nvm use 20

# Install dependencies
npm install
cd admin-dashboard && npm install && cd ..

# Configure environment
cp .env.example .env  # Edit with your MongoDB URI and settings

# Add tenant subdomains to hosts file
sudo sh -c 'echo "127.0.0.1 staging.localhost tenant1.localhost" >> /etc/hosts'

# Start server
npx env-cmd -f .env node server.js
```

### Admin Dashboard Development

```bash
cd admin-dashboard

# Development with hot reload (proxies to localhost:1337)
npm start

# Production build (outputs to static/admin/js/ and views/)
npm run build
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MULTI_TENANT_ENABLED` | Enable multi-tenant mode | `true` |
| `MONGODB_URI` | Default MongoDB connection | — |
| `MASTER_MONGODB_URI` | Master DB for tenants/users | — |
| `TENANT_DB_PREFIX` | Per-tenant DB name prefix | `nightscout_tenant_` |
| `API_SECRET` | Default API secret (12+ chars) | — |
| `JWT_SECRET` | JWT signing secret | — |
| `BASE_DOMAIN` | Base domain for subdomain routing | `localhost` |
| `DEFAULT_TENANT` | Fallback tenant subdomain | — |
| `PORT` | Server port | `1337` |
| `NODE_ENV` | Environment | `development` |

## Deployment

### Heroku

```bash
# Deploy via Heroku CLI
git push heroku main

# Or via Vercel-style API trigger (see docs)
```

### Environment
- Heroku app: `btech`
- Memory: `--max-old-space-size=400`
- MongoDB: Atlas (production), local (development)

## Project Documentation

Detailed documentation lives in `docs/`:
- `docs/APP-OVERVIEW.md` — Comprehensive feature documentation
- `docs/changelogs/CHANGELOG.md` — Version history
- `docs/api/` — API documentation
- `docs/architecture/` — System design docs
- `prompts/` — Session prompts for Claude Code development

## Based On

[Nightscout](https://github.com/nightscout/cgm-remote-monitor) v15.0.2 — #WeAreNotWaiting

## License

AGPL-3.0 (inherited from Nightscout)
