# Meeticulous — Claude Project Memory

## Task Workflow (default for every task)
1. **Ask first.** Before starting any task, ask at least one clarifying question. Never dive in cold.
2. **Fresh WORKTREE from main — never `git switch` in the shared checkout.**
   ```bash
   git fetch origin && git worktree add ../mt-wt-<slug> -b <type>/<slug> origin/main
   ```
   Then work in `../mt-wt-<slug>`. Never work directly on `main` or reuse an old branch unless told to.

   **Why a worktree and not a branch switch.** Several Claude sessions share this
   one clone at the same time. `git switch`, `git checkout` and `git reset --hard`
   act on the whole working directory, so a session that switches branches destroys
   every other session's uncommitted work — silently, and with no warning to either
   side. This has bitten before; on 2026-11-17 a switch wiped 593 lines of another
   session's in-progress work mid-build. A worktree gives each session its own
   directory against the same repo, so nobody can be yanked out from under.
   `git worktree list` shows who is where.

   Three habits that go with it:
   - **Commit as soon as something passes.** Uncommitted work is the only kind that
     can be lost this way.
   - **`git stash -u` before any switch** you still decide to make. The `-u` matters:
     without it untracked files are not saved, and new files are most of a new
     feature. That flag is the only reason the 593 lines above came back.
   - **Never `git reset --hard` in a tree you did not dirty yourself.**

   A worktree needs `node_modules` before it can run anything — junction it from the
   main clone rather than reinstalling (`New-Item -ItemType Junction -Path
   <wt>/server/node_modules -Target <main>/server/node_modules`, same for `client/`),
   and copy `client/.env` across.
3. **Work → commit → PR.** Do the change, commit, `gh pr create` (any type: feat/fix/docs/chore).
   **PR base = the open release train**, not `main`: check `git branch -r | grep release/` and use
   `--base release/YYYY-MM` (CI runs on `release/**`). The train ships to `main` in one merge
   (`/ship-release`). Only a hotfix the user asks for targets `main` directly.
4. **Stop at the PR.** Hand over the PR link. **Do NOT merge.** The user merges — merge auto-deploys to prod and the user controls timing/limit.

> See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full branch / PR / merge / deploy workflow.
> CI runs server + client unit tests on every PR. Merging `main` ships prod: the client via the
> `deploy-vercel.yml` Action (a remote build that re-runs tests → build → prerender), the server via Render.

## Audits & large-scale maintenance
Whenever asked for a comprehensive project audit, full-codebase review, major cleanup or any
similar large-scale maintenance task: **read and follow [`PROJECT_AUDIT_GUIDE.md`](PROJECT_AUDIT_GUIDE.md)
before starting.** It holds the methodology, checklists, safe-fix vs needs-approval rules,
verification requirements and the report format — do not improvise a new process.

## Skills — which one per task
~150 skills are installed; many overlap. Use ONLY the one mapped here for each task — loading
a second skill that covers the same ground just burns tokens. Not listed = don't load it.

| Task | Skill(s) |
|---|---|
| New feature / behaviour change | `superpowers:brainstorming` → `superpowers:writing-plans` (multi-step only) |
| Bug, failing test | `superpowers:systematic-debugging` (not gstack `investigate`) |
| Money / booking / pricing / auth logic | `superpowers:test-driven-development` |
| Before saying "done" | `superpowers:verification-before-completion` |
| **New page, or redesign / upgrade of an existing page** | `meeticulous-design` **+** `emil-design-eng` (always both) |
| Visual QA of a built page | `design-review` |
| Animation | `animate`; GSAP code → `gsap-react` / `gsap-scrolltrigger`; jank → `animation-performance` |
| Web app feel on phone (PWA, sheets, tap states) | `mobile-native` |
| Non-blog public page before publish | `page-seo-gate` (calls `bas-seo-schema` itself) |
| Blog post | `blog-seo-optimizer`; unattended publish → `blog-autopost` |
| SEO/AEO audit → plan | `seo-aeo-audit` → `seo-topical-map` (not `geo-*` / `marketing:seo-audit`) |
| Founder-voiced copy (emails, posts) | `shubham-voice:shubham-voice` |
| Brevo email / campaign | Brevo MCP `get_brevo_guide` |
| Review a diff | `code-review` at low/medium; auth/payment diff → also `security-review` |
| Full audit / big cleanup | `PROJECT_AUDIT_GUIDE.md` (not a skill) |
| End-of-day release → main | `ship-release` (only when the founder says so) |
| PDF / shareable doc | `make-pdf` / `anthropic-skills:docs` |

**Costly — only when the user asks by name:** `code-review` max/ultra, Workflow, `deep-research`,
`geo-audit`, `autoplan`, `plan-*-review`, `qa`, `benchmark-models`, `codex`.
**Agency-repo only, never here:** `geo-prospect`, `geo-proposal`, `geo-report-pdf`, `geo-compare`, `geo-update`.
**Switched off on 2026-11-28** (moved to `~/.claude/skills-disabled/`; move a folder back to restore it):
the iOS/Swift/Expo skills, gstack `ship`/`land-and-deploy`/`setup-deploy` (they merge, so they clash with the
stop-at-PR rule), plus the skills that duplicate the map above (`investigate`, `review`, `autoplan`,
`plan-ceo/devex/tune`, `office-hours`, `retro`, `design-consultation`, `design-shotgun`, `skillify`, `codex`,
`benchmark-models`, gbrain). Plugins `ui-ux-pro-max`, `andrej-karpathy-skills` and `harness` are disabled in
`~/.claude/settings.json`. Caveman comes from its plugin only; the repo copies were removed.

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
    migrations/    # v1.1 → v3.205 SQL files (applied by hand)
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

