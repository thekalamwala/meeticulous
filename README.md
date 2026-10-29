# Meeticulous

A multi-tenant appointment-booking SaaS. **Hosts** (creators / service providers) publish services, set their availability, and receive paid bookings. **Guests** discover a host's public profile, book a slot via OTP or a logged-in account, and pay through Razorpay. A role-based **Admin** panel runs the platform (users, payouts, plans, content, support).

> Think Calendly + Gumroad + Razorpay with a built-in admin back office.

This repo is a **monorepo**: a Vite/React frontend (`client/`) and a Node/Express API (`server/`) that both talk to a single Supabase (Postgres + Auth + Storage) project.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database & migrations](#database--migrations)
- [Running tests](#running-tests)
- [Key routes](#key-routes)
- [User roles](#user-roles)
- [Plans & billing](#plans--billing)
- [Integrations](#integrations)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Project status](#project-status)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, react-router-dom v6 |
| Backend | Node.js **22.x** + Express 4 |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Payments | Razorpay (one-off orders + subscriptions) |
| Transactional email | SMTP (Nodemailer); Resend supported |
| Marketing / CRM email | Brevo HTTP API (port 443 — PaaS hosts block outbound SMTP) |
| Calendar | Google Calendar API (OAuth) |
| File uploads | Supabase Storage |
| Analytics / errors | PostHog, Sentry (both optional, off until keys set) |
| Hosting | API on **Render**, frontend on **Vercel** |

---

## Repository layout

```
.
├── client/              # React SPA (Vite)   — deploys to Vercel
│   ├── src/
│   │   ├── pages/        # Route-level components (public, dashboard, admin, onboarding)
│   │   ├── components/   # Shared layout + guard components
│   │   ├── context/      # Global auth state (AuthContext)
│   │   ├── services/     # api.js (HTTP client) + supabaseClient.js
│   │   └── styles/       # Tailwind tokens + component classes
│   ├── public/          # Static assets, robots.txt
│   ├── middleware.js    # Vercel Edge middleware (permanent-username 301s)
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/              # Express API        — deploys to Render
│   ├── server.js        # App entry (listens on PORT, default 5000; /health)
│   ├── controllers/     # Business logic, one file per domain
│   ├── routes/          # Express routers
│   ├── middleware/       # auth, plan gating, security, rate limiting, errors
│   ├── services/        # Badge engine, notification engine, email engine, plans
│   ├── lib/             # pricingEngine.js, adminPermissions.js, …
│   ├── config/          # supabase.js client, schema.sql (base schema)
│   ├── migrations/      # Incremental SQL (v1.1 → v3.99)
│   ├── scripts/         # migrate.js runner, seed scripts, load-test tools
│   └── tests/           # unit/ + integration/ (Jest)
├── supabase/migrations/ # Supabase-managed migrations
├── scripts/             # Repo-level tooling
├── smoke/               # Post-deploy smoke tests
├── performance/         # Load-test harness + reports
├── docs/                # Full project documentation (see below)
├── render.yaml          # Render Blueprint (API prod + staging, client staging)
└── DEPLOYMENT.md        # Step-by-step production bring-up
```

> Note: `client/` and `server/` are at the repo **root** — there is no `appointment-booking/` wrapper folder.

---

## Prerequisites

- **Node.js 22.x** (the server pins `engines.node = "22.x"`; Render builds on Node 22)
- A **Supabase** project (free tier is fine for local dev)
- A **Razorpay** account with **test** keys
- SMTP credentials for transactional email (a Gmail app password works for local)

Optional integrations (Google Calendar, Brevo, PostHog, Sentry, etc.) are all off until their keys are set — you can boot and use the app without them.

---

## Local setup

### 1. Clone & install

```bash
git clone https://github.com/thekalamwala/meeticulous.git
cd meeticulous

# install both apps (separate package.json each)
cd server && npm install
cd ../client && npm install
cd ..
```

### 2. Configure environment

```bash
# Server
cp server/.env.example server/.env
# Fill in at minimum: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#   SMTP_*, RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET,
#   SUPER_ADMIN_JWT_SECRET, SUPER_ADMIN_EMAIL

# Client
cp client/.env.example client/.env
# Fill in: VITE_API_URL (http://localhost:5000), API_ORIGIN,
#   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

Both `.env.example` files are fully commented — read them, they explain every variable and which are secret. See [Environment variables](#environment-variables) below for the short list needed to boot.

### 3. Set up the database

Point your `server/.env` at a Supabase project, then apply the schema. See [Database & migrations](#database--migrations) for the full picture; [docs/DATABASE.md](docs/DATABASE.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) are the authoritative references.

### 4. Seed reference data

```bash
cd server
node scripts/seedEmailTemplates.js      # email templates (required for email flows)
node scripts/seedServiceCategories.js   # service categories
# others as needed: seedBotFaqs.js, seedBlogs.js, seedKnowledgeBase.js, …
```

### 5. Run

```bash
# Terminal 1 — API (http://localhost:5000, health at /health)
cd server && npm run dev        # nodemon server.js

# Terminal 2 — frontend (http://localhost:5173)
cd client && npm run dev        # vite
```

Open **http://localhost:5173**.

---

## Environment variables

Every variable is documented inline in `server/.env.example` and `client/.env.example`. The essentials to boot locally:

**Server (`server/.env`)**

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` locally, `production` on Render |
| `PORT` | API port (default `5000`; Render injects its own) |
| `CLIENT_URL` | Canonical frontend origin — locks CORS (`http://localhost:5173` locally) |
| `API_URL` | Public API origin (`http://localhost:5000` locally) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public (browser-safe) key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — full DB access, server only. Accepts the legacy `service_role` JWT **or** a new-format `sb_secret_…` key |
| `SUPER_ADMIN_JWT_SECRET` | Signs admin-panel JWTs |
| `SUPER_ADMIN_EMAIL` | Bootstraps the first admin |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payments (use **test** keys locally) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Transactional email |

**Client (`client/.env`)** — anything prefixed `VITE_` is **bundled into the public browser bundle**, so only publishable keys go here:

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base, including `/api` in prod (`http://localhost:5000` locally) |
| `API_ORIGIN` | API base **without** `/api` — used by the Vercel edge middleware |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable anon key (browser-safe) |

> The Razorpay `key_id` is **not** a client env var — the API serves it at checkout time from Admin → Settings → Payment (DB-backed).

Never commit real values. `.env` files are git-ignored.

---

## Database & migrations

The database is **Supabase Postgres**. Schema is split into:

- `server/config/schema.sql` — base tables.
- `server/migrations/*.sql` — incremental migrations, **v1.1 → v3.99** (220 files), applied in version order.
- `supabase/migrations/` — Supabase-managed migrations.

**Migration runner** — `server/scripts/migrate.js` applies **one SQL file** to a target environment using the `DATABASE_URL` in that env's file (`.env` for prod, `.env.staging` for staging). `DATABASE_URL` is the Supabase **Session-mode** pooler URI (port `5432`).

```bash
cd server
node scripts/migrate.js staging path/to/migration.sql   # apply one file to staging
node scripts/migrate.js prod    path/to/migration.sql    # apply one file to prod
node scripts/migrate.js staging --seed                   # first-time: apply the full schema dump
```

`npm run migrate:staging` / `npm run migrate:prod` wrap these. For the exact first-time bring-up order and RLS notes, follow [docs/DATABASE.md](docs/DATABASE.md) and [docs/init-prod-db.md](docs/init-prod-db.md).

> RLS is enabled across the schema with a service-role-only write model — all privileged writes go through the server using `SUPABASE_SERVICE_ROLE_KEY`, never the browser.

---

## Running tests

```bash
# Server (Jest)
cd server
npm test                 # all tests
npm run test:unit        # unit only (what gates deploys)
npm run test:integration # integration — hits live Supabase/SMTP; do NOT run against prod
npm run test:coverage

# Client (Vitest)
cd client
npm test                 # vitest run
npm run test:coverage
```

CI and the Render build run **`npm run test:unit`** only — integration tests touch live services with real credentials, so they are never part of an automated deploy gate. See [docs/TESTING.md](docs/TESTING.md).

---

## Key routes

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/:username` | Public host profile |
| `/:username/booking/:serviceSlug` | Guest booking flow |
| `/:username/badges` | Host badge showcase |
| `/dashboard` | Host dashboard (auth required) |
| `/vendor-register` | Multi-step host onboarding |
| `/hello-sloth` | Admin login |
| `/super-dashboard` | Admin operations center |
| `/admin/*` | Admin panel sections |

> `/hello-sloth` is the real, deliberately obscure admin login path (defined in `client/src/App.jsx` and the reserved-namespace config). It is a route, not branding — leave it unless you intend to change it in code everywhere it appears.

---

## User roles

| Role | Description |
|---|---|
| **Host / Vendor** | Creator who publishes services and receives bookings |
| **Guest / User** | Books services; may or may not have an account |
| **Admin** | Platform staff, with RBAC-scoped permissions |

Admin sub-roles: `superadmin`, `operations`, `finance`, `support`, `content`, `technical`. Admins sign in at `/hello-sloth`.

---

## Plans & billing

Paid plans bill **monthly or annually**, auto-renewing via Razorpay Subscriptions (GST charged on top). Prices and limits are **admin-editable** in **Admin → Subscription Plans** — the table below is the default shape, not a source of truth.

| Plan | Commission | Services | Products |
|---|---|---|---|
| Starter (free) | 5% | 3 | 0 |
| Creator | 0% | 15 | 5 |
| Professional | 0% | Unlimited | Unlimited |

Switching tier or cadence prorates remaining value into free days on the new plan. For going live with subscription billing + webhooks, see [docs/razorpay-webhook-setup.md](docs/razorpay-webhook-setup.md) and [docs/payment-model.md](docs/payment-model.md).

---

## Integrations

| Integration | Role | Notes |
|---|---|---|
| **Razorpay** | Payments | Orders + subscriptions. Key id served by the API at checkout, not the client. |
| **SMTP / Resend** | Transactional email | OTP, booking confirmations, receipts. |
| **Brevo** | Marketing / CRM email | HTTP API over 443 — Render blocks outbound SMTP ports. Sending domain must pass SPF/DKIM. |
| **Google Calendar** | Availability + event writes | OAuth; refresh tokens encrypted at rest (`GOOGLE_TOKEN_KEY`). |
| **PostHog** | Product analytics | Optional; off until token set. |
| **Sentry** | Error tracking | Optional; off until `SENTRY_DSN` set. |

Marketing/ad tags (GA4, Meta Pixel/CAPI, Clarity, GTM) load **only after consent** and are all opt-in via env. See the inline docs in `server/.env.example`.

---

## Deployment

- **API → Render.** `render.yaml` is a Blueprint defining the prod API (`starter`, always-on, from `main`) and the staging API + static client (`free`, from the `staging` branch). Build runs `npm ci && npm run test:unit`; health check is `/health`. Secrets are `sync: false` — set them once in the Render dashboard.
- **Frontend → Vercel.** The client builds with `npm run build` (Vite build + prerender/OG step). Env vars live in Vercel Project Settings.

Full step-by-step bring-up (DNS, separate prod/staging Supabase, OAuth callbacks, webhooks) is in [DEPLOYMENT.md](DEPLOYMENT.md).

> **Heads-up for this repo right now:** the `deploy-vercel.yml` GitHub Action will fail on each push to `main` until the real Vercel project IDs + `VERCEL_TOKEN` are set as repo secrets (see DEPLOYMENT.md). No production deploy happens until Render and Vercel are connected. A **staging Supabase project does not exist yet** — create it before the staging services can boot (DEPLOYMENT.md Phase 2).

---

## Documentation

| File | Covers |
|---|---|
| [docs/PRODUCT_OVERVIEW.md](docs/PRODUCT_OVERVIEW.md) | Vision, user types, business model |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, auth flows, data flows |
| [docs/CODEBASE_GUIDE.md](docs/CODEBASE_GUIDE.md) | Every module explained, coding rules |
| [docs/DATABASE.md](docs/DATABASE.md) | Tables, columns, RLS, migration history |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | All endpoints with request/response shapes |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local dev, env vars, common workflows |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Build + production deployment |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth model, rate limiting, secrets |
| [docs/TESTING.md](docs/TESTING.md) | Test structure, how to run, coverage |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev workflow, PR process, conventions |
| [docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md) | On-call / operational procedures |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's planned and prioritised |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | What's done, in progress, blockers |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Release notes |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architectural decisions and rationale |

---

## Project status

Meeticulous is a fork/clone of an established production codebase, being stood up as its own product. Live, current state — what's done, in progress, and blocked — is tracked in [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md). Deployment wiring (Vercel/Render/Supabase) is the current open work; see the heads-up under [Deployment](#deployment).
