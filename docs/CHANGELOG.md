# Changelog — Book A Sloth

All significant changes are recorded here by sprint. Most recent first.

---

## [Sprint 11] Support Chat — Bolt-to-Human, Admin Inbox & Live Escalation — 2026-08-25

### Added
- Support-chat backend — per-participant threads, messages, Supabase Realtime broadcast per thread, and admin queue/reply/assign/resolve ops (#762)
- Host + guest chat panels — one reusable `SupportChat` component (server derives host vs guest from the token), realtime bubbles, status banner, sidebar Chat item and guest Chat tab (#765, #767)
- Admin support-chat inbox at `/admin/support/chat` — waiting/mine/all queue → transcript → reply (auto-claims the thread) / mark resolved, live over the same broadcast (#769)
- Bolt auto-reply — the existing support bot answers support-chat messages while the thread is bot-handled, escalating to a human when it can't answer confidently (#770)
- Escalation alerts — a throttled email to the team on every handoff, plus a live ring on any open admin dashboard (`support:admin` broadcast → WebAudio tone, toast, tab-title flash) during support hours (#772)
- Unread badge on the Chat nav (host sidebar + guest tab) driven by a read-only `/support/unread` endpoint and a realtime `useSupportUnread` hook (#773)
- Support hours (Mon–Fri, 10am–6pm IST) — off-hours escalation becomes a logged ticket with honest expectation-setting and no admin ring; a required detailed-problem intake collects context before a human is assigned (#778)

### Changed
- Chat messages render Bolt's markdown (bold, links, lists, code) instead of raw text; the shared `<Markdown>` component gained *italic* and bare-URL autolinking (http/https only). Added a typing indicator and scroll preservation so incoming messages never yank the reader down (#776)
- The "Talk to a human" option is no longer a standing button — it surfaces only after Bolt has replied, nudging users to try the bot first (#778)

### Fixed
- Resolved-thread black hole — messaging a resolved thread now reopens it to the bot phase instead of posting into a thread the admin queue hides (#776)

---

## [Sprint 10] Host Onboarding Redesign, Invoicing & Payout Infrastructure — 2026-08-12

### Added
- Redesigned host onboarding — persona picker replacing raw category search, split-screen live preview folding About + WhatsApp into one screen, and a publish-moment plan step (#568, #569, #570)
- Studio annual plan preselected on the onboarding plan step (#603)
- Host earnings calculator on the pricing page (#567)
- Automatic GST invoicing — invoice emailed on payment with owner-gated dashboard download, plus self-heal + receipt email for subscription invoices (#573, #583, #576)
- Streamlined KYC — PAN + bank + address only, no document uploads; approved hosts can update payout details post-approval (#597, #602)
- Host payout infrastructure via Razorpay Route — linked-account onboarding on KYC approval, booking-linked held transfers released on completion, and an admin dispute queue with manual hold/reverse (#590, #591, #595, #598)

### Changed
- Host signup references the Host Agreement + Host Fees; onboarding step navigation and resume handling refined (#600, #605)
- Cleaner booking confirmation screen (#585)

---

## [Sprint 9] Bolt Support Bot Hardening + Pricing Redesign — 2026-07-23

### Added
- Pricing redesign — Relume-style shared `PricingCards` component reused on Home and `/pricing`, new 4th **Enterprise** tier linking to `/enterprise` (#485)
- Bolt admin console split into routed pages + FAQ category management (#484)
- Troubleshooting & error-message FAQ content for the support bot (#483)

### Changed
- Pricing plan cards & comparison table synced to a consistent width across Home and `/pricing`, then widened +15px each (960px → 1005px container) (#486, #487)
- Support-bot gaps closed from a 4-area audit — knowledge base, escalation, intent detection, and abuse handling (#488, #489)

### Fixed
- Bolt abuse-gate hardening — per-IP strike tracking (conversation-id no longer rotatable to reset strikes), durable IP-block store, threat cool-off window, and budget checks now fail closed (#490)

---

## [Sprint 8] Admin RBAC Foundation (M0 + M1) — 2026-06-11

### Added
- `admin_roles` table — 6 roles with permission arrays
- `admin_users` table — separate bcrypt credential store (not `auth.users`)
- `admin_audit_logs` table — append-only per-action log
- `lib/adminPermissions.js` — canonical catalog of 45 permissions + 6 roles
- `staffAdminController.js` — full CRUD for staff accounts with last-super + self-deactivate guards
- `opsAdminController.js` — real attention queue from live data
- `auditAdminController.js` — audit log viewer with pagination
- `services/adminAuthService.js` — bcrypt verify + JWT mint + fail-closed production check
- `services/auditService.js` — `audit()` helper called on every destructive admin action
- `middleware/maintenanceMiddleware.js` — 503 public traffic when maintenance_mode = true
- `AdminStaff.jsx` and `AdminAudit.jsx` — new admin UI pages
- `requireAdmin(permission)` middleware applied per-route across all admin endpoints
- 4 admin staff accounts seeded (superadmin, ops, finance, support)

### Changed
- `adminAuthController.js` — rewrote to authenticate against `admin_users` (username OR email + bcrypt), 5-fail/15-min lockout, JWT now carries role + permissions
- `AdminLogin.jsx` — username field instead of email only
- `AdminLayout.jsx` — permission-aware nav (hides items the role lacks)
- `SuperDashboard.jsx` — uses real `/ops/summary` endpoint (removed fake data)
- `getStats` revenue bug fixed — now correctly sums `platform_fee_amount + commission_applied`

### Fixed
- Removed dangerous `POST /admin/cleanup-users` endpoint
- Admin JWT secret now fails closed in production (throws on startup if unset)

---

## [Sprint 7] Email Communication Engine — 2026-06-10

### Added
- `email_settings` table — provider config + brand config
- `email_templates` table — DB-stored templates, keyed by event_key + audience
- `email_logs` table — queue status + delivery log
- 29 email templates seeded (`config/emailTemplates.js` + `scripts/seedEmailTemplates.js`)
- `services/email/communicationEngine.js` — render → queue/send → log
- `services/email/placeholderResolver.js` — `{{snake_case}}` variable substitution
- `services/email/emailLayout.js` — shared 600px HTML shell
- `services/email/providers/` — SMTP, Resend, SES behind factory
- Email queue worker in `server.js` (every 60s, retry backoff 5m/30m/2h)
- `emailAdminController.js` — template CRUD, preview, test send, logs, settings
- `AdminCommunication.jsx` — full email management UI with live iframe preview

### Changed
- `notificationEngine.js` email path delegates to `communicationEngine` (no more inline HTML in business logic)
- All email callers migrated: auth, booking, payment, badge, onboarding

### Migration
- `v2.3_email_communication_engine.sql`

---

## [Sprint 6] Final Commission / Fees / Payout Model — 2026-06-10

### Added
- New columns on `bookings`: `platform_fee_gst`, `razorpay_fee_actual`, `customer_total`, `gst_rate`
- `services/platformConfig.js` — cached DB reads for fee + GST rate
- `pricingEngine.computeBreakdown()` — single function replacing tiered fee logic

### Changed
- `pricingEngine.js` fully rewritten — pure, config-injectable, commission% as param
- `bookingController` — uses `computeBreakdown` + stores all new snapshot columns
- `paymentController.createOrder` — charges `customer_total` (incl. GST)
- `paymentController.verifyPayment` — fetches actual Razorpay fee from API, finalises `vendor_amount`
- `ServiceBooking.jsx` — shows Platform fee + GST in checkout
- Commission corrected: paid plans now 0% (were 5%)

### Migration
- `v2.2_payout_model.sql`

---

## [Sprint 5] Subscription Plans Module v1.1 — 2026-06-10

### Added
- `subscription_plans` table — limits/features/integrations JSONB, commission%, sort_order
- 3 plans seeded: Starter (₹0), Creator (₹999), Professional (₹3,650)
- `services/planService.js` — cached DB reads, legacy alias explorer→starter, fallback defaults
- `planAdminController.js` — plan CRUD, clone, archive, reorder, assign
- `AdminPlans.jsx` — full plan management UI
- `GET /api/plans` — public pricing endpoint

### Changed
- `planMiddleware.js` rewritten to be fully DB-driven
- Booking limit changed from per-month to per-subscription-year (anchored to `plan_activated_at`)
- `paymentController` plan prices read from DB (removed hardcoded `PLAN_PRICES`)
- Plan expiry fixed: 30 days → 365 days

### Migration
- `v2.1_subscription_plans.sql`

---

## [Sprint 4] Badge System — 2026-06-10

### Added
- `badge_categories`, `badges`, `badge_rules`, `vendor_badges` tables
- `vendor_metrics` SQL view — 14 aggregate metrics per vendor
- `services/badgeEngine.js` — rule evaluator with award/revoke logic
- Hourly badge cron + event hooks on booking completion and review creation
- `badgeAdminController.js` — CRUD, rule preview, vendor assign/revoke
- `badgePublicController.js` — public badge display with negative badge filtering
- `AdminBadges.jsx` — badge management UI with visual rule builder
- `BadgeShowcase.jsx` — public badge display with accessible modal

### Known Gaps
- `avg_response_time_minutes` and `login_streak` metrics have no data source (return 0)
- Badge image upload uses URL field (no dedicated upload pipeline yet)

### Migration
- `v2.0_badge_system.sql`

---

## [Sprint 3] Dynamic Notification System — 2026-06-10

### Added
- `notification_providers`, `notification_events`, `notification_logs` tables
- `services/notificationEngine.js` — central event dispatcher
- `services/aisensyService.js` — AiSensy WhatsApp API client
- `notificationAdminController.js` — provider CRUD, test, events, logs, retry
- `AdminNotifications.jsx` — notification management UI

### Changed
- `otpStore.js` rewritten — bcrypt hash, 10-min TTL, 3-attempt lockout, 3 sends/hour
- All callers migrated to `notificationEngine` events (auth, booking, payment)

### Fixed
- Undefined `sendAppointmentWhatsApp` bug in booking controller (was crashing on WhatsApp calls)

### Migration
- `v1.9_notification_system.sql`

---

## [Sprint 2] Bug Fixes + Project Memory Setup — Prior to 2026-06-10

### Fixed
- **BUG-16:** Logged-in users required OTP — `bookDirectly()` path bypasses OTP for authenticated users
- **BUG-commission_applied:** Booking INSERT failed on pre-v1.7 DBs — added schema fallback pattern
- **BUG-OTP:** OTPs lost on server restart — `otpStore.js` rewritten to use `otp_codes` Supabase table
- **ServicesList URL:** View Public Page icon pointed to non-existent route — fixed to `/:username/booking/:slug`
- **BookingController truncated:** File was cut off at line 706 — `processReminders` function restored

### Added
- `CLAUDE.md` project memory file at repo root
- 11 `docs/*.md` files (initial project documentation)

### Migration
- `v1.7_pricing_snapshot.sql` — adds `commission_applied` to `bookings`

---

## [Sprint 1] Initial Platform — Pre-Documentation

### Core Features Shipped
- Vendor + guest authentication (Supabase Auth + custom profile layer)
- 10-step vendor onboarding flow
- Service management v2 (rich fields, slugs, toggle, duplicate)
- Availability editor (weekly schedule, blocked dates, timezone, buffer)
- Guest booking flow (OTP + Razorpay)
- Host dashboard (bookings, earnings, payouts, transactions)
- Public host profile with theme color + plan-gated avatar border
- Google Calendar integration for online bookings
- Digital products (upload, purchase, download via token)
- Reviews (API + display)
- Admin panel (users, bookings, services, settings)
- Booking reminders (24h + 1h, cron-driven)
- Reschedule flow with guest acknowledgement
- Pricing engine (platform fee + commission)
- Security middleware (Helmet, rate limiting, HPP, XSS-clean)

---

## Related Documentation
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — current state
- [DECISIONS.md](DECISIONS.md) — why key decisions were made
