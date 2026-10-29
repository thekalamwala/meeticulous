# Book A Sloth

A multi-tenant appointment-booking SaaS. Hosts (creators) publish services, set availability, and receive paid bookings. Guests discover profiles, book via OTP or account login, and pay through Razorpay.

> Think Calendly, Gumroad, Razorpay and Google had baby.

---

## Quick Start (30 minutes to productive)

### Prerequisites
- Node.js ≥ 18
- A Supabase project (free tier works)
- Razorpay test account
- Any SMTP credentials (Gmail app password works)

### 1. Clone & Install
```bash
git clone <repo-url>
cd appointment-booking
cd server && npm install
cd ../client && npm install
```

### 2. Configure Environment
```bash
# Server
cp server/.env.example server/.env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
#          SMTP_*, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
#          SUPER_ADMIN_JWT_SECRET, SUPER_ADMIN_EMAIL

# Client
cp client/.env.example client/.env   # if example exists
# Fill in: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# (Razorpay key id is NOT a client env var — it's configured in
#  Admin → Settings → Payment and served by the API at checkout.)
```

### 3. Set Up Database
Run these SQL files in order in your Supabase SQL Editor:
```
server/config/schema.sql          ← base tables
server/migrations/v1.6_catchup.sql ← all columns through v1.6
server/migrations/v1.7_pricing_snapshot.sql  ← commission_applied column
server/migrations/v1.8_vendor_onboarding.sql
server/migrations/v1.9_notification_system.sql
server/migrations/v2.0_badge_system.sql
server/migrations/v2.1_subscription_plans.sql
server/migrations/v2.2_payout_model.sql
server/migrations/v2.3_email_communication_engine.sql
server/migrations/v2.4_admin_rbac.sql
```

### 4. Seed Email Templates
```bash
cd server && node scripts/seedEmailTemplates.js
```

### 5. Run
```bash
# Terminal 1 — API server (port 5000)
cd server && npm run dev

# Terminal 2 — React dev server (port 5173)
cd client && npm run dev
```

Open **http://localhost:5173** — the app is running.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, react-router-dom v6 |
| Backend | Node.js + Express 4 |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Payments | Razorpay (orders + subscriptions) |
| Email | Nodemailer / Resend / AWS SES (pluggable) |
| WhatsApp | AiSensy (DB-configured, no hardcoded keys) |
| Uploads | Supabase Storage |
| Calendar | Google Calendar API |

---

## Repository Structure

```
appointment-booking/
  client/                     # React SPA (Vite)
    src/
      pages/                  # Route-level components
        admin/                # Admin panel pages (30+)
        onboarding/           # 10-step vendor onboarding flow
        services/             # Service CRUD pages
      components/common/      # Shared layout & guard components
      context/AuthContext.jsx  # Global auth state
      services/               # api.js + supabaseClient.js
      utils/themeUtils.js     # Color utilities
      styles/                 # CSS tokens + component classes
  server/                     # Express API
    controllers/              # Business logic (one file per domain)
    routes/                   # Express routers
    middleware/               # auth, plan, security, error, maintenance
    config/                   # Supabase client, Google OAuth, email templates
    lib/                      # pricingEngine.js, adminPermissions.js
    services/                 # Badge engine, notification engine, email engine, plan service
    migrations/               # v1.1 → v2.4 SQL files
    utils/                    # otpStore.js, sendEmail.js, notify.js, logger.js
    tests/                    # unit/ + integration/
  docs/                       # Project documentation (this folder)
  supabase/migrations/        # Additional Supabase-managed migrations
```

---

## Key URLs

| URL | What it is |
|---|---|
| `/` | Landing page |
| `/:username` | Public host profile |
| `/:username/booking/:serviceSlug` | Guest booking flow |
| `/:username/badges` | Host badge showcase |
| `/dashboard` | Host dashboard (auth required) |
| `/vendor-register` | 10-step vendor onboarding |
| `/hello-sloth` | Admin login |
| `/super-dashboard` | Admin operations center |
| `/admin/*` | Admin panel sections |

---

## Documentation

| File | What it covers |
|---|---|
| [docs/PRODUCT_OVERVIEW.md](docs/PRODUCT_OVERVIEW.md) | Vision, user types, business model |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, auth flows, data flows |
| [docs/CODEBASE_GUIDE.md](docs/CODEBASE_GUIDE.md) | Every module explained, coding rules |
| [docs/DATABASE.md](docs/DATABASE.md) | All tables, columns, RLS, migration history |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | All API endpoints with request/response shapes |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local dev, env vars, common workflows |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Build + production deployment |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth model, rate limiting, secrets |
| [docs/TESTING.md](docs/TESTING.md) | Test structure, how to run, coverage |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev workflow, PR process, conventions |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's planned and prioritised |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | What's done, in-progress, blockers |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Release notes by sprint |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architectural decisions and rationale |

---

## Running Tests

```bash
# Server (Jest)
cd server && npm test              # all tests
cd server && npm run test:unit     # unit tests only
cd server && npm run test:coverage # with coverage report

# Client (Vitest)
cd client && npm test              # all tests
```

Current passing: **205 server / 112 client** (as of 2026-06-11).

---

## User Roles

| Role | Description |
|---|---|
| **Host / Vendor** | Creator who publishes services and receives bookings |
| **Guest / User** | Books services; may or may not have an account |
| **Admin** | Platform staff with RBAC-controlled permissions |

Admin roles: `superadmin`, `operations`, `finance`, `support`, `content`, `technical`. Login at `/hello-sloth`.

---

## Plans

Paid plans bill **monthly or annually**, both auto-renewing via Razorpay
Subscriptions (GST charged on top; annual is the better deal). Prices are
admin-editable in **Admin → Subscription Plans**.

| Plan | Monthly | Annual | Commission | Services | Products |
|---|---|---|---|---|---|
| Starter (free) | — | ₹0 | 5% | 3 | 0 |
| Creator | ₹199/mo | ₹999/yr | 0% | 15 | 5 |
| Professional | ₹499/mo | ₹3,650/yr | 0% | Unlimited | Unlimited |

Vendors pick a cadence at checkout; switching tier/cadence prorates remaining
value into free days on the new plan. See
[docs/razorpay-webhook-setup.md](docs/razorpay-webhook-setup.md) for going live
with subscription billing.

---

## ⚠️ Known Gaps

- Guest booking history page (`/my-bookings`) redirects to vendor dashboard (BUG-18)
- Review submission UI not yet built (API exists)
- Admin payout approval workflow is partial
- `avg_response_time_minutes` and `login_streak` badge metrics return 0 (no data source)
