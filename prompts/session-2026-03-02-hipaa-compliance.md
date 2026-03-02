# Diabeetech — HIPAA Compliance Implementation

## Session Goal

Implement HIPAA compliance for the Diabeetech multi-tenant CGM monitoring platform. Work through the remediation phases below systematically, starting with Phase 1 (Critical). Build, test, commit, and push after each major task.

## What Is This App?

Diabeetech (codebase: `btech`) is a **multi-tenant Continuous Glucose Monitor (CGM) remote monitoring platform** built on Nightscout v15.0.2. It allows diabetics and their caregivers to view real-time blood glucose data from Dexcom devices through individual web dashboards.

- **Repository:** `https://github.com/valkolimark/diabeetech-dash.git`
- **Production:** Heroku (app name: `btech`) with MongoDB Atlas
- **Local Staging:** `http://staging.localhost:1337` (MongoDB local, Node 20 via nvm)
- **Full docs:** `docs/APP-OVERVIEW.md`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v20 LTS (via nvm) |
| Framework | Express.js 4.18 |
| Database | MongoDB (per-tenant isolation) |
| Real-Time | Socket.io 4.6 |
| Admin Dashboard | React 18 + Material-UI 5 + React Query (webpack-bundled) |
| Auth | JWT + bcryptjs + API Secret (SHA-1) |
| CGM Integration | Dexcom Share Bridge (per-tenant polling) |
| Deployment | Heroku (400MB heap limit) |

## Architecture

### Multi-Tenant Model

```
Request → Subdomain Routing → Tenant Resolver Middleware → Isolated Tenant DB
```

- **Master DB** (`nightscout_master_staging`): `tenants`, `users`, `admin_audit` collections
- **Per-Tenant DBs** (`nightscout_staging_tenant_{subdomain}`): `entries`, `treatments`, `devicestatus`, `profile`, `food`, `settings`, `activity`
- **Bridge Manager**: Per-tenant Dexcom Share bridge instances with independent credentials and polling

### Active Tenants (Staging)

| Name | Subdomain | Dexcom | Bridge |
|------|-----------|--------|--------|
| Ari Marco | arimarco | ari@p5400.com | Running |
| Jordan Marco | jordan | jordanmarco2323 | Running |
| Mark Mireles | onepanman | mark@markmireles.com | Running |

### Key Server Files

| File | Purpose |
|------|---------|
| `server.js` | Entry point |
| `lib/server/app-multitenant.js` | Express app setup, middleware chain, route mounting |
| `lib/server/bootevent-multitenant.js` | Boot sequence, initializes ctx, bridgeManager, connectionManager |
| `lib/server/websocket-multitenant.js` | Socket.io multi-tenant handler |
| `lib/middleware/tenantResolver.js` | Subdomain → tenant DB routing |
| `lib/middleware/auth.js` | JWT auth, token generation, role checks |
| `lib/middleware/rateLimit.js` | Rate limiting (disabled in dev) |
| `lib/middleware/captcha.js` | hCaptcha middleware |
| `lib/models/tenant.js` | Tenant model (findBySubdomain, findById, listActive, create) |
| `lib/models/user.js` | User model (bcrypt passwords, RBAC roles) |
| `lib/models/tenant-settings.js` | AES-256-CBC encryption for Dexcom credentials |
| `lib/utils/connectionManager.js` | MongoDB connection pooling, per-tenant DB access |
| `lib/services/bridge-manager.js` | Bridge lifecycle (init, restart, stop, getStatus) |
| `lib/plugins/bridge-multitenant.js` | Per-tenant Dexcom Share polling |

### Admin API (`/api/v1/admin/`)

| Endpoint | File |
|----------|------|
| `POST /auth/login` | `lib/api/admin/index.js` |
| `GET/POST /tenants` | `lib/api/admin/tenants.js` |
| `POST /tenants/create-full` | `lib/api/admin/create-tenant.js` |
| `GET/PUT /bridges/:tenantId` | `lib/api/admin/bridges.js` |
| `POST /bridges/:tenantId/restart\|stop` | `lib/api/admin/bridges.js` |
| `GET /glucose/overview` | `lib/api/admin/glucose.js` |
| `GET/POST/PUT/DELETE /users` | `lib/api/admin/users.js` |
| `GET /analytics/*` | `lib/api/admin/analytics.js` |
| `GET /system/*` | `lib/api/admin/system.js` |
| `GET /audit` | `lib/api/admin/audit.js` |
| `GET /dashboard/*` | `lib/api/admin/dashboard.js` |

