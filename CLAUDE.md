# Meeticulous — Claude Project Memory

## Task Workflow (default for every task)
1. **Ask first.** Before starting any task, ask at least one clarifying question. Never dive in cold.
2. **Fresh branch from main.** `git fetch origin && git switch -c <type>/<slug> origin/main`. Never work directly on `main` or reuse an old branch unless told to.
3. **Work → commit → PR.** Do the change, commit, `gh pr create` (any type: feat/fix/docs/chore).
4. **Stop at the PR.** Hand over the PR link. **Do NOT merge.** The user merges — merge auto-deploys to prod and the user controls timing/limit.

## Quick Start (every session)
Read these 4 files before touching any code:
1. `docs/ai-context.md` — project snapshot + active rules
2. `docs/current-state.md` — what's working / broken right now
3. `docs/current-work.md` — active sprint + recent changes
4. `docs/feature-map.md` — find any file in seconds

## Project in One Sentence
**Meeticulous** is a SaaS appointment-booking platform where creators (hosts) publish services, guests book them via OTP or account login, and payments flow through Razorpay.

## Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, react-router-dom v6 |
| Backend | Node.js + Express 4 |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Payments | Razorpay (orders + subscriptions) |
| Email | Nodemailer (SMTP) |
| WhatsApp | AiSensy (active, DB-configured via `notification_providers`) |
| Uploads | Supabase Storage (bucket `images`; private `kyc` bucket for documents) |
| Calendar | Google Calendar API |

## Repo Layout
```
appointment-booking/
  client/          # React SPA (Vite)
    src/
      pages/       # Route-level components
      components/  # Shared UI components
      context/     # AuthContext
      services/    # api.js + supabaseClient.js
      utils/       # themeUtils.js
      styles/      # CSS tokens + component classes
  server/          # Express API
    controllers/   # Business logic
    routes/        # Express routers
    middleware/    # auth, plan, security, error
    config/        # supabase.js, google.js, migrations, schema
    lib/           # pricingEngine.js
    utils/         # otpStore.js, sendEmail.js, notify.js
    migrations/    # v1.1 → v1.7 SQL files
  docs/            # This documentation
```

## Critical Commands
```bash
# Server
cd server && npm run dev          # nodemon on port 5000
cd server && npm test             # Jest unit + integration

# Client
cd client && npm run dev          # Vite on port 5173
cd client && npm run build        # Production build
cd client && npm test             # Vitest
```

## Env Files
- `server/.env` — DB, Supabase, SMTP, AiSensy, Razorpay keys
- `client/.env` — VITE_API_URL, VITE_RAZORPAY_KEY_ID, VITE_SUPABASE_*

## Database Migrations — Status (verified 2026-07-01 against both DBs)
All migrations through **v3.57 are APPLIED** on both prod (Mumbai `PROD_PROJECT_REF`)
and staging (Tokyo `STAGING_PROJECT_REF`), verified by live schema introspection.
Items previously listed here as pending are now live:
- **v1.7** (`bookings.commission_applied`) — applied.
- **v3.53** (profession-scoped `service_categories` redesign + `seedServiceCategories.js`) — applied.
- **v3.57** (two partial `bookings` indexes for host paid-booking reads) — applied 2026-07-01.

- **v3.81** (`v3.81_host_documents_permissions.sql`) — applied 2026-07-16 on BOTH DBs and
  verified: `operations` now holds `documents.view` / `documents.manage` (32 → 34 perms,
  matching `lib/adminPermissions.js` exactly); `support` deliberately holds neither; `super`
  is wildcard and untouched. Takes effect on each admin's NEXT login (permissions are
  embedded in the admin JWT at sign-in — an ops admin logged in before this still 403s on
  host documents until they re-login).

- **v3.88** (`v3.88_profiles_og_card.sql`) — applied 2026-07-19 on BOTH DBs (prod 59
  profiles + staging 7 defaulted to og_status='none'). Adds host OG share-card columns
  (og_image/og_status/og_generated_at/og_version/og_hash/og_error) + status check +
  partial pending index. Code keeps a schema fallback (hostController strips og_status
  on "column not found"). Cards generated off-Render via `client/scripts/generateHostOgImages.mjs`
  (blog pipeline clone) → Supabase images/host-og/.

- **v3.89** (`v3.89_bot_escalations.sql`) — applied 2026-07-20 on BOTH DBs. Adds
  `bot_escalations` + `bot_escalation_replies` (Bolt human-handoff records + admin reply
  thread; additive, RLS-on/no-policy/service_role-only). escalationService keeps the
  code-side schema fallback (degrades to email-only on "table/column missing"). See
  `docs/bolt-escalation-flow.md`.

