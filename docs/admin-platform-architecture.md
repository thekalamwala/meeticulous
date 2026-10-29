# Admin Platform Architecture — Meeticulous
_Phase 1 deliverable: audit, gap analysis, information architecture, RBAC, database impact, module plan, design system, priorities._
_Date: 2026-06-10. Status: AWAITING APPROVAL — no code written._

---

# PART A — ADMIN PLATFORM AUDIT

## A1. Existing admin functionality (working, backend + UI)

| Area | What works | Where |
|---|---|---|
| Admin auth | Single-step email+password login at `/hello-sloth`. Allow-listed email (`SUPER_ADMIN_EMAIL`) + `profiles.role='superadmin'` check. Isolated HS256 JWT (8h TTL, `SUPER_ADMIN_JWT_SECRET`), stored in `localStorage['bas_admin']`. Fully isolated from vendor/user sessions. | `adminAuthController.js`, `adminMiddleware.js`, `AdminLayout.jsx` guard |
| Dashboard stats | Counts for users/vendors/bookings/services; paid/refunded counts. | `adminController.getStats`, `SuperDashboard.jsx` |
| Users | List with role filter, search, pagination. Detail view with booking/service counts. Update role, `is_verified`, `is_banned`, `admin_notes`, name, email (synced to Supabase Auth). Delete (cascade). | `adminController.js`, `AdminUsers.jsx` |
| Bookings | List with status filter + pagination, joined service + host. Update status / payment_status. Delete. | `adminController.js`, `AdminBookings.jsx` |
| Services | List all with host join. Delete. | `adminController.js`, `AdminServices.jsx` |
| Platform settings | Key-value `platform_settings` read/write (platform_name, platform_fee, maintenance_mode toggle). Saving busts the pricing config cache so fee edits apply live. | `adminController.js`, `AdminSettings.jsx`, `platformConfig.js` |
| Notification system (WhatsApp/AiSensy) | Provider config (masked key), test connection, per-event channel toggles + campaign mapping, test send, delivery logs, retry. | `notificationAdminController.js`, `AdminNotifications.jsx` |
| Badge system | Full CRUD, visual rule builder with live vendor-count preview, manual evaluate, per-vendor assign/revoke with required reason, soft-revoke history. | `badgeAdminController.js`, `AdminBadges.jsx` |
| Subscription plans | Create/edit/archive/restore/clone/reorder/assign; min 2 / max 3 active plans enforced; DB-driven limits + commission%. | `planAdminController.js`, `AdminPlans.jsx` |
| Email communication engine | DB templates CRUD/duplicate/archive, live iframe preview, test send, queue + delivery logs with retry, provider settings (SMTP/Resend/SES), event registry. | `emailAdminController.js`, `AdminCommunication.jsx` |

This is a genuinely strong base: the four config-driven engines (notifications, badges, plans, email) are the most production-grade parts of the platform.

## A2. Partially implemented

| Item | State | Gap |
|---|---|---|
| SuperDashboard | Real stats wired | Trend percentages hardcoded (12/8/3/5), revenue chart is fake static bars, "Pending Actions" hardcoded `0` |
| `getStats` revenue | Endpoint exists | **Bug:** selects `services(price)` but sums `b.platform_fee_amount`, which is never selected → revenue is always ₹0. Also predates the v2.2 money model (ignores commission + GST split) |
| AdminProviders | Lists hosts via `adminGetUsers` + can update | No host-specific data (earnings, bookings, cancellation/refund rates, payout status); "pending/suspended" tabs not backed by a verification state machine |
| Payouts | `payout_requests` table + vendor request/balance endpoints exist | **No admin endpoints at all** to view/approve/reject/hold/release; `AdminEarnings.jsx` is an empty shell |
| Reviews | `reviews` table + public display | No moderation state, no admin endpoints, `AdminReviews.jsx` is a shell |
| Maintenance mode | Toggle saved to `platform_settings` | **Enforced nowhere** — no middleware reads it |
| Audit logging | `auditLog()`/`securityLog()` write to file/console logger | Not persisted to DB, not queryable, not surfaced in admin |
| Admin header | Search (⌘K), bell, dark mode toggle rendered | All three are non-functional decoration |
| Email branding | `email_settings` holds brand config for the email shell | No general platform branding (logo/favicon/colors) |

## A3. Missing functionality (no backend, vs the admin brief)

