# Diabeetech (B-Tech) — Application Overview

## What Is This App?

Diabeetech (codebase: **btech**) is a **multi-tenant Continuous Glucose Monitor (CGM) remote monitoring platform** built on Nightscout v15.0.2. It allows diabetics and their caregivers to view real-time blood glucose data from CGM devices (primarily Dexcom) through a web dashboard, with advanced analytics, treatment tracking, and alerting.

**Production URL:** diabeetech.com (subdomains per tenant)
**Hosting:** Heroku (app name: `btech`)
**Database:** MongoDB (per-tenant isolation)

---

## Active Clients

There are **3 active tenants** using this platform. All three are operated by the same owner. Each tenant has its own isolated MongoDB database and subdomain, and **must not be interrupted**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v14-20 LTS |
| Web Framework | Express.js v4.18.2 |
| Database | MongoDB v3.7.3-4.4 |
| Templating | EJS |
| Charting | D3.js |
| Real-Time | Socket.io v4.6.2 |
| Admin Dashboard | React 18 + Material-UI 5 |
| Auth | JWT + bcryptjs + API Secret (SHA-1) |
| Bundling | Webpack 5 + Babel |
| Deployment | Heroku (400MB heap limit), Docker available |
| Notifications | Pushover, Nodemailer (SMTP) |
| Voice | Google Home (DialogFlow), Amazon Alexa |

---

## Architecture

### Multi-Tenant Model

```
┌─────────────────────────────────────┐
│           Heroku (btech)            │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Express + Socket.io Server  │  │
│  │   (lib/server/server.js)      │  │
│  └──────────┬────────────────────┘  │
│             │                       │
│  ┌──────────▼────────────────────┐  │
│  │   Tenant Resolver Middleware   │  │
│  │   (subdomain → tenant DB)     │  │
│  └──────────┬────────────────────┘  │
│             │                       │
│  ┌──────────▼──────┐ ┌───────────┐  │
│  │   Master DB     │ │ Tenant DBs│  │
│  │  (tenants,      │ │ (entries, │  │
│  │   users,        │ │ treatments│  │
│  │   audit_logs)   │ │ profiles, │  │
│  └─────────────────┘ │ food,     │  │
│                      │ settings) │  │
│                      └───────────┘  │
└─────────────────────────────────────┘
```

- **Master DB:** Stores tenants, users, and audit logs (shared)
- **Tenant DBs:** Each tenant gets `nightscout-tenant-{subdomain}` with its own entries, treatments, profiles, food, and settings
- **Isolation:** Request routing via subdomain, X-Tenant-Subdomain header, or REFERER header

### Key Server Files

| File | Purpose |
|------|---------|
| `server.js` → `lib/server/server.js` | Entry point |
| `lib/server/app.js` | Express app (single-tenant) |
| `lib/server/app-multitenant.js` | Express app (multi-tenant) |
| `lib/server/env.js` | Environment parser |
| `lib/server/websocket.js` | Socket.io (single-tenant) |
| `lib/server/websocket-multitenant.js` | Socket.io (multi-tenant) |
| `lib/server/bootevent.js` | Boot sequence (single) |
| `lib/server/bootevent-multitenant.js` | Boot sequence (multi) |

---

## Backend Features

### 1. Real-Time Glucose Data Pipeline

- CGM data flows in via Dexcom Share Bridge or direct API upload
- Data validated, deduplicated, and stored in MongoDB
- Event bus emits `data-received` → plugins process → `data-update` broadcast
- Socket.io pushes to all connected clients in < 1 minute latency
- Stale data detection (> 13 minutes without reading)

### 2. REST API (3 versions)

**V1 API** (`/api/v1/`) — Core endpoints:
- `POST /auth/login` — JWT authentication (24h tokens)
- `GET/POST /entries` — Glucose readings (SGV data)
- `GET/POST /treatments` — Insulin, carbs, notes
- `GET/POST /devicestatus` — Pump/receiver status
- `GET/PUT /profile` — Treatment profiles (basal, ISF, carb ratio)
- `GET/POST /food` — Food database
- `GET /settings` — System settings
- `GET /status` — Health check

**V2 API** (`/api/v2/`) — Enhanced features + notifications