## Database Migrations
Full applied/pending log: **`docs/database-schema.md` → "Migration Status Log"**. Read it before any
migration or schema work, and record each new migration there (not here).
- Live DB: Meeticulous `spquowzrefozmrzoszkf` (the only one reachable). Supabase MCP may be the wrong
  account — use the sbp token in `server/.env` + Management API.
- **Not applied:** `v3.191_support_sla`, `v3.203_admin_token_version` (admin session revocation inert until it is).
- **Open gap:** 149 public tables still grant `TRUNCATE` to anon/authenticated (unreachable via PostgREST; wants a follow-up migration).
- New function the browser calls needs an explicit GRANT; every new view sets `security_invoker = true`;
  every `SECURITY DEFINER` pins `search_path = public, pg_temp` (guarded by `tests/unit/lockdownAnonRpcMigration.test.js`).
- `scripts/seedEmailTemplates.js` overwrites EVERY template — insert single rows instead.
- CRM pause switch: `UPDATE feature_flags SET enabled=false WHERE key='crm_admin_sends'` (60s cache).
Workflow for any NEW migration: run it on BOTH DBs, and keep the
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
| `PROJECT_AUDIT_GUIDE.md` | How to run a full audit / major cleanup (mandatory for those tasks) |


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
- Host login (`/login-as-vendor`) is Google OR LinkedIn (LinkedIn via Supabase `linkedin_oidc`, behind the
  admin flag `host_linkedin_login`, ships OFF). Never show email/password here.
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

Withholding (TDS / TCS) — when CA sign-off is required
  Ruled by the founder-CA on 2026-11-17 (PR #371). The automated
  tax-legal-signoff CI gate (label / "Sign-off:" line) was REMOVED on
  2026-11-27 at the founder's request: no label or Sign-off line is needed to
  merge any more. The rule below still decides when a change should get the
  founder-CA's review before it ships; flag such lines in the PR description.

  Sign-off IS required where a change determines a withheld amount OR ITS
  ATTRIBUTION: rate, threshold, section, PAN/GSTIN condition, no-PAN floor,
  state split, the period attributed to, refund/cancellation reversal, a write
  to a withholding column, or statutory return/certificate content.

  Sign-off is NOT required to aggregate or present already-persisted
  withholding. That needs presentation review, not tax sign-off.

  Two standing rules that came out of the same ruling:
  - Withholding aggregates are FY-SCOPED (1 Apr–31 Mar IST, via
    services/gst/gstPeriod.js). An all-time total reconciles to no statutory
    record.
  - Rates are asserted in ONE file, tests/unit/pricingEngineWithholding.test.js.
    Every other fixture touching withholding uses deliberately non-statutory
    amounts, so a changed rate can never be "corrected" into a fixture and
    mistaken for validation.

Plans
Starter
Pro
(the two active rows in `subscription_plans`, verified 2026-11-12; Host+/Studio and
explorer/creator/professional in older docs are retired names)

Limits always come from: subscription_plans.limits


## UI Rules — Design system (mandatory)

All UI, pages, emails and graphics MUST follow the Meeticulous design system in `design-system/`
(direction **"Loop & Slot"**; this replaces the old "soft modern SaaS" 4–6px-radius rules).
- Read `design-system/BRAND_RULES.md` before any UI work and run its checklist before finishing.
  The `meeticulous-design` skill loads the same kit. Any new page or page upgrade also loads
  `emil-design-eng` for interaction polish.
- Use tokens from `design-system/styles.css`. Never hard-code colours, fonts, radii or shadows.
  In the client the kit is wired as `client/src/styles/brand.css` (generated copy of
  `design-system/tokens/*` + `components/components.css` — edit `design-system/` first, then re-sync)
  and mapped into `client/tailwind.config.js`: `maroon`, `maroon-dark`, `rose`, `pink`, `blush`,
  `cream`, `marigold` (open slots ONLY), `ink`; legacy names repointed (`canvas` = cream,
  `sand` = blush, `primary` = maroon). `font-display` (Bricolage 800), `font-sans` (Poppins),
  `font-serif` (Instrument Serif italic — one human phrase per layout).
- Radius scale (Tailwind overridden to match): `rounded-md` 16 inputs · `rounded-lg` 20 slots ·
  `rounded-xl`/`2xl` 24 cards · `rounded-3xl` 32 dialogs · `rounded-full` buttons/tags/badges.
  Nothing is square-cornered.
- Use components from `design-system/components/` or their classes (`.mt-btn`, `.mt-card`,
  `.mt-slot`, …) and official files from `design-system/assets/` (served at `/brand/ds/…`).
  Never redraw or recolour the logo, ee, camera+calendar icon or illustrations.
- Website restructuring follows `design-system/WEBSITE_MIGRATION.md`; remaining work is
  tracked in `design-system/MIGRATION_AUDIT.md`.
- If a need isn't covered, extend the system (new token/component in the same style), document
  it in `design-system/readme.md`, then use it. Never one-off styles.

## Quick Search

Authentication
server/routes/authRoutes.js
server/controllers/authController.js
client/src/context/AuthContext.jsx

Bookings
server/controllers/bookingController.js
client/src/pages/ServiceBooking.jsx

Payments
server/controllers/paymentController.js

Hosts
client/src/pages/Dashboard.jsx (host pages sit flat in client/src/pages/)
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