### Admin Dashboard (React)

| Page | File |
|------|------|
| Dashboard | `admin-dashboard/src/pages/Dashboard.js` |
| Tenants (with Create form) | `admin-dashboard/src/pages/Tenants.js` |
| Users | `admin-dashboard/src/pages/Users.js` |
| Dexcom Bridges | `admin-dashboard/src/pages/DexcomCredentials.js` |
| Glucose Overview | `admin-dashboard/src/pages/GlucoseOverview.js` |
| Analytics | `admin-dashboard/src/pages/Analytics.js` |
| System | `admin-dashboard/src/pages/System.js` |
| Audit Logs | `admin-dashboard/src/pages/AuditLogs.js` |
| Settings | `admin-dashboard/src/pages/Settings.js` |
| Layout/Sidebar | `admin-dashboard/src/components/Layout/Layout.js` |
| API Service | `admin-dashboard/src/services/api.js` |
| Auth Service | `admin-dashboard/src/services/auth.js` |
| Webpack Config | `admin-dashboard/webpack.config.js` |

Build: `cd admin-dashboard && npm run build` (outputs to `static/admin/js/` and `views/admin-dashboard.html`)

### User-Facing Pages

| Page | File |
|------|------|
| Login | `views/login.html` → `POST /api/auth/login` |
| Registration | `views/register.html` → `POST /api/register` |
| Registration API | `lib/api/tenants/register-enhanced.js` |
| Auth API | `lib/api/auth/index.js` |

### Environment

| Variable | Staging Value |
|----------|--------------|
| `MULTI_TENANT_ENABLED` | `true` |
| `MONGODB_URI` | `mongodb://localhost:27017/nightscout_staging` |
| `MASTER_MONGODB_URI` | `mongodb://localhost:27017/nightscout_master_staging` |
| `TENANT_DB_PREFIX` | `nightscout_staging_tenant_` |
| `API_SECRET` | `staging-local-secret-12345` |
| `JWT_SECRET` | `staging-jwt-secret-32chars-longenough` |
| `BASE_DOMAIN` | `localhost` |
| `PORT` | `1337` |
| `INSECURE_USE_HTTP` | `true` |
| `SECURE_HSTS_HEADER` | `false` |
| `SECURE_CSP` | `false` |
| `RATE_LIMIT_ENABLED` | `false` |

Start server: `cd /Users/cr-markmireles/Documents/Projects/btech && source ~/.nvm/nvm.sh && nvm use 20 && npx env-cmd -f .env node server.js`

Admin login: `admin@staging.local` / `admin123` (superadmin in master DB `users` collection)

---

## HIPAA Compliance Audit Results

A full security audit was completed on 2026-03-01. **30 issues found: 5 passing, 12 partial, 18 failing.**

### What's Already Passing

- Passwords hashed with bcrypt (10 rounds) — `lib/models/user.js`
- Dexcom credentials encrypted with AES-256-CBC — `lib/models/tenant-settings.js`
- Separate MongoDB databases per tenant (data isolation)
- Admin audit logging for CRUD operations — `lib/api/admin/audit.js`
- Helmet.js security headers (partial) — `lib/server/app-multitenant.js`

### What's Failing — Remediation Plan

---

## Phase 1 — Critical (Week 1)

### 1.1 Add TOTP-Based MFA (2FA)

**Problem:** No multi-factor authentication. HIPAA requires MFA for remote PHI access.

**Implementation:**
- Add `speakeasy` and `qrcode` npm packages
- Add `totpSecret` and `mfaEnabled` fields to user model (`lib/models/user.js`)
- Create MFA setup endpoint: `POST /api/auth/mfa/setup` — generates TOTP secret, returns QR code
- Create MFA verify endpoint: `POST /api/auth/mfa/verify` — validates 6-digit TOTP code
- Modify login flow (`lib/api/auth/index.js` and `lib/api/admin/index.js`):
  - After password check, if `mfaEnabled`, return `{ requiresMfa: true }` instead of token
  - Require `POST /auth/mfa/verify` with TOTP code to get JWT token