**V3 API** (`/api/v3/`) — Modern REST with Swagger docs:
- Generic CRUD for all collections
- Pagination, filtering, partial updates
- Swagger UI at `/api3-docs`

### 3. Admin API (`/api/v1/admin/`)

- Tenant CRUD (create, list, edit, suspend, delete)
- User management across tenants
- API secret generation/regeneration per tenant
- System analytics and dashboard metrics
- Audit logging of all admin actions
- Memory and system health monitoring

### 4. Authentication & Authorization

**Three auth methods:**
1. **JWT** — Email/password login, 24h tokens, refresh support
2. **API Secret** — For CGM uploaders (header or query param, SHA-1 hash supported)
3. **Multi-Tenant API Secret** — Per-tenant unique secret

**RBAC Roles:**
- `superadmin` — Global admin across all tenants
- `admin` — Full tenant management
- `caregiver` — View data, add treatments, manage food
- `viewer` — Read-only glucose data access

### 5. Dexcom Share Bridge

- Auto-fetches glucose readings from Dexcom Share API every 2.6 minutes
- Per-tenant bridge instances with separate credentials
- Retry logic with exponential backoff (max 3 failures)
- Config: `BRIDGE_USER_NAME`, `BRIDGE_PASSWORD`, `BRIDGE_INTERVAL`

### 6. Plugin System (40+ plugins)

**Always-On Plugins:**
- `delta` — BG change rate calculation
- `direction` — Trend arrow indicators
- `ar2` — Autoregressive 30-min glucose forecast
- `simplealarms` — High/low/urgent alarm generation
- `upbat` — Uploader battery status
- `timeago` — Time since last reading
- `devicestatus` — Pump/device monitoring
- `errorcodes` — CGM error display
- `profile` — Treatment profile display

**Optional Plugins:**
- `careportal` — Manual treatment entry
- `boluscalc` — Insulin bolus calculator
- `iob` — Insulin on Board calculation
- `cob` — Carbs on Board tracking
- `rawbg` — Dexcom raw glucose values
- `bwp` — Bolus Wizard Preview
- `cage/sage/iage/bage` — Cannula/sensor/insulin/battery age tracking
- `basal` — Basal rate visualization
- `bolus` — Bolus delivery rendering
- `pump` — Pump status monitoring
- `openaps` — OpenAPS loop status
- `loop` — Loop app status
- `bridge` — Dexcom Share data bridge
- `alexa` — Amazon Alexa voice integration
- `googlehome` — Google Home integration
- `maker` — IFTTT integration
- `speech` — Text-to-speech announcements
- `pushover` — Push notifications

### 7. Background Workers

- **Clock Plugin** — Visual clock displays (BGClock, Simple, Color) with auto-refresh
- **Data Processing Pipeline** — Validation → storage → plugin processing → broadcast
- **Bridge Polling** — Dexcom data fetch every 2.6 minutes per tenant
- **Event Bus** — `data-received`, `data-update`, `notification`, `alarm`, `teardown`

### 8. Email & Notifications

- SMTP email via Nodemailer (Gmail configured)
- Pushover push notifications
- hCaptcha for form protection
- Tenant registration confirmation emails
- Password reset emails

### 9. Database Collections

**Master DB:**
- `tenants` — Org records (subdomain, dbName, apiSecret, maxUsers, features)
- `users` — User accounts (email, passwordHash, role, tenantId, permissions)
- `audit_logs` — Admin action tracking

**Per-Tenant DB:**
- `entries` — Glucose readings (date, sgv, direction, device)
- `treatments` — Insulin/carbs/notes (eventType, insulin, carbs, created_at)
- `devicestatus` — Device monitoring data
- `profile` — Treatment settings (basal, ISF, carb ratio, targets)
- `food` — Custom food database (name, portion, carbs, calories)
- `settings` — System configuration
- `activity` — Physical activity records

---

## Frontend Features

### 1. Main Dashboard (`/`)

