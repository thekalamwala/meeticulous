# Meeticulous — Handover Document

_Prepared 2026-10-27. Covers the whole `appointment-booking` repository: what it is, what's live, how it ships, what's half-built, and what will bite the next person._

> **How to use this doc.** Part 1 is for a founder / non-technical reader — the business picture, what's live, what's at risk, what decisions are pending. Part 2 is for the incoming developer — architecture, deploy pipeline, database, and the landmines that have caused real outages. The older docs in `docs/` (listed at the end) stay the deep reference; this file is the map.

---

# PART 1 — Executive summary (for the founder / business reader)

## What Meeticulous is

A SaaS appointment-booking platform. **Hosts** (creators, coaches, consultants, salons, clinics) sign up, publish services with prices and availability, and get a public page. **Guests** book those services — either with a one-time phone/email OTP or logged in — and pay through **Razorpay**. The platform takes a cut (platform fee + commission on the free tier) and runs the money, notifications, and payouts around it.

One-line positioning the team settled on: *"the calm way to sell your time."*

## The shape of the product today

| Area | State |
|---|---|
| Guest booking + payment (Razorpay) | **Live, core revenue flow.** OTP booking, logged-in booking, pricing snapshots, Google Meet creation, confirmation email + WhatsApp. |
| Host dashboard | **Live.** Services, availability, bookings, earnings, payouts, profile, digital products. |
| Plans / subscriptions | **Live.** Three tiers (see below) billed via Razorpay. |
| Host KYC | **Live.** 4-step flow, encrypted PAN/Aadhaar/bank, gates payouts. |
| Notifications (email + WhatsApp + in-app bell) | **Live, one unified engine.** |
| Admin panel | **Live.** Users, bookings, finance, campaigns, support, content, settings. |
| Blog (`/blog`) | **Live, DB-backed,** build-in-public content. |
| Public SEO pages (`/for/*`, `/features/*`, `/compare/*`, `/services/*`) | **Live,** heavy ongoing SEO/landing-page work. |
| Support bot ("Bolt") | **Live,** answers from our own docs, escalates to a human. |
| CRM / outreach (email + WhatsApp campaigns + relationship engine) | **Live and actually sending to real customers** — see the risk note below. |
| Financial ledger (double-entry accounting) | **Phase 1 only, on an unmerged branch.** Settlement/refund/reporting phases not built. |

## Plans and pricing

Database slugs are `starter` / `creator` / `professional`; the **brand names shown in the UI are Starter / Host+ / Studio** (slugs were deliberately kept to avoid a risky rename).

- **Starter** — ₹0. 3 services, 300 bookings/yr, 1 digital product, **5% commission** on amounts over ₹200 (after a 30-day grace period).
- **Host+** (`creator`) — ₹229/mo or ₹1,499/yr. 0% commission.
- **Studio** (`professional`) — ₹555/mo or ₹3,650/yr. 0% commission, unlimited everything.
- There is a hidden `supreme` god-tier (inactive).

> ⚠️ **Pricing numbers drift between docs.** The live source of truth is the `subscription_plans` table, not any doc or hardcoded constant. Some older docs still show the previous ₹999/₹3,650 figures. Always confirm against the DB.

## What's genuinely live and earning