- **v3.90** (`v3.90_bot_escalation_rating.sql`) — applied 2026-07-20 on BOTH DBs. Adds
  `bot_escalations.rating` (1–5 post-handoff satisfaction). Additive, schema-fallback safe.

- **Host notification system** (audit "Host Signal", PRs #855–#859) — applied 2026-08-29 on
  BOTH DBs via Supabase MCP and verified identical (prod `PROD_PROJECT_REF` + staging
  `STAGING_PROJECT_REF`). All additive + schema-fallback safe in `utils/inAppNotify.js`:
  - **`v3.130_notification_in_app_channel.sql`** — `notification_events.in_app_enabled`
    (in-app becomes a NotificationEngine channel) + seeds `SUBSCRIPTION_HALTED` and
    `REFERRAL_REWARD_RELEASED` event rows. **Filename note:** number collides with
    `v3.130_merge_lead_rows_fn.sql` (CRM) — cosmetic only, both applied, Supabase names
    migrations independently. Also seeded 2 matching `email_templates` rows (audience
    `vendor`) via `scripts/seedEmailTemplates.js` shape.
  - **`v3.131_in_app_notifications_dedupe.sql`** — `in_app_notifications.dedupe_key` +
    partial unique index `(user_id, dedupe_key)` (stops reconciler/cron double-inserts).
  - **`v3.132_in_app_notifications_resolution.sql`** — `in_app_notifications.resolved_at`
    (a notice self-clears once the host fixes the problem; `resolveInApp` wires KYC-approved
    → clears `KYC_REJECTED`, subscription charge → clears `SUBSCRIPTION_HALTED`).

- **Relationship engine Phase 2** (audit follow-on, PRs #925/#927/#928/#931/#936) — merged 2026-09-02.
  Only PR-9 needed a migration; the rest are code-only (governor, health signals, sends-proof, two-clock):
  - **`v3.139_touch_rec_guest_subject.sql`** — applied 2026-09-02 on BOTH DBs (staging Tokyo
    `STAGING_PROJECT_REF` first, then prod Mumbai `PROD_PROJECT_REF`) via Supabase MCP and
    verified identical (10 columns present on each): `touch_recommendations.contact_id` (FK
    contacts, ON DELETE CASCADE) lets a guest rec set `subject_type='guest'` + `contact_id` with a
    null `lead_id`; `contacts` gains the same touch-clock columns as leads' v3.133
    (`last_meaningful_interaction_at` / `last_meaningful_channel` / `meaningful_interaction_count` /
    `last_automated_touch_at` / `last_activity_at`) and the health columns from v3.135
    (`health_state` CHECK + `health_score` / `health_signals` / `health_computed_at`). Additive,
    RLS unchanged (service-role only). Code is schema-fallback safe (`guestRelationshipEngine`
    skips the health write, `deskService` guest query fails soft) so it was safe before apply.
  - **`crm_admin_sends` is LIVE (ON) — CRM outbound is sending to real customers.** The master send
    kill-switch (a `feature_flags` row, still FAIL-CLOSED in code) is enabled on BOTH DBs: **prod
    Mumbai since 2026-08-27** (founder-enabled; the flag row reads `enabled=true`, ~100+ real
    messages sent) and **staging Tokyo since 2026-09-02**. Phase 2 is therefore NOT advisory-only on
    prod — the governor cap (1/48h per subject), quiet-hours (09–20 IST), do-not-contact and
    email/WhatsApp opt-out gates are the live guardrails on every send (see `sendGate`/`touchGovernor`).
    To pause all CRM sends instantly: `UPDATE feature_flags SET enabled=false WHERE key='crm_admin_sends'`
    (fail-closed; effective within the 60s flag cache). Runbook + flip history in `docs/current-work.md`.

No migration is currently outstanding. Workflow for any NEW migration: run it on BOTH DBs, and keep the
code-side schema fallback (SELECT/INSERT destructure) until it is confirmed applied everywhere.

## Documentation Map
| File | Purpose |
|---|---|
| `docs/ai-context.md` | Project rules, conventions, active context |
| `docs/project-index.md` | Every folder explained |
| `docs/feature-map.md` | Feature → file ownership |
| `docs/architecture.md` | How systems connect |
| `docs/database-schema.md` | All tables, columns, RLS, migrations |
| `docs/coding-rules.md` | Patterns, naming, anti-patterns |
| `docs/design-system.md` | Colors, typography, components |
| `docs/current-state.md` | What works, what's broken |
| `docs/current-work.md` | Recent changes + next tasks |
| `docs/common-workflows.md` | How to implement recurring tasks |
| `docs/critical-files.md` | High-risk files + consequences |


# Before Writing Any Code

Never assume how a feature works.
Search first.

Always preserve existing behaviour unless explicitly asked.

If changing authentication, payments, bookings, pricing,
subscriptions, or middleware:
    Read docs/feature-map.md first.

Do not rename APIs, routes, or database columns unless instructed.

Prefer modifying existing components over creating new ones.

Never remove comments that explain business logic.

When unsure, ask.


## Product Rules

Guests
- Login using OTP.
- Phone number is identity.
- Auto-created if new.

Hosts
- Host login (`/login-as-vendor`) is Google only. Never show email/password here.
- Dual login (PR #900): a host MAY also sign into their guest space via WhatsApp
  OTP at `/login` → lands `/user`. It is ONE identity (both doors mint a session
  for the same profile); guest vs host is the `mode` ('traveling'/'hosting'), and
  crossing doors forces a logout of the other session.
- Superadmin is NEVER reachable by phone OTP — admin login is a separate door.

Bookings
- Always snapshot pricing.
- Never trust client-side pricing.

Payments
- Razorpay is source of truth.
- Verify signatures server-side.

Plans
Starter
Host+
Studio

Limits always come from: subscription_plans.limits


## UI Rules

Design language = **soft modern SaaS** (NOT "friendly brutalism" — that label in
old docs is stale). The shipped public pages (Home, Pricing, /for/* landings,
Navbar, Footer) are the source of truth; match them.

**Tokens only — never invent colors.** Use the Tailwind token classes:
`bg-ink`/`text-ink` (#1a1a1a), `bg-canvas` (#faf9f6, page bg), `bg-sand` (#f4f1ea),
`text-primary`/`bg-primary` (#FE5100), `text-primary-cta`/`bg-primary-cta` (#c23d00 —
the WCAG-safe orange for white-on-orange CTAs and accent headline words),
`primary-light` (#FFE9DD), and the multi-hue `--c-*` / `text-c-*` accents. Per-landing
pages drive accents off CSS vars (`--lp-accent`) via inline `style`.

**Radius:** 4–6px on cards/buttons, `rounded-full` on chips/pills/avatars. NOTE
`tailwind.config.js` overrides the scale — `rounded-lg/md/sm` = 4px and
`rounded-xl/2xl/3xl` = 6px (NOT 12/16/24). So reach for `rounded-[6px]`/`rounded-[5px]`;
`rounded-[10px]` is the one allowed card exception. Never 16px+ radii.

**Borders:** 1px, low-alpha — `border border-black/5`, `border border-white/10` (dark
sections), or accent at ~30% alpha (`${accent}4d`). NEVER `border-4 border-ink` or
solid ink borders (that's the old brutalist look — do not add it).

**Shadows:** soft and blurred — base `shadow-[0_8px_30px_rgba(26,26,26,0.04)]`, hover
lifts with bigger blur + negative spread (`hover:-translate-y-1 hover:shadow-[0_24px_60px_-28px_...]`).
NEVER hard offset shadows (`shadow-[4px_4px_0_#1E1E1E]`).

**Type:** `font-heading` = Plus Jakarta Sans (card titles, stat numbers, prices,
wordmark); body inherits `font-sans` = Poppins. Hero H1 uses `clamp()`; section H2 =
`text-4xl sm:text-5xl font-extrabold`, often one accent word in `text-primary-cta`.

**CTA pattern:** `rounded-[6px] px-6 py-3 text-sm font-semibold text-white` on
`bg-ink` or an accent fill, soft shadow, `hover:opacity-90`. Not pill-shaped, no border.

**Rhythm:** sections `px-5 py-20 sm:px-8 lg:py-28`, containers `max-w-6xl`/`max-w-3xl mx-auto`,
card grids `gap-5 sm:gap-6`, gutters `px-5 → sm:px-8`.

**Reuse existing components before creating new ones.** `docs/design-system.md` is the
long-form guide (keep it and this section in sync).



## Quick Search

Authentication
server/routes/authRoutes.js
server/controllers/authController.js
client/context/AuthContext.jsx

Bookings
server/controllers/bookingController.js
client/src/pages/ServiceBooking.jsx

Payments
server/controllers/paymentController.js

Hosts
client/pages/dashboard/*
server/controllers/vendorController.js

Pricing
server/lib/pricingEngine.js

Plans
subscription_plans table
server/middleware/planMiddleware.js


## Current Priority

1. Stability
2. Performance
3. DX
4. UI polish

Never refactor unrelated code.

## Never Do

❌ Change database schema without migration.

❌ Hardcode plan limits.

❌ Duplicate API endpoints.

❌ Create another auth flow.

❌ Store secrets in code.

❌ Break backward compatibility.


## Before Finishing

Run:

Server
npm test

Client
npm run build

Only mention failures caused by existing code.