- **Large BG Display** — Color-coded glucose number (urgent red, warning yellow, in-range green)
- **Trend Arrow** — Real-time direction indicator (double-up through double-down)
- **D3.js Chart** — Interactive glucose trend visualization with:
  - Focus (detail) and context (overview) dual-chart design
  - Brush-based time range selection
  - Zoom/pan controls (1, 2, 3, 4, 6, 12, 24 hour views)
  - SVG patterns for combo bolus rendering
  - Forecast overlay with opacity scaling
  - Dynamic/logarithmic/linear scale options
  - Mouse tooltips with timestamp, value, treatment details
- **Status Pills** — Color-coded indicators for IOB, COB, device status, battery
- **Time Display** — Current time with timezone
- **Notification Area** — Toast notifications with dismiss
- **Drawer Menu** — Sliding sidebar navigation

### 2. Login & Registration

- Email/password login form with tenant/subdomain awareness
- User registration with optional hCaptcha
- Multi-tenant subdomain routing
- Dark theme styling

### 3. Careportal (Treatment Entry)

- Dynamic event type selection (BG Check, Meal, Correction, etc.)
- Insulin dose, carb, and absorption rate inputs
- Time/date validation
- Profile switching during entries
- Event submission with real-time broadcast

### 4. Bolus Calculator

- Real-time BG input from current sensor reading
- IOB and COB integration
- Food database lookup with quick picks
- Insulin calculation based on active profile (ISF, carb ratio)
- Stale data detection (>10 min warning)

### 5. Food Database Editor

- Full food record management (add, edit, delete)
- Filter by category, subcategory, name
- Nutritional info: carbs, fat, protein, energy (kJ), glycemic index
- Portion size and unit tracking
- Quick picks for common meals
- Two versions: full editor (`foodindex`) and simplified (`sfoodindex`)

### 6. Profile Editor

- **General Settings:** Title, units (mg/dL or mmol/L), time format, timezone, DIA
- **Multiple Records:** Add, clone, remove dated records
- **Stored Profiles:** Multiple named profiles with date validity ranges
- **Treatment Settings:** Basal rates, insulin sensitivity factors, carb ratios, target BG ranges
- Two versions: full (`profileindex`) and simplified (`sprofileindex`)

### 7. Reports & Analytics

11 report types:
- **Day to Day** — Glucose patterns across multiple days
- **Glucose Distribution** — Histogram of time in glucose ranges
- **Daily Stats** — Summary statistics per day
- **Hourly Stats** — Hour-by-hour breakdowns
- **Week to Week** — Comparative weekly analysis
- **Loopalyzer** — Loop system performance metrics
- **Calibrations** — Sensor calibration history
- **Success Metrics** — Goal achievement tracking
- **Treatments** — Treatment event analysis
- **Profiles** — Profile change history
- **Percentile Analysis** — Glucose distribution curves

**Report Filters:**
- Custom date range or presets (today, 2/3/7/14/31/90 days)
- Day of week filtering
- Food/note/event type filtering
- Target BG range customization
- Unit display toggle

### 8. Clock Views

- **BGClock** — Large glucose display with trend
- **Simple Clock** — Minimal layout
- **Color Clock** — Color-coded glucose ranges
- Configurable via `/clock/config`
- Auto-refresh with stale data detection

### 9. Admin Dashboard (React)

- React 18 + Material-UI 5 interface
- System health metrics and dashboard
- Tenant management (CRUD, suspend/activate)
- User management across all tenants
- Analytics and usage trends
- Audit log viewer
- API secret management

### 10. Settings (Client-Side)

- Units (mg/dL or mmol/L)
- Time format (12/24 hour)
- Alarm thresholds (urgent high, high, low, urgent low)
- Night mode toggle
- Theme selection (default, colors, colorblind-friendly)
- Language selection (35+ languages)
- Chart scale preference
- Basal rendering style (none/default/icicle)
- Bolus display thresholds
- Custom dashboard title

### 11. Progressive Web App (PWA)

- Service worker with cache-first strategy
- Offline capability
- Home screen installable (iOS + Android)
- App icons (36x36 through 192x192)
- Standalone display mode
- Apple mobile web app support

### 12. Internationalization (i18n)

35+ languages supported including: Arabic, Bulgarian, Czech, Danish, German, Greek, English, Spanish, Estonian, Finnish, French, Hebrew, Hindi, Croatian, Hungarian, Italian, Japanese, Korean, Norwegian, Dutch, Polish, Portuguese (BR + PT), Romanian, Russian, Slovak, Slovenian, Swedish, and more.