The booking → payment → payout loop is real and in production. The host activation funnel (as last measured, PR #1096) was roughly **75 signups → 9 listed services → 6 booked → 2 payouts, with GMV around ₹322.** The bottleneck is **demand** (getting from "listed a service" to "got a booking"), not the product mechanics. That is the single most important business fact in this handover: the machine works; the funnel needs traffic and demand, which is why so much recent engineering is SEO landing pages and CRM outreach.

## Risks the next owner must know about (business level)

1. **CRM outreach is sending real messages to real customers, right now.** The master kill-switch (`crm_admin_sends`) is **ON in production** (founder-enabled 2026-08-27; 100+ real messages sent). It is gated — 1 message / 48h per person, quiet hours 09:00–20:00 IST, do-not-contact and opt-out honoured — but it is not advisory-only. **To pause all outreach instantly:** flip one database flag (`crm_admin_sends` → off). The exact command is in Part 2 and in `docs/current-work.md`.

2. **Email provider is in a contested state.** Marketing email currently routes through Brevo, which is the *opposite* of a founder decision on record (Resend). This is flagged as needing resolution. Resend's free tier is also capped at 100 emails/day across *all* outreach — a real throughput ceiling.

3. **Compliance / tax is not fully settled.** The GST, TDS and TCS treatment (including whether Meeticulous is a "Merchant of Record" or a marketplace) has open questions a CA needs to confirm. There are notes that the current TDS/TCS rates may be stale. Do not treat the tax math as final.

4. **The financial ledger is half-built and unmerged.** Double-entry accounting Phase 1 exists on a branch (`sd/adoring-elgamal-625af7`) with its migrations applied to the live DB, but it was never merged to `main`, and the historical backfill has never been run on production. Settlement, refunds, and financial reporting (Phases 2–5) do not exist. If the company needs auditable books, this is unfinished work.

5. **A lot of built work is parked on unmerged branches.** Several substantial features (guest/host URL separation, dual login, service-category redesign, lead-import, pitch deck, and more) are *built and tested but never merged*. They represent real sunk effort that is currently invisible in production. Part 2 and the memory index list them.

6. **Single-founder operational knowledge.** The deploy process, the DB-flag switches, and the "landmines" are documented (well, actually) but have been operated by a very small team. Whoever takes over must read the deploy and landmines sections before touching production.

## Vendors and money flowing out the door

- **Supabase** — database, auth, storage (two projects: Mumbai = prod, Tokyo = staging).
- **Render** — hosts the backend API. Free-tier bandwidth cap has suspended the API before (looks like a CORS outage but isn't).
- **Vercel** — hosts the frontend.
- **Razorpay** — payments and subscriptions.
- **AiSensy** — WhatsApp.
- **Resend / Brevo** — email (see risk #2).
- **Anthropic** — powers the Bolt support bot.
- **Google Calendar** — Meet links on bookings.
- **PostHog, Sentry** — analytics and error tracking.
- **Cloudflare** — sits in front (edge IP handling matters — see landmines).

Support / contact addresses on file: **bolt@meeticulous.in** (support), legal/billing **team@timewheel.co.in**.

---

# PART 2 — Technical deep-dive (for the incoming developer)

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, Tailwind, react-router-dom v6, framer-motion, GSAP, PostHog |
| Backend | Node 22 + Express 4 |
| DB / Auth / Storage | Supabase (Postgres) |
| Payments | Razorpay (orders + subscriptions) |
| Email | Nodemailer (SMTP, transactional) + Resend/Brevo (bulk) |
| WhatsApp | AiSensy (DB-configured per event/provider) |
| Calendar | Google Calendar API |
| AI | Anthropic SDK (support bot) |
| Monitoring | Sentry + PostHog |

**Scale of the codebase (as of handover):** ~93 client pages, ~77 server controllers, ~50 route files, ~73 server services, **~220 migration files**. This is a large, mature application, not a prototype.

## Repo layout

```
appointment-booking/
  client/          React SPA (Vite)
    src/
      pages/       route-level components (~93)
      components/  shared UI
      context/     AuthContext
      services/    api.js (axios + 401 refresh), supabaseClient.js
      utils/       themeUtils.js, roleRoutes.js, etc.
      config/      reservedSegments.js, blogClusters.js
      data/        blogPosts.js, competitors.js
    scripts/       prerender.mjs, OG-image generators, vercelBuildOnce.mjs
  server/          Express API
    controllers/   business logic (~77)
    routes/        express routers (~50)
    middleware/    auth, admin, plan, security, maintenance, error
    services/      notificationEngine, crm/*, ledger/*, email/*, botService, etc.
    lib/           pricingEngine.js, ipBlocklist.js, adminPermissions.js
    config/        supabase.js, google.js, schema.sql, seeds
    migrations/    v1.1 → v3.1xx SQL (~220 files)
    scripts/       seeds, backfills, migrate.js, load tests
  docs/            architecture, DB, current-state/work, landmine docs
```

## How the three pieces connect

```
React SPA ──Bearer JWT──> Express API (port 5000) ──service-role──> Supabase (Postgres)
   │                          │
   │                          ├─ Razorpay (orders + HMAC-verified webhooks)
   │                          ├─ Google Calendar (Meet events)
   │                          ├─ AiSensy (WhatsApp)
   │                          ├─ Resend/Brevo/SMTP (email)
   │                          └─ Anthropic (Bolt bot)
   └─ Supabase JS SDK (auth state listener only) + Razorpay checkout widget
```

Crons run as `setInterval` in `server.js`: reminders every 5 min, OTP cleanup + email queue + badge engine every 60 min, plus the CRM workers and the ledger reconciler.

## Auth model (three separate doors — do not merge them)

- **Guest:** phone/OTP identity. Auto-created on first booking.
- **Host:** Google-only at `/login-as-vendor`. (A dual-login path lets a host also enter their guest space via WhatsApp OTP — one identity, two "modes": traveling vs hosting.)
- **Admin:** completely separate JWT, separate table (`admin_users`), login at `/hello-sloth`. **Admin is never reachable by phone OTP.** Admin permissions are embedded in the JWT at sign-in — so a permission change only takes effect on the admin's *next login*.

Server auth: `protect` middleware verifies the Supabase JWT and sets `req.user`. `api.js` auto-refreshes on 401. `supabaseAdmin` (service role key) bypasses RLS and is **server-only, never in client code**.

## Pricing — the one rule that matters

All pricing math lives in `server/lib/pricingEngine.js` as **pure functions** (no DB, no side effects). On every booking the computed values (`vendor_amount`, `platform_fee_amount`, `commission_applied`, GST splits) are **snapshotted onto the `bookings` row and are immutable**. Never recalculate a historical booking's price from current settings. Platform fee tiers: ₹0 / ₹2 / ₹5 / ₹10 by price band. Commission: 0% on paid plans; 5% over ₹200 on Starter after a 30-day grace.

## The schema-fallback pattern (you will see this everywhere)

Supabase caches its schema and migrations can lag a deploy, so server queries that touch newer columns wrap a fallback:

```js
let result = await supabaseAdmin.from('bookings').select('*, commission_applied');
if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
  result = await supabaseAdmin.from('bookings').select('id, status, ...'); // core fields
}
```
INSERTs drop the unknown column by destructuring. Keep the fallback until a migration is confirmed applied on **both** DBs. **And: `supabase-js` never throws on a query error** — it resolves `{ data, error }`. Any code that ignores `error` swallows real failures silently. This has caused multiple bugs. Always check `error`.

## Critical / high-risk files

**Tier 1 (extreme caution):** `bookingController.js`, `paymentController.js`, `pricingEngine.js`, `config/supabase.js`, `middleware/authMiddleware.js`.
**Tier 2:** `otpStore.js`, `planMiddleware.js`, `client/src/services/api.js`, `AuthContext.jsx`, `ServiceBooking.jsx`, `config/schema.sql`.
**Tier 3:** `server.js` (middleware order — the Razorpay webhook must use `express.raw` *before* `express.json`), `themeUtils.js`, `App.jsx` (route order: `/:username/booking/:slug` must precede `/:username/:slug`).

See `docs/critical-files.md` for the per-file "before you change this" notes.

## Database

- **Two Supabase projects.** Prod = **Mumbai `PROD_PROJECT_REF`**, staging = **Tokyo `STAGING_PROJECT_REF`**. (Memorise this; the naming is counterintuitive and has caused mistakes.)
- **Migrations:** ~220 SQL files in `server/migrations/`, versioned v1.1 → v3.1xx. All through the latest verified version are applied on **both** DBs. A new migration must be run on both, staging first, and the code-side schema fallback kept until confirmed everywhere.
- Staging is **DB-only** — there is no separately deployed staging app.
- Prod schema changes go through Supabase MCP `execute_sql` / `apply_migration` (the seed scripts point at staging by default — a known landmine).

## Deploy pipeline — read this before shipping anything

**This repo ships on a daily release train. Do not push straight to `main`.**

1. Every change is a PR that targets the current **`release/YYYY-MM`** branch (right now `release/2026-10`), even if someone says "just merge it."
2. `main` only moves via the **`/ship-release`** skill: it merges the release branch into `main` in **one** merge commit, waits for CI + Render + Vercel, smoke-tests prod, then cleans up branches.
3. **Merging to `main` auto-deploys to production.** The founder controls that timing. Stop at the PR; hand over the link; do not merge.

Deploy specifics:
- **Client → Vercel** via the `deploy-vercel.yml` GitHub Action (Vercel's own git integration for `main` is disabled; only this workflow or a manual dispatch ships the client; path-filtered to `client/**`).
- **Server → Render** auto-deploys on every push to `main` (no GitHub Action).
- The **canonical production domain is `.com`, never `.in`** — verify prod on the `.com` domain (the CDN throws false 404s on `.in`).

Branch state at handover: active branch is `release/2026-10`; `main` is the default. Several feature branches and two Dependabot branches are open. The repo auto-deletes merged branches.

## The CRM kill-switch (operational)

CRM outreach is **live in production**. To pause every CRM send instantly:

```sql
UPDATE feature_flags SET enabled=false WHERE key='crm_admin_sends';
```

Fail-closed in code; effective within the 60-second flag cache. Guardrails that stay on regardless: governor cap (1 touch / 48h per subject), quiet hours (09:00–20:00 IST), do-not-contact, and per-channel opt-out. There are ~33 feature flags total acting as kill-switches across the platform.

## Testing + CI gates

- Server: `cd server && npm test` (Jest, unit + integration).
- Client: `cd client && npm test` (Vitest) and `npm run build` (Vite + a **prerender** step).
- **The full Vitest suite is a hard gate on Vercel deploys** — one stale/broken test blocks *all* client deploys. Any new top-level route must also be added to `reservedSegments.js` or the build fails.
- The client build runs a Puppeteer/Chromium prerender (`prerender.mjs`) for SEO. It has caused 45-minute builds and flaky deploys (Google Fonts stalls, beasties not being concurrency-safe) — there's a whole memory/doc trail on it.

## Landmines that have caused real production incidents

These are the ones that have actually bitten. Full detail lives in `docs/current-work.md`, `docs/cloudflare-edge-setup.md`, and the memory index.

- **Shared edge IP / ipGuard self-ban.** Cloudflare sits in front; if `CLIENT_IP_HEADER=cf-connecting-ip` is not set on Render, `getClientIp()` resolves to Render's internal `10.x` proxy address, and a single auto-ban on it **403s the entire platform** (looks like a CORS outage). Code now refuses to ban private/reserved IPs, but the ops env var still matters.
- **Render free-tier bandwidth cap.** Hitting the 5GB egress cap **suspends the API** and presents as a CORS error, not a quota error. Most egress is backend crons, not users.
- **AiSensy template param count.** The approved "Booking Confirmed" WhatsApp template takes **exactly 4** body params (the reminder takes 5). A 5th param (e.g. appending a Meet link) makes AiSensy reject the whole send. A regression test locks this. The `notification_providers.api_key` is a plaintext JWT.
- **OneDrive sync hazard.** The repo lives under OneDrive, which can revert uncommitted changes. **Commit early.** Concurrent sessions on a shared working dir must use isolated git worktrees off `origin/main` — never switch the shared branch out from under a peer.
- **Multi-step dashboard flows:** any state provider for a `/dashboard` flow must be mounted *above* `PageTransition` in `App.jsx`, or framer-motion remounts it empty on every step (this broke KYC for its entire first life).
- **`/blogs` → `/blog` needs both redirect layers** (edge `vercel.json` for crawlers, `BlogsRedirect` in `App.jsx` for dev + in-app nav). Neither is dead code.

## Where the built-but-unmerged work lives

Significant features that are built + tested but **not in production** (check before rebuilding anything):
- Financial Ledger P1 — branch `sd/adoring-elgamal-625af7` (migrations applied live, branch unmerged, backfill never run).
- Guest/Host URL separation — `feat/guest-host-url-separation`.
- Dual login (host ↔ guest) — PR #900.
- Service-category redesign — `feat/service-categories` (some migrations pending).
- Plus lead-import (#990), pitch deck (#969), lifecycle email triggers, and others. The MEMORY index flags each with its status.

## First week as the new owner — suggested order

1. Read `docs/ai-context.md`, `docs/current-state.md`, `docs/current-work.md`, `docs/feature-map.md`, `docs/critical-files.md` (this doc is the map to them).
2. Get `server/.env` and `client/.env` and run both apps locally (`server` on 5000, `client` on 5173).
3. Confirm you can see both Supabase projects and know which is prod.
4. Read the deploy section above and watch one `/ship-release` before you run one.
5. Confirm the state of the CRM kill-switch and the email-provider decision (risks #1 and #2) — these touch real customers and real money.
6. Do not merge anything to `main` without the founder's go.

## Reference docs

| File | Purpose |
|---|---|
| `docs/ai-context.md` | Project rules, conventions, active context |
| `docs/current-state.md` | What works / what's broken now |
| `docs/current-work.md` | Recent changes, sprint history, go-live runbooks |
| `docs/feature-map.md` | Feature → owning files |
| `docs/architecture.md` | How the systems connect |
| `docs/critical-files.md` | High-risk files + consequences |
| `docs/database-schema.md` | Tables, columns, RLS, migrations |
| `docs/coding-rules.md` | Patterns, naming, anti-patterns |
| `docs/design-system.md` | Colours, typography, components |
| `docs/common-workflows.md` | How to do recurring tasks |
| `docs/cloudflare-edge-setup.md` | The edge-IP ops steps (incident-critical) |
| `CLAUDE.md` | The condensed project memory / rules |

---

_This document is a snapshot of the system as of 2026-10-27. The live source of truth is always the code, the `subscription_plans` / `feature_flags` tables, and the two Supabase projects — not any single doc._