1. **RBAC** — one hardcoded super-admin role; no staff accounts, roles, or permissions (sidebar items exist, disabled).
2. **Audit logs (DB)** — no `admin_audit_logs` table or viewer.
3. **Impersonation** ("login as user").
4. **Payout operations** — approve/reject/hold/retry/manual/release workflow.
5. **Refund processing** — no Razorpay refund API integration anywhere; `payment_status='refunded'` is only an enum value set by hand.
6. **Transactions ledger** — no unified view across bookings, plan purchases, product purchases.
7. **Commission overrides** — platform-level fee + per-plan % exist, but no category / per-professional / promotional overrides and no commission reports.
8. **Coupons, discounts, promo campaigns, trials** — nothing.
9. **Support center** — no tickets/disputes tables or endpoints.
10. **CMS** — no tables for pages, blogs, newsletter, FAQ, testimonials, menus, footer.
11. **SEO** — no meta/OG/redirects/sitemap management.
12. **Analytics** — no GMV/MRR/ARR/churn/conversion; only raw counts.
13. **Customer success** — no at-risk/inactive/trial-expiry/high-performer views.
14. **Referral / affiliate systems** — nothing.
15. **Integrations hub** — Razorpay/Google keys live in env with no admin visibility; no Stripe/Outlook/Zoom.
16. **Platform health** — no queue depth, cron heartbeat, failed-job, or API status monitoring.
17. **Operations center** — no unified "what needs attention" dashboard (the brief's default homepage).
18. **Feature flags** — nothing.
19. **System announcements** — nothing.
20. **KYC** — nav + shell page exist; no tables, storage, or workflow.
21. **Service categories / featured services** — routes exist (`/admin/services/categories|featured`) but no `category`/`is_featured` data model.
22. **User activity / support history on user profile** — not aggregated anywhere.

## A4. Duplicate functionality

| Duplicate | Detail | Resolution |
|---|---|---|
| `SuperDashboard` vs `AdminOverview` | Two dashboard pages; `AdminOverview` is lazy-imported in `App.jsx` but **has no route** — dead code | Delete `AdminOverview.jsx`; SuperDashboard becomes Operations Center |
| `AdminUsers` vs `AdminProviders` | Both edit the same `profiles` rows through the same two API calls | Keep both pages but split cleanly: Users = guests/accounts; Providers = host-specific operational view with its own endpoints |
| Notifications vs Communication | Two config systems (`notification_providers` + `email_settings`), two log stores (`notification_logs` + `email_logs`), two admin pages | Keep engines separate (they are channel-specific), unify the *monitoring* surface in one Notification Center with channel tabs |
| Disputes ×2 in nav | `/admin/bookings/disputes` (Operations → Bookings) and `/admin/support/disputes` (Support) | One canonical Disputes page under Support; bookings page links to it |
| `profiles.badges` JSONB (v1.6) vs `vendor_badges` table (v2.0) | Legacy column superseded by the badge system | Mark legacy column deprecated; drop in a cleanup migration |
| `app_settings` (docs) vs `platform_settings` (code) | `database-schema.md` documents a table name the code never uses | Fix the doc; `platform_settings` is canonical |

## A5. Functionality that should not exist

1. **`POST /api/admin/cleanup-users`** — deletes every Supabase Auth user except one hardcoded-fallback email (`sndatarkar@gmail.com`). A dev-reset tool exposed on the production admin API behind a single shared admin token. **Remove from `adminRoutes.js`** (keep as an offline script if needed).
2. **Fake dashboard data** — hardcoded trend %, fake revenue chart, fake pending count. Worse than no data: it misinforms operators. Remove until real.
3. **Decorative controls** — non-functional search, bell, dark-mode toggle. Remove or implement; dead controls erode trust in an ops tool.
4. **Hardcoded email fallbacks in code** — `SUPER_ADMIN_EMAIL` defaulting to `book@meeticulous.com`, `PROTECTED_EMAIL` defaulting to a personal Gmail. Fail closed (refuse to boot admin auth without env) instead of failing open to a guessable default.
5. **Random JWT-secret fallback** — admin sessions silently die on restart if `SUPER_ADMIN_JWT_SECRET` unset; should be a hard startup error in production.

## A6. Technical constraints discovered

1. **Supabase + `supabaseAdmin`** — all admin queries bypass RLS via service-role key; every admin capability must stay server-side. No stored-proc/RPC layer in use; controllers compose queries directly.
2. **Schema-fallback convention** — live DB can lag migrations; every SELECT/INSERT touching new columns needs the documented fallback pattern. Admin modules must follow it.
3. **In-process cron via `setInterval`** (reminders 5m, OTP cleanup 60m, email queue 60s, badge engine 60m) — single-instance assumption, no Redis/BullMQ. "Queues" are DB tables (`email_logs.status`). Platform-health monitoring must be built on DB state + heartbeats, not a job framework.
4. **Custom admin JWT** — HS256, 8h, no refresh, no roles in payload beyond `type:'super_admin'`. RBAC must extend this token and `adminMiddleware` without touching the Supabase vendor/user auth path.
5. **Razorpay only** — orders + manual verify + webhook (HMAC-verified, raw-body ordering constraint in `server.js`). No RazorpayX (payout rails), no refund API usage yet. Stripe absent.
6. **WhatsApp = AiSensy** via notification engine (DB-configured). No Twilio code exists in this repo.
7. **Rate limiting** — `/api` global 100 req/15min applies to admin too; a busy ops console will hit it. Admin needs its own limiter bucket.
8. **Admin UI visual language deviates from the documented design system** — dark `#0C0C0C` sidebar, Inter font, and ad-hoc accent colors (violet/blue/emerald/pink/amber), versus the documented Friendly Brutalism (Plus Jakarta Sans/Poppins, 4 brand colors). Must be reconciled (see Part I).
9. **Test culture exists** — server 172 Jest tests, client 113 Vitest. New admin modules are expected to ship with tests.
10. **Docs drift** — feature-map/architecture docs describe admin auth as OTP-based (it is password-based), and `app_settings` (actually `platform_settings`). Update docs with this plan.
11. **Known business contradiction** — `subscription_plans.commission_percentage` seeded at 5% for ALL plans per spec JSON, while `pricingEngine` charges paid plans 0%. Must be resolved before building commission reporting (reports would disagree with payouts).

## A7. Recommendations (summary)

1. Build **RBAC + DB audit logs first** — every other module mounts on `requirePermission(...)` and `audit(...)`; retrofitting later means touching every endpoint twice.
2. Make the **Operations Center the default admin homepage**, fed by real failure/pending queries (failed emails/WhatsApp, stale unpaid bookings, pending payouts/verifications). Delete fake data the same day.
3. **Money next**: payout approval workflow, unified transactions ledger (SQL view over existing tables — no new ledger table needed initially), Razorpay refunds. These are revenue-trust features and the schema already snapshots everything needed.
4. Treat **reviews moderation, tickets/disputes, platform health** as the second wave; **analytics + customer success** third; **CMS/SEO/branding** fourth. CMS is the largest net-new surface and the least operationally urgent.
5. **Defer**: referrals, affiliates, Stripe/Outlook/Zoom, white-label, push notifications, CRM, AI assistant, mobile controls. Keep them as disabled nav items only if marked clearly.
6. Remove `cleanup-users`, enforce `maintenance_mode`, fix the `getStats` revenue bug immediately (small, high-trust wins).

---

# PART B — GAP ANALYSIS (brief requirement → status)

Legend: **DONE** = production-usable · **PART** = exists but incomplete · **MISS** = absent

| Brief area | Status | Notes |
|---|---|---|
| Platform settings / global config | PART | Key-value store works; few keys defined; maintenance mode not enforced |
| Brand settings | PART | Email branding only |
| Feature flags | MISS | |
| System announcements | MISS | |
| Users: view/search/filter/manage | DONE | |
| Users: suspend/ban/restore/verify | DONE | `is_banned`/`is_verified` toggles (suspend≡ban today — single flag) |
| Users: activity, support history, internal notes | PART | `admin_notes` exists; no activity/support aggregation |
| Users: impersonation | MISS | |
| Users: view subscriptions/payments | PART | Data exists in `plan_purchases`/bookings; not surfaced on user detail |
| Professionals: verify/approve/reject | PART | `is_verified` flag only; no application/KYC workflow |
| Professionals: feature | MISS | No `is_featured` |
| Professionals: performance/earnings/rates | MISS | Data derivable from `vendor_metrics` view + bookings; no admin surface |
| Bookings: view/search/filter | DONE | Search missing (filter+paginate only) |
| Bookings: cancel/reschedule/refund | PART | Status update exists; no admin-initiated reschedule or refund |
| Bookings: disputes, timelines, failure investigation | MISS | |
| Payments: transactions/refunds/failed/commission/revenue | MISS | Snapshots exist on rows; no admin views |
| Gateway monitoring | MISS | |
| Payouts (all of it) | MISS | Vendor-side request flow only |
| Commission engine | PART | Platform fee + per-plan % live; no overrides/reports; 5%-vs-0% contradiction |
| Subscription plans CRUD | DONE | |
| Coupons/discounts/campaigns/trials | MISS | |
| Manual upgrades/downgrades | DONE | `plans/assign` |
| Email system | DONE | Templates, logs, monitoring, settings, previews |
| WhatsApp system | DONE | Templates(campaigns), logs, retry, provider mgmt via AiSensy |
| Notification center (unified) | PART | Two separate log UIs; no SMS/in-app channels |
| Support center | MISS | |
| Reviews moderation | MISS | |
| CMS (all of it) | MISS | Shell pages only |
| SEO | MISS | |
| Analytics (GMV/MRR/ARR/churn/…) | MISS | |
| Customer success | MISS | |
| Referral / affiliate | MISS | |
| Integrations management | PART | Email + AiSensy in DB; rest env-only, invisible |
| Branding | PART | Email shell only |
| Audit logs | PART | File logger only |
| Roles & permissions | MISS | |
| Platform health | MISS | |
| Operations center | MISS | |

---

# PART C — INFORMATION ARCHITECTURE

Principle: organized by **operator job-to-be-done**, not by database table. Eight domains. The Operations Center is the homepage.

```
ADMIN PLATFORM
│
├── 1. OPERATIONS CENTER (default homepage  /admin)
│     Attention queue: failed payments, failed emails/WhatsApp,
│     pending payouts, pending verifications, open tickets,
│     stale unpaid bookings, critical incidents. Each row deep-links
│     to the owning module, pre-filtered.
│
├── 2. PEOPLE
│     ├── Users (guests + accounts)           — search, detail, suspend/ban/verify,
│     │     notes, activity, subscriptions, payments, support history, impersonate
│     ├── Professionals (hosts)               — roster, verification queue, feature,
│     │     performance (earnings, bookings, reviews, cancellation/refund rates, payout status)
│     └── KYC                                 — submission queue, approve/reject, document view
│
├── 3. BOOKINGS
│     ├── All bookings                        — search/filter, timeline, cancel/reschedule/refund
│     ├── Disputes (link → Support)
│     └── Failure investigation               — created-but-unpaid, webhook mismatches
│
├── 4. FINANCE
│     ├── Transactions                        — unified ledger (bookings + plans + products)
│     ├── Refunds                             — issue, track, Razorpay status
│     ├── Payouts                             — pending/scheduled/failed/held queues, approve,
│     │     reject, hold, release, retry, manual payout
│     ├── Commission                          — current rules, overrides, reports
│     └── Gateway                             — Razorpay order/webhook health
│
├── 5. GROWTH
│     ├── Plans & pricing                     — (existing AdminPlans)
│     ├── Coupons & campaigns                 — (new)
│     ├── Analytics                           — revenue, GMV, MRR/ARR, churn, growth, conversion
│     ├── Customer success                    — at-risk, inactive, trial-expiry, top performers
│     └── Referrals / Affiliates              — (deferred)
│
├── 6. ENGAGEMENT
│     ├── Communication (email)               — (existing AdminCommunication)
│     ├── WhatsApp                            — (existing AdminNotifications)
│     ├── Notification Center                 — unified cross-channel monitor
│     ├── Badges                              — (existing AdminBadges)
│     └── Announcements                       — (new)
│
├── 7. CONTENT
│     ├── Pages (incl. homepage, pricing, features)
│     ├── Blog
│     ├── FAQ
│     ├── Testimonials
│     ├── Navigation & Footer
│     └── SEO (meta, OG, redirects, sitemap)
│
├── 8. SUPPORT
│     ├── Tickets                             — queue, assignment, escalation, internal notes
│     ├── Disputes                            — booking-linked dispute workflow
│     └── Reviews moderation                  — approve/reject/abuse queue
│
└── 9. SYSTEM
      ├── Platform settings                   — fees, GST, toggles, maintenance mode
      ├── Branding                            — logo, favicon, colors, email branding
      ├── Feature flags
      ├── Integrations                        — Razorpay, Google, SMTP, AiSensy status + tests
      ├── Platform health                     — queues, crons, failed jobs, API/DB status
      ├── Roles & permissions                 — staff, roles, permission matrix
      └── Audit logs                          — searchable admin action trail
```

---

# PART D — NAVIGATION ARCHITECTURE

## D1. Sidebar structure (permission-aware)

Every section and item carries a `permission` key; the sidebar renders only what the staff member's role grants. Section disappears if all items are hidden.

```
[Logo] Meeticulous — Admin            (role chip: e.g. "Finance Admin")

OPERATIONS
  Operations Center        ops.view            /admin            (default)
  Bookings                 bookings.view       /admin/bookings
  Services                 services.view       /admin/services

PEOPLE
  Users                    users.view          /admin/users
  Professionals            professionals.view  /admin/professionals
  KYC                      kyc.view            /admin/kyc

FINANCE
  Transactions             finance.view        /admin/finance/transactions
  Refunds                  finance.refund      /admin/finance/refunds
  Payouts                  payouts.view        /admin/finance/payouts
  Commission               commission.view     /admin/finance/commission

GROWTH
  Plans                    plans.view          /admin/plans
  Coupons                  coupons.view        /admin/coupons
  Analytics                analytics.view      /admin/analytics
  Customer Success         analytics.view      /admin/customer-success

ENGAGEMENT
  Notification Center      notifications.view  /admin/notifications
  Email Templates          email.manage        /admin/communication
  WhatsApp                 whatsapp.manage     /admin/whatsapp
  Badges                   badges.manage       /admin/badges
  Announcements            announcements.manage /admin/announcements

CONTENT
  Pages                    cms.manage          /admin/content/pages
  Blog                     cms.manage          /admin/content/blog
  FAQ                      cms.manage          /admin/content/faq
  Testimonials             cms.manage          /admin/content/testimonials
  Navigation & Footer      cms.manage          /admin/content/navigation
  SEO                      seo.manage          /admin/content/seo

SUPPORT
  Tickets                  support.view        /admin/support/tickets
  Disputes                 disputes.view       /admin/support/disputes
  Reviews                  reviews.moderate    /admin/support/reviews

SYSTEM
  Settings                 settings.manage     /admin/system/settings
  Branding                 branding.manage     /admin/system/branding
  Feature Flags            flags.manage        /admin/system/flags
  Integrations             integrations.view   /admin/system/integrations
  Platform Health          health.view         /admin/system/health
  Staff & Roles            staff.manage        /admin/system/staff
  Audit Logs               audit.view          /admin/system/audit
```

## D2. Navigation behaviors

- **Breadcrumbs**: keep the existing segment-label breadcrumb (works well).
- **Status-filter URLs**: list pages take `?status=&q=&from=&to=&page=` query params (not path segments like today's `/admin/bookings/upcoming`) so filters compose; old paths 301-redirect.
- **Command palette (⌘K)**: implement for real — fuzzy jump to any nav item + "go to user/booking by id/email". Phase 2 of dashboard work; until then remove the dead button.
- **Deep links from Ops Center**: every attention row links to its module pre-filtered (e.g. `/admin/finance/payouts?status=pending`).
- **Disabled = invisible**: stop rendering "soon"-locked items for roles that could never use them; Super Admin sees a single "Coming soon" group if desired.
- **Mobile**: keep existing drawer pattern; tables collapse to card lists below `md`.

---

# PART E — ROLES & PERMISSIONS (RBAC)

## E1. Model

- **`admin_users`** — staff accounts in a **fully separate credential store** (DECIDED 2026-06-11): own `password_hash` (bcrypt, same lib as `otpStore`), NOT keyed to `auth.users`. Customer auth and staff auth never touch. We own: password reset (email OTP via the existing communication engine), lockout policy (`failed_attempts` + `locked_until`, mirroring the v1.9 `otp_codes` hardening), and invitation flow (set-password link emailed on staff creation). The existing super admin is seeded from `SUPER_ADMIN_EMAIL` with a one-time bootstrap password set via env on first boot.
- **`admin_roles`** — named roles holding a permission array. Seeded with the six below; custom roles possible later without schema change.
- **Permissions are static strings** (`resource.action`) checked server-side. The JWT carries `role_key`; the permission set is loaded from DB per request (60s cache) so role edits apply within a minute without re-login.
- **Middleware**: `requireAdmin(permission)` replaces `requireSuperAdmin`. `requireSuperAdmin` remains as `requireAdmin('*')` for the most dangerous routes (staff mgmt, impersonation, flags).
- **Frontend**: `PermissionGate` component + `useAdminPermissions()` hook; sidebar and per-page actions both gate on the same strings. UI gating is cosmetic only — the server check is authoritative.
- **Every mutating admin endpoint calls `audit(...)`** (Part F) — RBAC and audit ship together.

## E2. Permission catalog (initial ~40)

```
ops.view
users.view  users.edit  users.suspend  users.delete  users.impersonate
professionals.view  professionals.verify  professionals.feature
kyc.view  kyc.decide
bookings.view  bookings.edit  bookings.cancel
finance.view  finance.refund
payouts.view  payouts.approve  payouts.release  payouts.manual
commission.view  commission.edit
plans.view  plans.manage
coupons.view  coupons.manage
analytics.view
notifications.view  email.manage  whatsapp.manage
badges.manage  announcements.manage
cms.manage  seo.manage
support.view  support.assign  disputes.view  disputes.decide
reviews.moderate
settings.manage  branding.manage  flags.manage
integrations.view  integrations.manage
health.view  staff.manage  audit.view
```

## E3. Role matrix

| Permission group | Super | Operations | Support | Finance | Marketing | Developer |
|---|---|---|---|---|---|---|
| ops.view | Y | Y | Y | Y | Y | Y |
| users.view / edit | Y | Y | Y (view) | — | — | — |
| users.suspend / delete | Y | Y / — | — | — | — | — |
| users.impersonate | Y | — | — | — | — | — |
| professionals.* / kyc.* | Y | Y | view | — | — | — |
| bookings.* | Y | Y | view, cancel | view | — | — |
| finance.view / refund | Y | view | view | Y | — | — |
| payouts.* | Y | view | — | Y | — | — |
| commission.* | Y | view | — | Y | — | — |
| plans / coupons | Y | view | — | view | Y | — |
| analytics.view | Y | Y | — | Y | Y | — |
| email / whatsapp / notifications | Y | view | view | — | Y | Y (view) |
| badges / announcements | Y | Y | — | — | Y | — |
| cms / seo | Y | — | — | — | Y | — |
| support / disputes / reviews | Y | Y | Y | — | — | — |
| settings / branding / flags | Y | — | — | — | branding | flags |
| integrations.* | Y | — | — | — | — | Y |
| health.view | Y | Y | — | — | — | Y |
| staff.manage | Y | — | — | — | — | — |
| audit.view | Y | Y | — | Y | — | Y |

Rules baked in: only Super Admin can impersonate, delete users, or manage staff. Refunds and payout release are Finance + Super only. Two-person principle (e.g. payout > ₹X needs second approval) is schema-supported (`approved_by` + `released_by` are separate columns) but enforcement is a later toggle.

---

# PART F — DATABASE IMPACT ASSESSMENT

## F1. New tables (migration series v2.4+)

```sql
-- v2.4 RBAC + audit (foundation)
admin_users        (id UUID PK DEFAULT gen_random_uuid(), email TEXT UNIQUE, name,
                    password_hash TEXT, role_key FK, is_active BOOL,
                    must_set_password BOOL, invite_token TEXT, invite_expires_at,
                    failed_attempts INT, locked_until TIMESTAMPTZ,
                    created_by, last_login_at, created_at)
                    -- separate credential store: NOT linked to auth.users
admin_roles        (key TEXT PK, name, description, permissions JSONB, is_system BOOL)
admin_audit_logs   (id, admin_id, admin_email, action TEXT, resource_type TEXT,
                    resource_id TEXT, before JSONB, after JSONB, ip, user_agent,
                    created_at)  -- indexes: (admin_id), (resource_type, resource_id), (created_at DESC)

-- v2.5 finance operations
refunds            (id, booking_id FK, amount, reason, status
                    [initiated|processing|processed|failed], razorpay_refund_id,
                    initiated_by → admin_users, processed_at, created_at)
payout_requests    ALTER: + status values [pending|approved|processing|paid|rejected|held],
                    + approved_by, + released_by, + rejection_reason, + hold_reason,
                    + payment_reference, + processed_by, + updated_at
admin_transactions VIEW: UNION of bookings (paid), plan_purchases, product_purchases,
                    refunds — normalized: id, type, gross, fees, commission, gst,
                    net, counterparty, occurred_at

-- v2.6 support + moderation
support_tickets    (id, subject, requester_id/email, vendor_id NULL, booking_id NULL,
                    type [support|dispute], status [open|pending|escalated|resolved|closed],
                    priority, assigned_to → admin_users, created_at, updated_at)
ticket_messages    (id, ticket_id FK, author_type [admin|user|system], author_id,
                    body, is_internal_note BOOL, created_at)
reviews            ALTER: + status TEXT DEFAULT 'approved' [pending|approved|rejected|flagged],
                    + moderated_by, + moderated_at, + flag_reason

-- v2.7 platform system
feature_flags      (key PK, enabled BOOL, description, audience JSONB, updated_by, updated_at)
announcements      (id, title, body, level [info|warning|critical],
                    audience [all|vendors|guests], starts_at, ends_at, created_by, active)
system_heartbeats  (job_key PK, last_run_at, last_ok_at, last_error, run_count)
                    -- written by each setInterval loop; powers Platform Health

-- v2.8 verification + catalog
profiles           ALTER: + verification_status [none|pending|approved|rejected]
                    (is_verified stays as the public badge; status drives the queue),
                    + is_featured BOOL, + suspended_at, + suspension_reason
kyc_submissions    (id, vendor_id FK, documents JSONB, status, reviewed_by,
                    review_note, submitted_at, reviewed_at)
service_categories (id, name, slug, sort_order, active)
services           ALTER: + category_id FK NULL, + is_featured BOOL

-- v2.9+ growth (build when module starts)
coupons            (id, code UNIQUE, type [percent|flat], value, applies_to
                    [plan|booking], plan_keys JSONB, max_redemptions, per_user_limit,
                    valid_from, valid_until, active, created_by)
coupon_redemptions (id, coupon_id, user_id, purchase_ref, redeemed_at)
commission_overrides (id, scope [vendor|category|promo], vendor_id NULL,
                    category_id NULL, percentage, reason, valid_from, valid_until,
                    created_by, active)

-- v3.x content (build when CMS starts)
cms_pages          (id, slug UNIQUE, title, blocks JSONB, seo JSONB,
                    status [draft|published], published_at, updated_by)
blog_posts         (id, slug, title, excerpt, body, cover_url, seo JSONB,
                    status, author, published_at)
faqs               (id, question, answer, category, sort_order, active)
testimonials       (id, author_name, author_role, body, avatar_url, sort_order, active)
nav_menus          (key PK [header|footer], items JSONB, updated_by, updated_at)
seo_redirects      (id, from_path UNIQUE, to_path, code [301|302], active)
```

## F2. Constraints & conventions

- All admin tables: RLS `deny_all` (service-role access only), matching `otp_codes` precedent.
- Follow the schema-fallback pattern for ALTERs on hot tables (`profiles`, `reviews`, `bookings`).
- `admin_audit_logs` is **append-only** — no UPDATE/DELETE endpoints, ever.
- The transactions ledger starts as a **VIEW** (zero migration risk, no backfill); materialize only if it gets slow.
- No changes to the money snapshot columns — analytics and finance read snapshots, never recompute (existing rule).

## F3. Settings keys to add to `platform_settings`

`maintenance_mode` (enforce!), `logo_url`, `favicon_url`, `brand_color_overrides` (admin-side only), `payout_minimum`, `payout_auto_hold_threshold`, `support_email`, `announcement_banner_enabled`.

---

# PART G — REQUIRED BACKEND MODULES

Pattern stays the same as existing code: `controllers/<x>AdminController.js` + routes mounted in `adminRoutes.js`, services in `server/services/`.

| # | Module | Endpoints (sketch) | Depends on |
|---|---|---|---|
| 1 | **adminAuth v2 + RBAC** | login (existing), `GET /me` (perms), staff CRUD `/admin/staff*`, roles `/admin/roles*` | v2.4 |
| 2 | **Audit service** | `audit(req, action, resource, {before, after})` helper; `GET /admin/audit?` search | v2.4 |
| 3 | **Ops Center** | `GET /admin/ops/summary` (counts), `GET /admin/ops/queue/:kind` (rows) | existing tables |
| 4 | **Payout admin** | `GET /admin/payouts?status=`, `POST :id/approve|reject|hold|release|retry`, `POST /admin/payouts/manual` | v2.5 |
| 5 | **Transactions** | `GET /admin/finance/transactions?` (view-backed, filter/search/export CSV) | v2.5 view |
| 6 | **Refunds** | `POST /admin/bookings/:id/refund` (Razorpay refund API), `GET /admin/finance/refunds`, webhook handler for `refund.processed/failed` | v2.5, Razorpay |
| 7 | **Professionals** | `GET /admin/professionals?` (joins `vendor_metrics` view), `:id` detail (earnings, rates, payout status), `POST :id/verify|reject|feature` | v2.8 |
| 8 | **User 360** | extend `getUserById`: subscriptions, payments, bookings, tickets, audit slice; `POST :id/impersonate` (Super only, magic-link via `supabaseAdmin.auth.admin.generateLink`, heavily audited) | v2.4 |
| 9 | **Reviews moderation** | `GET /admin/reviews?status=`, `POST :id/approve|reject|flag`; public queries filter `status='approved'` | v2.6 |
| 10 | **Support** | tickets CRUD, assign, escalate, internal notes, status flow; disputes = ticket type with booking link | v2.6 |
| 11 | **Notification Center** | `GET /admin/notifications/unified?channel=` — UNION read over `email_logs` + `notification_logs` with shared shape | existing |
| 12 | **Platform health** | `GET /admin/health` — queue depths (email queued/failed counts), cron heartbeats, DB ping, provider test status | v2.7 |
| 13 | **Flags + announcements** | CRUD both; `GET /api/announcements` public read; `maintenanceMiddleware` reading flag/setting | v2.7 |
| 14 | **Analytics** | `GET /admin/analytics/revenue|growth|subscriptions|funnel` — `date_trunc` group-bys over snapshots, plan_purchases, profiles | none |
| 15 | **Customer success** | `GET /admin/cs/at-risk|inactive|trial-expiry|top` — parameterized queries over bookings/plans | none |
| 16 | **Coupons** | CRUD + validate/redeem hooks in `paymentController` | v2.9 |
| 17 | **Commission** | rules view, overrides CRUD, reports (group by vendor/plan/period) | v2.9, contradiction resolved |
| 18 | **CMS + SEO** | pages/blog/faq/testimonials/menus CRUD; public render endpoints; redirects middleware; sitemap generator | v3.x |
| 19 | **Integrations status** | `GET /admin/integrations` — masked config presence + test endpoints (Razorpay ping, SMTP test exists, AiSensy test exists, Google token check) | none |
| 20 | **Branding** | settings keys + upload via existing Cloudinary pipeline | none |

Cross-cutting backend work:
- Replace `requireSuperAdmin` route-group with per-route `requireAdmin('perm')`.
- Dedicated admin rate-limit bucket.
- `maintenanceMiddleware` on public API (admins bypass).
- Remove `cleanup-users`; fix `getStats` revenue (sum `platform_fee_amount + commission_applied` from selected columns).
- Booking search (`q` over guest name/email, service title) on `getAllBookings`.

---

# PART H — REQUIRED FRONTEND MODULES

| # | Page/module | Route | Reuses |
|---|---|---|---|
| 1 | Operations Center (replaces SuperDashboard content) | `/admin` | StatCard, QueueCard, AdminTable |
| 2 | Staff & Roles | `/admin/system/staff` | AdminTable, Modal, PermissionMatrix editor |
| 3 | Audit Log viewer | `/admin/system/audit` | AdminTable, FilterBar, JsonDiff viewer |
| 4 | Payouts | `/admin/finance/payouts` | AdminTable, Drawer, ConfirmDialog |
| 5 | Transactions | `/admin/finance/transactions` | AdminTable, DateRange, CSV export |
| 6 | Refunds | `/admin/finance/refunds` + refund action inside Booking drawer | ConfirmDialog with amount input |
| 7 | Professionals | `/admin/professionals` (+ detail drawer) | AdminTable, StatChips |
| 8 | User 360 detail | drawer/page from `/admin/users` | Tabs (profile, bookings, payments, subs, tickets, notes, audit) |
| 9 | Reviews moderation | `/admin/support/reviews` | AdminTable, moderation actions |
| 10 | Tickets + Disputes | `/admin/support/tickets`, `/admin/support/disputes` | SplitPane (list + thread), MessageThread |
| 11 | Notification Center | `/admin/notifications` (tabs: All/Email/WhatsApp) | existing log tables |
| 12 | Platform Health | `/admin/system/health` | StatCard, HeartbeatList |
| 13 | Flags & Announcements | `/admin/system/flags`, `/admin/announcements` | ToggleRow, Form |
| 14 | Analytics | `/admin/analytics` | MetricChart, DateRange |
| 15 | Customer Success | `/admin/customer-success` | AdminTable presets |
| 16 | Coupons | `/admin/coupons` | AdminTable, Form |
| 17 | Commission | `/admin/finance/commission` | RuleList, Report table |
| 18 | CMS suite | `/admin/content/*` | BlockEditor (new, large), AdminTable |
| 19 | SEO | `/admin/content/seo` | Form, RedirectsTable |
| 20 | Integrations | `/admin/system/integrations` | StatusCard, TestButton |
| 21 | Branding | `/admin/system/branding` | UploadField (existing Cloudinary), ColorTokens |

Cross-cutting frontend work:
- `useAdminPermissions()` + `PermissionGate` + permission-aware `NAV` config.
- Shared `AdminTable` extraction (today every page hand-rolls its table).
- Delete `AdminOverview.jsx` (dead), the 16 shell pages get real implementations per the phases — until then their nav entries hide for non-super roles.
- Implement or remove header search/bell/dark-mode.

---

# PART I — ADMIN DESIGN SYSTEM REQUIREMENTS

## I1. Decision required (flagged as open question)

The live admin uses a dark-slate sidebar + Inter + ad-hoc accent colors (violet, blue, emerald, pink, amber). The documented design system is Friendly Brutalism with 4 brand colors. Per the brief ("existing 4 brand colors only, no new palette"), the target is:

| Token | Value | Admin usage |
|---|---|---|
| `--primary` `#FE5100` | brand orange | active nav, primary buttons, links, focus rings, key metrics |
| `--bg` `#FFF8EE` | warm off-white | page background |
| `--surface` `#FFFFFF` | white | cards, tables, drawers |
| `--text` `#1E1E1E` | ink | text, borders, sidebar background (ink works as the "dark" admin chrome) |
| `--success` `#4CAF50` / `--danger` `#EF4444` | existing semantic tokens | status badges only |

Concretely: **keep the dark sidebar but recolor it to ink `#1E1E1E`** (it is a brand color), strip violet/blue/emerald/pink/amber accents (all stat icons become ink-on-surface with orange for the highlighted metric), and move typography to Plus Jakarta Sans (headings) + Poppins (UI) per the design system. Density adaptations allowed for admin: smaller radii (`--radius-sm`), 1px ink borders instead of 6px hard shadows (full brutalist shadows are too loud for dense ops tables) — this is "Brutalism-lite": same tokens, quieter elevation.

## I2. Interaction standards (apply to every admin component)

- **Hover**: surface rows `background: rgba(30,30,30,0.03)`; buttons darken via existing `primary-dark`.
- **Focus**: visible 2px `--primary` outline on all interactive elements (keyboard-first ops tool).
- **Active nav**: orange left-rail + orange text (current pattern, recolored).
- **Transitions**: `--motion-fast` (120ms) for hovers, `--motion-base` (180ms) for drawers/modals. Nothing slower.
- **Icons**: keep the existing inline 24px stroke SVG set (`Ic`/`IC` maps) — consolidate into one shared `adminIcons.js` instead of three copies (AdminLayout, SuperDashboard, shells).
- **No emojis anywhere in admin UI.**
- **States, mandatory per page**: loading = skeleton rows (not spinners) · empty = `AdminEmptyState` (exists) with action button · error = inline retry panel with the message · partial-failure = toast (react-hot-toast, exists).

---

# PART J — COMPONENT INVENTORY

Existing, reusable as-is: `AdminLayout` (recolor), `AdminEmptyState`, breadcrumbs, toast, `fb-input`/`fb-btn`/`fb-card`/`badge` CSS classes, Cloudinary upload pipeline, iframe email preview.

To build (priority order):

| Component | Notes |
|---|---|
| `AdminTable` | THE workhorse: columns config, sort, server pagination, row click → drawer, bulk-select, sticky header, responsive card collapse, per-row action menu |
| `FilterBar` | composable: status select, date range, search input; syncs to URL query params |
| `Drawer` | right-side detail panel (user 360, booking detail, payout review) |
| `ConfirmDialog` | destructive confirm w/ typed-confirmation variant (refunds, deletes) |
| `StatusBadge` | single source for all status enums → color (success/danger/ink/orange only) |
| `StatCard` | exists in SuperDashboard — extract, remove fake trend props until real |
| `Tabs` | for detail views and Notification Center channels |
| `MetricChart` | one chart wrapper (line + bar). Library decision needed (recharts vs minimal inline SVG) — open question |
| `DateRangePicker` | analytics + filters |
| `PermissionGate` | wraps actions/nav by permission string |
| `AuditTrail` | renders before/after JSON diff rows |
| `MessageThread` | tickets/disputes conversation incl. internal-note styling |
| `BulkActionBar` | appears on table selection |
| `CopyField` | ids, emails, payment refs (ops staff copy these constantly) |
| `CommandPalette` | ⌘K — later phase |
| `BlockEditor` | CMS only — largest new component, defer with CMS |

---

# PART K — PRIORITY RANKING, BUILD ORDER, RISKS

## K1. Phased delivery

**Milestone 0 — Hygiene (days, do immediately)**
Remove `cleanup-users` route · fix `getStats` revenue bug · delete fake dashboard data + dead `AdminOverview` · remove dead header controls · hard-fail on missing `SUPER_ADMIN_JWT_SECRET`/`SUPER_ADMIN_EMAIL` in production · enforce `maintenance_mode` middleware.

**Milestone 1 — Foundation (RBAC + Audit + Ops Center)**
v2.4 migration · `admin_users`/`admin_roles` + staff UI · `requireAdmin(permission)` rollout across all existing admin routes · `audit()` in every mutating endpoint + viewer UI · permission-aware sidebar · Ops Center homepage with real queues.
_Everything else mounts on this. Nothing operational ships before it._

**Milestone 2 — Money (Finance suite)**
v2.5 migration · payout admin workflow · transactions ledger view + page · Razorpay refunds (API + webhook events) · booking detail drawer with cancel/refund · resolve commission 5%-vs-0% contradiction (decision needed) · commission report v1 (read-only).

**Milestone 3 — Trust & Operations**
v2.6 migration · reviews moderation · support tickets + disputes · professionals roster + verification queue (+ v2.8 profile columns) · user 360 detail · platform health page + heartbeats (v2.7) · unified Notification Center read view.

**Milestone 4 — Growth**
Analytics dashboards (revenue/GMV/MRR/ARR/churn/growth) · customer success queues · coupons (v2.9) · commission overrides · impersonation (Super-only, after audit is proven).

**Milestone 5 — Content & Brand**
CMS pages/blog/FAQ/testimonials/menus · SEO + redirects + sitemap · branding page · announcements UI (flag scaffold ships in M3 with v2.7).

**Deferred (explicitly out of scope until requested)**
Referrals, affiliates, Stripe, Outlook, Zoom, white-label, push notifications, CRM, marketing automation, AI assistant, mobile app controls, API keys.

## K2. Dependency graph

```
M0 hygiene ─┐
            ├─► M1 RBAC+Audit ─► M2 Finance ─► M4 Growth (commission/coupons)
            │         │
            │         ├─► M3 Trust & Ops ─► M4 (impersonation, CS)
            │         └─► permission-aware nav (all)
            └─ independent: analytics queries (M4) can start anytime after M0
M5 CMS depends only on M1 (cms.manage permission) — schedulable in parallel if capacity allows
```

## K3. Risks

| Risk | Mitigation |
|---|---|
| RBAC retrofit breaks existing admin flows | Default every existing route to Super-Admin-equivalent first, then narrow per-route; keep `bas_admin` token shape backward-compatible |
| Refund money errors | Refund amount always from booking snapshot (`customer_total`), never recomputed; idempotency key per booking; webhook is source of truth for terminal state |
| Commission contradiction (5% vs 0%) | BLOCKER for commission reports — needs a product decision before M2 reporting |
| Single-instance crons / no real queue | Acceptable now; heartbeats expose failures; revisit queue framework only if multi-instance deploys happen |
| Impersonation abuse | Super-only, audit-logged with reason field, time-boxed session, visible banner in impersonated UI |
| Supabase schema cache lag on new migrations | Follow established fallback pattern on every new column read |
| Admin restyle churn | Do the recolor once in M1 alongside sidebar permission work — single visual PR, not page-by-page |
| `/api` rate limit throttles ops staff | Dedicated admin limiter bucket in M1 |

---

# PART L — DECISIONS & REMAINING QUESTIONS

## L1. Decided (2026-06-10, product owner)

1. **Commission**: Free plan = 5%, paid plans = 0%. The pricing engine is correct; **fix the `subscription_plans` seed** (commission_percentage → 0 for Creator/Professional) so reports agree with payouts.
2. **Reviews moderation**: **PRE-moderation.** New reviews land as `status='pending'` and only show publicly after admin approval. Note: this changes public UX — `reviews` ALTER must default existing rows to `approved` (no retroactive hiding), and public review queries + host profile counts must filter `status='approved'`. Vendor should see "awaiting moderation" state for pending reviews on their own dashboard.
3. **Admin visual direction**: **Brutalism-lite, brand colors only** (ink #1E1E1E sidebar, orange sole accent, Jakarta/Poppins, 1px ink borders, green/red status only). Restyle lands as one PR inside Milestone 1.
4. **Impersonation**: **read-only "view as user" first**; full login-as deferred until audit logs are battle-tested.

## L2. Decided (2026-06-11, product owner) — all questions closed

5. **Staff identity**: **separate credential store.** `admin_users` holds its own bcrypt `password_hash`; no link to `auth.users`. Invitation + password reset flows go through the existing email communication engine. Lockout policy mirrors `otp_codes` hardening.
6. **Payout rails**: **manual transfers.** Admin approves in panel, pays outside the system, records `payment_reference`. Schema leaves room for RazorpayX later.
7. **KYC**: **build in M3, government photo ID only.** Single-document `kyc_submissions` flow: vendor uploads (existing Cloudinary pipeline), admin approves/rejects from queue, decision drives `profiles.verification_status`.
8. **Charts**: **recharts**, lazy-loaded into the admin bundle only.
9. **Phase 2 start**: **M0 + M1 as one cycle** (hygiene + RBAC/audit/restyle/Operations Center).
10. **Migrations**: **applied directly to the live Supabase DB via MCP** during each milestone (matching v1.9–v2.3 precedent), with schema-fallback patterns kept in code as the safety net.
11. **Staff at M1**: **small team (2–5).** Full staff UI ships in M1: invitations, role assignment, per-staff audit view, deactivation. Custom role creation UI deferred (roles editable via seeded set).

No open product questions remain. Phase 2 implementation plan may proceed.
