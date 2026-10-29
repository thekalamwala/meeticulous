# Architectural Decisions — Meeticulous

Key decisions with context and rationale. Read this before making changes to foundational parts of the system.

---

## ADR-001: Supabase Over Custom PostgreSQL + ORM

**Decision:** Use Supabase (managed PostgreSQL + Auth + Storage) instead of a self-managed database with Prisma/TypeORM.

**Context:** The project needed a database, authentication system, and row-level security without significant DevOps overhead.

**Rationale:**
- Supabase provides auth out of the box (email/password + OAuth + magic links)
- Row Level Security (RLS) as a DB-level access control layer
- The anon key + service role key pattern cleanly separates client and server DB access
- Real-time subscriptions available if needed later
- Generous free tier for early-stage

**Consequences:**
- Server uses `supabaseAdmin` (service role) for all queries, bypassing RLS intentionally
- Client uses the anon key only for auth state listening
- Schema migrations are manual SQL files (not Prisma migrations)
- Schema cache lag requires the schema fallback pattern on new columns

---

## ADR-002: DB-Backed OTP Storage (Not In-Memory)

**Decision:** `otpStore.js` stores OTPs in the `otp_codes` Supabase table, not an in-memory Map.

**Context:** The original implementation used an in-memory Map. OTPs were lost on every server restart, causing "No OTP found" errors in production.

**Rationale:**
- Production servers restart — in-memory state is lost
- Multi-instance deployments can't share in-memory state
- DB-backed with `upsert` (email is PK) provides atomic replace semantics
- bcrypt hashing of OTPs in DB means a DB breach doesn't reveal usable OTPs

**Consequences:**
- `otpStore.set/verify/cleanup` are async DB operations
- All callers must `await` them (already the case)
- Added lockout tracking (attempts, send_count, locked_until) to the same table

---

## ADR-003: Pricing Snapshots Are Immutable

**Decision:** When a booking is created, all pricing values (vendor_amount, platform_fee_amount, commission_applied, customer_total, razorpay_fee_actual, gst_rate) are written to the booking row and never updated.

**Context:** The platform fee and commission rates can be changed by admins. Recalculating from current settings would give incorrect values for historical bookings.

**Rationale:**
- Accounting requires knowing exactly what was charged at the time of the transaction
- Admin can change platform fee without retroactively affecting past bookings
- Commission % changes don't affect already-paid bookings
- Future refund/dispute resolution requires the original pricing breakdown

**Consequences:**
- `pricingEngine.js` is called once at booking creation, never again
- All revenue reports must aggregate from snapshot columns, not recalculate
- The `vendor_amount` is finalised after payment capture (actual Razorpay fee recorded)

---

## ADR-004: Separate Admin Auth System

**Decision:** Admin authentication uses a completely separate credential store (`admin_users` table) and JWT (different secret) from the vendor/guest auth system (Supabase Auth).

**Context:** Needed to support staff with username/bcrypt login and granular permission-based access, not tied to host/guest Supabase Auth users.

**Rationale:**
- Admin staff should not have Supabase Auth accounts (separation of concerns)
- Admin JWT can carry the permission array — no per-request DB permission lookup
- Different JWT secret means compromised vendor tokens can't access admin routes
- Bcrypt allows credential rotation without touching Supabase Auth
- Lockout tracking in `admin_users` table is fully self-contained

**Consequences:**
- `api.js` must detect `/admin` routes and use the `bas_admin` localStorage token
- Two auth middlewares: `protect` (Supabase JWT) and `requireAdmin(permission)` (admin JWT)
- Admin users are NOT visible in Supabase Auth dashboard
- `AdminLayout.jsx` guard checks `bas_admin` session, not the vendor session

---

## ADR-005: pricingEngine.js Is a Pure Function Module

**Decision:** `pricingEngine.js` contains only pure functions — no DB access, no external calls, no side effects.

**Context:** Pricing logic is called in `bookingController.js` (booking creation) and potentially other places. It's also heavily unit-tested.

**Rationale:**
- Pure functions are trivially testable (23 test cases with concrete INR examples)
- No hidden dependencies — pricing can be reasoned about in isolation
- Easy to audit for billing correctness
- Can be called synchronously, no async overhead

**Consequences:**
- All configuration (fee amount, GST rate, commission %) must be passed in as arguments
- `platformConfig.js` reads settings from DB; callers pass the values to `pricingEngine`
- If business logic requires DB access during pricing, it must happen in the controller, not the engine

---

## ADR-006: Plan Limits Are DB-Driven

**Decision:** Subscription plan limits (services, products, bookings) are stored in the `subscription_plans` table, not hardcoded in middleware.

**Context:** The original implementation had hardcoded limits in `planMiddleware.js`. Changing limits required a code deploy.

**Rationale:**
- Admin can adjust plan limits without a code deployment
- New plans can be created via admin UI without touching code
- Limits can be A/B tested or adjusted per-vendor via plan assignment
- Commission % is also DB-driven (admin-adjustable per plan)

**Consequences:**
- `planService.js` caches plan data (60s TTL) to avoid per-request DB reads
- `planMiddleware.js` reads from the cached service, not hardcoded values
- Changes to limits take effect within 60 seconds
- The `explorer`/`starter` alias is handled in `planService.js` for backward compatibility