- Add MFA setup page to admin dashboard
- Add MFA verification step to login pages (`views/login.html`, `admin-dashboard/src/pages/Login.js`)

### 1.2 Implement Account Lockout

**Problem:** No lockout after failed login attempts. Vulnerable to brute force.

**Implementation:**
- Add `failedAttempts` and `lockedUntil` fields to user model
- In login handlers (`lib/api/auth/index.js`, `lib/api/admin/index.js`):
  - Check `lockedUntil` before password compare
  - On failure: increment `failedAttempts`, set `lockedUntil` after 5 failures (15-minute lockout)
  - On success: reset `failedAttempts` and `lockedUntil`
- Log all lockout events to audit trail

### 1.3 Fix CORS — Remove Wildcard Origin

**Problem:** `lib/server/app-multitenant.js:179` sets `Access-Control-Allow-Origin: *`. Any website can make authenticated API requests.

**Implementation:**
- Replace wildcard with explicit allowed origins from env var `CORS_ALLOWED_ORIGINS`
- Default to `BASE_DOMAIN` subdomains only
- Add `credentials: true` and `sameSite: 'Strict'` for cookie-based auth

### 1.4 Remove PHI from Console Logs

**Problem:** Glucose values, SGV data, and patient info logged to stdout via `console.log`.

**Files to audit and clean:**
- `lib/middleware/tenantDataloader.js` — logs `Last SGV:` with actual glucose value
- `lib/server/websocket-multitenant.js` — logs socket auth data
- `lib/services/bridge-manager.js` — logs bridge fetch results
- `lib/api/admin/glucose.js` — may log readings
- Search all files for `console.log` containing SGV, glucose, entries, or patient data

**Rule:** Never log PHI. Log event types, tenant IDs, and counts only — never values.

### 1.5 Secure .env and Backup Files

**Problem:** `.env` with secrets and `.backup` files exist in the repo.

**Implementation:**
- Add to `.gitignore`: `.env`, `.env.*`, `*.backup*`, `*.backup-*`
- Remove `.env` from git tracking: `git rm --cached .env`
- Create `.env.example` with placeholder values
- Remove `lib/server/app-multitenant.js.backup-20250725-172801`
- Remove `_dev-scripts/data/backup-heroku-v209-20250725-192206.txt`

### 1.6 Patch Vulnerable Dependencies

**Problem:** 36 known vulnerabilities including critical (axios CSRF/SSRF, form-data unsafe random).

**Implementation:**
- Run `npm audit` to list all vulnerabilities
- Run `npm audit fix` for auto-fixable issues
- Manually update: `axios` to latest, `braces`, `elliptic`, `follow-redirects`
- Document any unfixable vulnerabilities with risk acceptance

---

## Phase 2 — High Priority (Weeks 2-4)

### 2.1 Enforce TLS on MongoDB Connections

**Problem:** MongoDB connections use plaintext (`mongodb://localhost:27017`). PHI transmitted unencrypted.

**Implementation:**
- Production: Update MongoDB Atlas URI to include `?tls=true&retryWrites=true&w=majority`
- Update `lib/utils/connectionManager.js` default options to include TLS
- Local dev: acceptable without TLS, but document the exception

### 2.2 Reduce JWT Token Lifetime

**Problem:** 24-hour JWT expiry is too long. Stolen tokens valid all day.

**Implementation:**
- Reduce access token TTL to 15 minutes (`lib/middleware/auth.js`)
- Keep refresh token at 7 days but rotate on each use
- Implement token blacklist on logout (Redis or MongoDB `blacklisted_tokens` collection)
- Update `lib/api/auth/index.js` and `lib/api/admin/index.js`

### 2.3 Add PHI Access Logging

**Problem:** No audit trail for who viewed glucose data.

**Implementation:**
- Create middleware `lib/middleware/phiAccessLog.js`
- Log to `phi_access_log` collection: `{ userId, tenantId, action, resource, timestamp, ipAddress }`
- Attach to all data-reading endpoints: entries, treatments, devicestatus, profile
- Make collection append-only (no delete endpoint)