- JSON-based translation files
- Browser language auto-detection
- Dynamic language switching
- All UI text translatable

### 13. Theming & Styling

- **Dark theme** optimized for nighttime viewing (black #000 background)
- **Color scheme:** Urgent=red, Warning=yellow, In-range=green (#4cff00), Links=blue (#2196f3)
- **Fonts:** Ubuntu (body/UI), Open Sans (registration/login)
- **Icon fonts:** nsicons (custom), pluginicons
- **jQuery UI themes:** ui-darkness (dashboard), ui-lightness (reports)
- **Responsive design** with touch-optimized interface

### 14. Voice Integrations

- **Amazon Alexa:** "What's my glucose?" skill
- **Google Home:** DialogFlow integration for glucose queries

### 15. Debug Tools

Client-side debug scripts for development:
- `auth-check.js` — Auth verification
- `chart-data-debug.js` — Chart data inspection
- `data-debug.js` — Data payload analysis
- `profile-debug.js` — Profile validation
- `check-data-freshness.js` — Data age monitoring
- `check-live-data.js` — Live data stream verification

---

## Deployment

### Heroku Configuration

```
Procfile:
  web: node --max-old-space-size=400 --optimize-for-size lib/server/server.js
  release: node scripts/heroku-setup.js
```

### Critical Environment Variables

```bash
# Multi-Tenant
MULTI_TENANT_ENABLED=true
MASTER_MONGODB_URI=<connection-string>
JWT_SECRET=<32+ chars>
BASE_DOMAIN=diabeetech.com

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<email>
EMAIL_PASS=<app-password>

# Per-Tenant (via admin)
MONGODB_URI=<tenant-specific>
API_SECRET=<12+ chars>

# Display
DISPLAY_UNITS=mg/dl
ENABLE=careportal boluscalc rawbg iob cob ...

# Security
SECURE_HSTS_HEADER=true
INSECURE_USE_HTTP=false
```

### Docker (Alternative)

```bash
docker build -t diabeetech .
docker run -p 1337:1337 -e MONGODB_URI=... diabeetech
```

---

## Security

- **HTTPS/TLS** enforced with HSTS (1 year max-age)
- **Password hashing** via bcryptjs (10 salt rounds)
- **API secrets** hashed with SHA-1 for comparison
- **JWT tokens** with 24h expiration
- **Rate limiting** via express-rate-limit
- **Input validation** via ajv (JSON schema) + DOMPurify (HTML sanitization)
- **CAPTCHA** protection via hCaptcha on registration
- **Tenant isolation** — cross-tenant access prevented at middleware level
- **Sensitive fields** (`passwordHash`, `resetToken`) never returned in API responses

---

## File Structure

```
btech/
├── server.js                 # Entry point redirect
├── lib/
│   ├── server/               # Express app, boot, websocket, env
│   ├── api/                  # V1 REST API + admin routes
│   ├── api2/                 # V2 API
│   ├── api3/                 # V3 modern API
│   ├── middleware/            # Auth, tenant resolver, rate limit
│   ├── models/               # Tenant, user, settings models
│   ├── plugins/              # 40+ analysis/integration plugins
│   ├── report_plugins/       # 11 report generators
│   ├── client/               # Client-side JS modules
│   ├── data/                 # Data loading and processing
│   ├── storage/              # MongoDB connection handler
│   ├── bus.js                # Event bus
│   ├── notifications.js      # Email/push notifications
│   ├── profilefunctions.js   # Basal/ISF calculations
│   └── settings.js           # Settings schema
├── views/                    # EJS templates (dashboard, login, reports, etc.)
├── static/                   # CSS, JS, images, fonts, debug tools
├── public/                   # PWA manifest, icons
├── admin-dashboard/          # React admin app source
├── bundle/                   # Webpack output
├── translations/             # 35+ language JSON files
├── scripts/                  # Migration, setup, test data scripts
├── config/                   # Feature flags
├── tests/                    # Mocha + Chai test suite
├── docs/                     # Documentation
├── prompts/                  # Session prompts for future work
├── tools/                    # Utility scripts
└── webpack/                  # Webpack config
```