---

## ADR-007: Email Templates in Database

**Decision:** Email templates are stored in the `email_templates` table, not as hardcoded HTML strings in controller files.

**Context:** The original approach had inline HTML email bodies in `bookingController.js`, `authController.js`, etc. Changing email copy required a code deploy.

**Rationale:**
- Marketing/ops team can edit email copy via admin UI without a deploy
- Templates can be previewed in admin before going live
- Multi-provider support (SMTP, Resend, SES) with a single template store
- Delivery logs give visibility into email performance
- A/B testing templates is possible (multiple templates per event_key, archive old ones)

**Consequences:**
- Templates must be seeded on first deployment (`node scripts/seedEmailTemplates.js`)
- The `communicationEngine` adds a DB read on every email send (mitigated by queue processing in batches)
- A misconfigured DB template can break email delivery — `email_logs` table provides visibility

---

## ADR-008: WhatsApp via AiSensy (Not Twilio)

**Decision:** WhatsApp notifications use AiSensy's campaign API, not Twilio.

**Context:** Twilio WhatsApp was the original plan. AiSensy was chosen as the active provider; no Twilio code was ever shipped to `notify.js`.

**Rationale:**
- AiSensy uses campaign-name-based sending (no template approval per-message)
- Better pricing for Indian WhatsApp volumes
- Credentials in DB (admin-configurable), not hardcoded

**Consequences:**
- `notify.js` routes all WhatsApp sends through `notificationEngine.js` to `aisensyService.js` — no Twilio code path exists
- `aisensyService.js` is the active WhatsApp implementation
- `notification_providers` DB table stores AiSensy credentials (masked in admin UI)
- Adding Twilio would require introducing it from scratch as a new provider option in the notification engine

---

## ADR-009: Lazy Route Loading in React

**Decision:** Every page component is loaded lazily via `React.lazy()` + `Suspense` in `App.jsx`.

**Context:** The admin panel has 30+ pages. Loading them all eagerly would significantly increase initial bundle size.

**Rationale:**
- Each route is a separate JS chunk — only downloaded when navigated to
- Initial load time is minimised
- Vite handles code splitting automatically based on `lazy()` boundaries
- The spinner (`PageLoader`) shows during chunk download

**Consequences:**
- All page components must have a default export
- `AdminLayout` and `DashboardLayout` are eager (always needed, small)
- First navigation to an admin page has a brief load delay while the chunk downloads
- Browser caches chunks — subsequent visits to the same page are instant

---

## ADR-010: Schema Fallback Pattern for Migrations

**Decision:** Any server query touching a column added after v1.6 must include a catch-and-retry that drops the new column from the query.

**Context:** Supabase caches its schema. After applying a migration, there can be a lag before the new column is visible to queries. Additionally, development DBs may be behind production on migrations.

**Rationale:**
- Prevents production crashes when a migration is pending or hasn't propagated
- Allows gradual rollout of schema changes
- The fallback gracefully degrades (data is incomplete but no crash)
- Follows Supabase-recommended patterns for zero-downtime migrations

**Consequences:**
- Every new column requires two code paths: with and without the column
- Error message regex `/Could not find the|column.*does not exist/i` must be tested
- Once all environments have the migration applied, fallbacks can be removed (but rarely are — low risk to keep)

---

## ADR-011: Commission Corrected for Paid Plans

**Decision:** Creator and Professional plan hosts pay 0% commission (not 5% as originally seeded).

**Context:** The spec PRD JSON seeded all plans at 5% commission. The pricing spec (PRD §8) states paid plans should have 0% commission. There was a contradiction.

**Rationale:**
- The 0% commission is the key paid-plan selling point vs the free tier
- Charging 5% commission on paid subscribers would undermine the subscription value proposition

**Consequences:**
- `commission_percentage` corrected to 0% for Creator and Professional in `v2.1` seed + live DB
- `pricingEngine.js` receives commission % as a parameter — no hardcoded plan checks
- Future changes to commission % are made in the DB, not code

---

## Open Decisions

### OD-001: Multi-instance Cron Safety
**Status:** Open — single instance assumed.
**Issue:** 4 cron jobs run via `setInterval` in `server.js`. Multiple server instances would cause duplicate emails, duplicate badge evaluations, etc.
**Options:** Extract to separate worker, Supabase Edge Function scheduled tasks, leader election.

### OD-002: commission_percentage in subscription_plans vs pricingEngine
**Status:** Open.
**Issue:** `subscription_plans.commission_percentage` is in the DB but `planService` reads it and passes it to `pricingEngine`. The PRD JSON seeded all plans at 5% which contradicts the spec. Current code uses the spec (0% for paid).
**Resolution needed:** Confirm the source of truth for commission % and wire pricingEngine to always read from DB plan record.

### OD-003: Download Token Single-Use
**Status:** Open.
**Issue:** Product download tokens are UUIDs in `product_purchases.download_token`. They expire but are not single-use — the file can be downloaded multiple times before expiry.
**Options:** Mark as consumed after first download, or accept current behavior.

---

## Related Documentation
- [CHANGELOG.md](CHANGELOG.md) — what changed in each sprint
- [ROADMAP.md](ROADMAP.md) — what's planned
