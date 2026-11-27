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
  `bot_escalations` + `bot_escalation_replies` (Tithi, formerly Bolt, human-handoff records + admin reply
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
  - **CRM is OFF until 2027-01-01 (founder decision 2026-11-26).** `crm_admin_sends` was flipped
    **OFF** on 2026-11-26, and the new `crm_automation` flag (ships OFF, fail-closed, PR #454) gates
    EVERY CRM background job — attribution, lifecycle + guest engines, list engagement, second-touch,
    send queue, sequence steps, follow-up + cold-call reminders, cold-call recap. Turn both back on in
    Admin → Feature flags in January. The CRM admin pages and manual cold calling work with them off.
  - **`crm_admin_sends` — the CRM master send switch.** On the current Meeticulous DB
    (`spquowzrefozmrzoszkf`) it was **ON** from 2026-11-12 until 2026-11-26 (see the line above; on 2026-11-01 it was OFF and no CRM email had
    been sent from this DB). The history below is from the old Mumbai/Tokyo DBs: it was enabled on
    prod Mumbai since 2026-08-27 (~100+ real messages) and staging Tokyo since 2026-09-02.
    When it is ON: Phase 2 is therefore NOT advisory-only on
    prod — the governor cap (1/48h per subject), quiet-hours (09–20 IST), do-not-contact and
    email/WhatsApp opt-out gates are the live guardrails on every send (see `sendGate`/`touchGovernor`).
    To pause all CRM sends instantly: `UPDATE feature_flags SET enabled=false WHERE key='crm_admin_sends'`
    (fail-closed; effective within the 60s flag cache). Runbook + flip history in `docs/current-work.md`.

- **v3.180** (`v3.180_remove_old_brand.sql`) — applied 2026-11-01 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`, the only DB reachable now): old brand removed from 98 published blogs,
  6 CRM templates, a badge slug and 5 column defaults; lead status `'customer'` added (transitional —
  the old value is still accepted). `bot_faqs` re-synced from `botFaqs.json` the same day.
- **v3.181** (`v3.181_drop_old_lead_status.sql`) — applied 2026-11-01 after the release went live on
  Render: `leads_status_check` + `merge_lead_rows` now carry only `'customer'`.
- **v3.182** (`v3.182_crm_cold_senders.sql`) — applied 2026-11-01 and **activated**: CRM mail to
  leads sends via Brevo from `crm_shubham` ("Shubham | CEO, Meeticulous" <shubham@mail.meeticulous.in>,
  cold outreach on the separate `.in` root; replies → shubham@meeticulous.com) and `crm_tithi`
  ("Tithi at Meeticulous" <tithi@news.meeticulous.com>, lifecycle to opted-in hosts, kept OFF the cold
  root; replies → team@meeticulous.com). Brevo-authenticated domains: `mail.meeticulous.in`,
  `news.meeticulous.com` — NOT `team.meeticulous.com` (Resend only), so a CRM sender must never point
  there. Durga/Sujata have no sender rows: their sequence steps were moved to Tithi (2026-11-01).
  Only takes effect while `crm_admin_sends` is ON. Off switch: `UPDATE email_senders SET active=false
  WHERE sender_key IN ('crm_shubham','crm_tithi');`.
- **v3.183** (`v3.183_lead_reply_intent.sql`) — applied 2026-11-02 on the Meeticulous DB:
  `leads.last_reply_intent` (AI label on the latest CRM email reply, written by
  `brevoInboundController` via Brevo inbound parsing on `reply.meeticulous.in`).
- **v3.184** (`v3.184_founding_plan.sql`) — applied 2026-11-03 on the Meeticulous DB after release #116
  shipped: archived `premium_founding` plan row (copy of Pro at today's price; Pro checkouts land there
  while founding spots are open), `vendor_metrics.is_founding_member` + automatic "Founding Member" badge,
  phantom `subscription_plans.features` keys dropped. Email templates reseeded the same day (Pro Taste ×3
  + FOUNDING_SPOTS_LOW inserted, 22 refreshed to the banner designs; all 54 md5-match `config/emailTemplates.js`).
- **v3.185** (`v3.185_platform_reviews.sql`) — applied 2026-11-03 on the Meeticulous DB and verified
  (14 cols, RLS on / no policies, checks + 2 indexes): `platform_reviews` = reviews OF Meeticulous from
  `/submit-review` (one per signed-in account). Public only when `status='approved'` AND
  `consent_public`; approved in Admin → Content → Testimonials (`cms.manage`).
- **v3.185** (`v3.185_community.sql`, community) — applied 2026-11-03 on the Meeticulous DB (founder-approved):
  18 `community_*` tables (schema for ALL community phases), counter triggers, 5 seeded spaces,
  3 `COMMUNITY_*` notification_events. RLS on, no policies. The 3 matching `email_templates` rows were
  inserted on their own (NOT via `seedEmailTemplates.js`, which overwrites every template). All four
  `community*` flags ship OFF + fail-closed.
  **Filename note:** number collides with `v3.185_platform_reviews.sql` — cosmetic only, both applied
  (Supabase names migrations independently; this one is `v3_185_community`).
- **v3.186** (`v3.186_lockdown_anon_rpc_and_views.sql`) — applied 2026-11-03 on the Meeticulous DB
  (founder-approved, verified + advisor clean): revoked anon/authenticated EXECUTE on all 13 `SECURITY
  DEFINER` functions (service_role only) and made `host_activation` / `host_activation_funnel` /
  `vendor_metrics` `security_invoker` with no anon/auth access — before this the public anon key could
  read every host's name/email/phone via `host_activation`. New postgres-owned functions no longer get
  anon EXECUTE by default: **a function the browser must call needs an explicit GRANT**, and every new
  view must set `security_invoker = true` (guarded by `tests/unit/lockdownAnonRpcMigration.test.js`).
- **v3.187** (`v3.187_email_template_seed_hash.sql`) — applied 2026-11-03 on the Meeticulous DB:
  `email_templates.seed_hash` (nullable). Production boot runs `services/email/templateSync.js`, which
  pushes `config/emailTemplates.js` copy into the DB and KEEPS rows edited in the admin editor
  (row content ≠ its seed_hash). Off switch: `EMAIL_TEMPLATE_SYNC=off`. Manual: `node scripts/seedEmailTemplates.js [--force]`.
- **Live state re-verified 2026-11-17 (read-only query against the live DB) — where an older entry
  disagrees, this wins.**
  **Everything is now ON.** The seven nudge tracks — `activation_nudges`, `dormant_nudges`,
  `review_nudges`, `festival_nudges`, `human_moments`, `empathy_track`,
  `community_email_onboarding` — were switched back on after `utils/notificationDedupe.js` shipped
  and was wired into the nudge services themselves (activationNudges, dormancyNudges, empathyScans,
  festivalGreetings, community/onboardingSequence), which was the condition for re-enabling them.
  **These send real email and WhatsApp.** Rollback: set the keys back to `false`.
  `community_v2`, `community_ads` and `coupons` are ON too. Founder decision: test in prod.
  `tds_tcs_v2` is ON (2026-11-17) — see its own entry below; with it OFF the legacy flat 1% + 1%
  ignored `hasGstin` and would have taken GST TCS from hosts with no GSTIN to credit it to.
  Applied: v3.188, v3.199, v3.200, v3.201, v3.205, **v3.204_coupons (2026-11-17)**.
  **Not applied:** v3.191, `v3.203_admin_token_version` (admin session revocation is inert until it is).
  Open findings from the 2026-11-12 audit: `docs/audit-2026-11-12.md`.
- **Open security gap found 2026-11-17 (not fixed):** 149 public tables still grant `TRUNCATE` to
  `anon` and `authenticated`. v3.206 revoked INSERT/UPDATE/DELETE but not TRUNCATE, and RLS does not
  cover TRUNCATE. Not currently reachable — PostgREST exposes no TRUNCATE verb, so the publishable
  key has no route to it — but it is the same posture v3.206 set out to close and wants a follow-up
  migration. The second half of this finding — `increment_coupon_redemption` (v3.204) being
  SECURITY DEFINER with no `SET search_path` — is **FIXED** by v3.221 below.
- **v3.188** (`v3.188_host_linkedin_login_flag.sql`) — applied (confirmed 2026-11-12). Was listed PENDING: apply before/at merge of the LinkedIn
  host login release: seeds the `host_linkedin_login` flag OFF (`ON CONFLICT DO NOTHING`). The registry
  entry also carries `enabled: false`, so a boot before the migration still creates it OFF.
- **v3.189** (`v3.189_maroon_color_defaults.sql`) — applied 2026-11-04 on the Meeticulous DB and verified:
  `profiles.theme_color` + `email_settings.brand_color` defaults `#FE5100` (old orange) → `#960D32`;
  the 3 profiles + 1 email_settings row still on orange repainted.
- **v3.190** (`v3.190_plan_gifts.sql`) — applied 2026-11-04 on the Meeticulous DB and verified (24 cols,
  RLS on / no policies, 7 checks, 3 FKs, partial unique index = one active gift per host):
  `plan_gifts` = gifted (complimentary) Pro from the super admin (`planGiftService`, PR #138) + 3
  `notification_events` (`PLAN_GIFT_RECEIVED/ENDING/ENDED`, email + in-app on, WhatsApp OFF until
  the AiSensy templates are approved). A gift is plain `premium` with `plan_expires_at` = gift end.
  share_*/forward_* columns are for PR C (share-to-extend, pay-it-forward), unused until then.
- **v3.191** (`v3.191_support_sla.sql`) — **PENDING**, apply at merge of the support SLA nudge:
  `support_threads.sla_waiting_since` (set by a trigger on entering `waiting`) + `sla_alerted_clock` /
  `sla_alerted_level`. Additive. Until applied the `support-sla-nudge` job fails closed and sends nothing.

- **v3.206** (`v3.206_lockdown_anon_writes.sql`) — applied 2026-11-12 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified (0 INSERT/UPDATE/DELETE grants remain for `anon`/`authenticated`).
  Project-audit C1 fix: REVOKEs write on all public tables from anon/authenticated + sets that as the
  default privilege for future postgres-owned tables, closing a hole where a signed-in user could write
  `plan`/`is_verified`/`payment_status`/payouts straight through the publishable key (browser only uses
  supabase-js for auth+realtime, never PostgREST writes — verified, so no app impact). REVOKE-only, so
  rollback is a re-GRANT; the permissive write POLICIES are left in place (unreachable with no grant).
  Companion to v3.205 (profiles column SELECT) + v3.186 (functions + views). Shipped with PR #292.
- **v3.221** (`v3.221_coupon_fn_search_path.sql`) — applied 2026-11-17 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: `increment_coupon_redemption` now pins
  `search_path = public, pg_temp`. Closes the open finding above. It was the ONLY one of 15
  `SECURITY DEFINER` functions in `public` with a mutable path (measured, not assumed). Such a
  function runs as its OWNER, so whatever the CALLER's search_path resolves `coupons` to is what
  runs with owner rights. **pg_temp is NAMED** because Postgres searches the temp schema FIRST
  whenever pg_temp is absent from the path — so the bare `= public` form used by v3.205 and v3.25
  still permits a temp-table shadow (residual; those two are applied and left alone). Barely
  exploitable today: EXECUTE is postgres + service_role only, and service_role can already write
  `coupons` directly. It matters the day someone grants EXECUTE to `authenticated`, which CAN
  create temp tables. ALTER-only, so body and ACL untouched — grants verified unchanged after.
  Rollback: `ALTER FUNCTION public.increment_coupon_redemption(uuid) RESET search_path;`. Guarded:
  `tests/unit/lockdownAnonRpcMigration.test.js` now fails ANY `SECURITY DEFINER` definition in a
  migration from v3.186 on that does not pin search_path. Shipped with PR #375.
- **v3.222** (`v3.222_course_fn_search_path.sql`) — applied 2026-11-17 on the Meeticulous DB and
  verified (`search_path=public, pg_temp`; still SECURITY INVOKER; `courses` untouched; every
  function we own now pins its path, 0 remaining).
  Pins `increment_course_purchase_count`, the last entry in the Supabase
  `function_search_path_mutable` lint. NOT v3.221's risk class: this one is SECURITY INVOKER, runs
  with the caller's own rights, no privilege escalation — it is fixed so the lint reads zero and the
  next finding in it is a real one. Of 338 unpinned functions in `public`, 337 are extension-owned
  (btree_gist, pg_trgm and vector are all installed in public — a separate, lower advisor warning);
  exactly one was ours.
- **v3.225** (`v3.225_membership_charges.sql`) — applied 2026-11-19 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: 37 columns, 7 indexes, RLS ON with no policies, 0
  anon/authenticated INSERT/UPDATE/DELETE grants (v3.206 default privileges held), 0 rows.
  `membership_charges` = one row per successful membership charge. Until it existed, a charge
  left NO trace: the webhook moved `current_period_end` forward and dropped the payment entity,
  so membership revenue was invisible to `routeAutoPayoutService` (needs a payment id),
  `settlementService` (sums `bookings.vendor_amount`), `withholdingReportService` and
  `gstExportService` — all of which read rows. The payout gap was a RECORD gap.
  Money snapshot comes from `lib/pricingEngine` (same engine as bookings), so commission and
  TDS/TCS match for the same host. No platform fee on top — the tier price is what Razorpay
  bills — so `platform_fee_amount` is 0 and `customer_total` is the amount charged. Unique
  indexes on `razorpay_payment_id` / `razorpay_order_id` are the idempotency guard: a duplicate
  row would later become a duplicate payout. Additive; `services/membershipCharges.js` keeps a
  schema fallback and swallows write failures, so bookkeeping can never cost a member the
  access they paid for. **This records money; it does not move any** — the Route rail,
  settlement/statutory reads and refund reversal are the next slices (PR #405).
- **v3.226** (`v3.226_community_post_collaborators.sql`) — applied 2026-11-21 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified (5 cols, RLS ON / no policies, 3 indexes = PK + unique
  `(post_id, profile_id)` + `profile_id`, 2 cascade FKs, `COMMUNITY_COLLABORATOR_ADDED` event seeded
  in_app=true/email=false). `community_post_collaborators` = up to 2 credited collaborators per
  community post (instant credit + in-app notify; shown on the post and on each collaborator's
  profile feed). Cap-2 + self-exclusion live in `communityController.createItem`, not the DB. Shipped
  with PR #412 behind `community_collaborators` (ships OFF). Code is schema-fallback safe
  (`store.loadCollaboratorsByPost` / `listAuthorPosts` degrade to empty/author-only), so the migration
  was safe to apply before the code deploys. Only takes effect once the flag is flipped.
- **v3.217** (`v3.217_creator_intelligence.sql`) — applied 2026-11-18 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: the 5 Creator Intelligence tables (`analytics_events`,
  `analytics_daily`, `analytics_daily_dim`, `booking_attribution`, `benchmark_daily`), the
  `profiles.intel_revenue_target` column, RLS ON all 5 (no policies, service_role only — v3.186/v3.206
  posture), and anon/authenticated REVOKED. Additive; code is schema-fallback safe (intel-rollup /
  intel-prune wrap each day in try/catch and no-op on a missing table), so it was safe to ship on
  release/2026-11 before apply. Intel stays dark until `analytics_ingest` is flipped ON (ships OFF:
  the collect endpoint returns 202 and drops). Shipped with PRs #366 (foundation) / #367 / #371.
- **v3.218** (`v3.218_analytics_size_fn.sql`) — applied 2026-11-18 on the Meeticulous DB and verified
  (fn executes, returned 40960 bytes): `analytics_events_size_bytes()` (SECURITY DEFINER, pins
  `search_path = public, pg_catalog`, EXECUTE granted to service_role ONLY). Feeds the ingest size
  guard, sampled by intel-rollup/intel-prune, never called on the ingest path. **Filename note:**
  number collides with `v3.218_community_membership.sql` (membership) — cosmetic only, both applied,
  Supabase names migrations independently. Shipped with PR #371.
- **v3.227** (`v3.227_catalog_sort_order.sql`) — applied 2026-11-26 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`, founder-approved) and verified: nullable `sort_order integer` (no
  default) on `services` / `products` / `courses` + `idx_{table}_host_sort (host_id, sort_order)`;
  still 0 anon/authenticated write grants. The host-set Catalog order (Kept Catalog reorder,
  `PUT /api/{services,products,courses}/reorder`). NULL = never placed; every read sorts
  `sort_order NULLS LAST, created_at DESC` (`services/catalogOrder.js`), so untouched hosts keep
  newest-first. Code is schema-fallback safe (order read in its own query; reorder answers 409
  without the column). Rollback: `ALTER TABLE … DROP COLUMN IF EXISTS sort_order` on the three.
- **v3.228** (`v3.228_membership_tier_cover.sql`) — applied 2026-11-27 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: `community_membership_tiers.cover_url` + `description`
  (nullable text, `tier_description_len` check ≤ 600). Tier cover + description on the Kept tier
  cards (PR #461). Additive; `membershipController` keeps a schema fallback (writeTier retries
  without the two columns). Rollback: `DROP COLUMN IF EXISTS` on both.
- **v3.229** (`v3.229_clean_catalog_slugs.sql`) — **PENDING: apply at merge** of the profile SEO
  overhaul (`feat/profile-seo-overhaul`). Adds `legacy_slugs text[] NOT NULL DEFAULT '{}'` to
  `products` + `courses` and strips the `demo-` prefix from their slugs (old slug moved into
  `legacy_slugs`; per-host clash → `-2`, `-3`). Idempotent + additive. Old URLs keep resolving:
  `services/catalogSlug.js` looks up slug → id → legacy_slugs and the page / bot shell 301s to
  `/:username/products|courses/<slug>`. Code is schema-fallback safe (no column = the legacy lookup
  is "not found"). Verify + rollback queries are in the file header.
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
  The `meeticulous-design` skill loads the same kit.
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