### 2.4 Enforce Password Complexity

**Problem:** Only 8-character minimum. No complexity requirements.

**Implementation:**
- Minimum 12 characters, require uppercase + lowercase + number + special character
- Update validation in: `lib/models/user.js`, `lib/api/admin/users.js`, `lib/api/tenants/register-enhanced.js`, `lib/api/admin/create-tenant.js`
- Add password history (prevent reuse of last 5 passwords)

### 2.5 Secure Cookie Flags

**Problem:** Admin cookies missing `sameSite`, `secure` only in production.

**Implementation:**
- All cookies: `httpOnly: true`, `secure: true`, `sameSite: 'Strict'`
- Reduce cookie maxAge to match JWT TTL
- Update `lib/api/admin/index.js` cookie settings

### 2.6 Remove Hardcoded Secret Fallbacks

**Problem:** `lib/middleware/auth.js` falls back to `'nightscout-multitenant-secret'` if env vars missing.

**Implementation:**
- Remove all fallback defaults for JWT_SECRET, API_SECRET, SESSION_SECRET
- Fail server startup if required secrets are not set
- Add startup validation in `lib/server/bootevent-multitenant.js`

### 2.7 Encrypt API Secrets at Rest

**Problem:** `lib/models/tenant.js` stores plaintext API secrets in MongoDB.

**Implementation:**
- Store only the bcrypt hash (already stored as `apiSecretHash`)
- Remove plaintext `apiSecret` field from tenant documents
- Update all code that reads `tenant.apiSecret` to use hash comparison instead

---

## Phase 3 — Medium Priority (Month 2)

### 3.1 Implement Immutable Audit Log Retention (6 Years)

- Set minimum retention to 6 years per HIPAA
- Remove the `DELETE /audit/cleanup` endpoint or restrict to archival only
- Write audit logs to append-only storage (separate collection with no delete permissions)

### 3.2 Add User Data Export API (Right of Access)

- `GET /api/v1/export/my-data` — returns all PHI for the authenticated user as JSON/CSV
- Include: entries, treatments, devicestatus, profile
- Audit log the export event

### 3.3 Implement Hard Delete for PHI

- Add `DELETE /api/v1/my-data` endpoint for user-initiated data deletion
- Purge all entries, treatments, devicestatus from tenant DB
- Audit log the deletion event
- Retain audit log (not PHI) for compliance

### 3.4 Enable CSP Headers Everywhere

- Set `SECURE_CSP=true` in all environments
- Configure strict CSP policy in `lib/server/app-multitenant.js`
- Fix `frameguard: false` → `frameguard: { action: 'deny' }`

### 3.5 Remove Query Parameter Tenant Resolution

- In `lib/middleware/tenantResolver.js`, remove Method 3 (query parameter `?tenant=`)
- This prevents cross-tenant access by URL manipulation
- Keep subdomain and header methods only

### 3.6 Input Validation with Schema

- Add `joi` for request body validation on all API endpoints
- Validate types, lengths, and formats for all user input
- Sanitize error messages — never expose internal details to clients

---

## Phase 4 — Long-Term (Month 3+)

- Business Associate Agreement (BAA) template and workflow
- Breach notification system (email alerts within 60 days per HIPAA)
- Penetration testing by third party
- SOC 2 Type II certification
- Formal HIPAA Security Rule gap analysis documentation
- Data residency controls (US-only storage)
- Automated security scanning pipeline (npm audit, OWASP ZAP in CI)

---

## Working Conventions

- **Start server:** `cd /Users/cr-markmireles/Documents/Projects/btech && source ~/.nvm/nvm.sh && nvm use 20 && npx env-cmd -f .env node server.js`
- **Rebuild admin dashboard:** `cd admin-dashboard && npm run build`
- **Hosts file:** `staging.localhost`, `arimarco.localhost`, `jordan.localhost`, `onepanman.localhost` → `127.0.0.1`
- **Commit messages include:** `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- **Push to:** `git push origin main` (GitHub: valkolimark/diabeetech-dash)
- **User preference:** "I want you to do all the work. Just ask me for credentials."
