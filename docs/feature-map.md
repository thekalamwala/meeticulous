<!-- ============================================================= -->
<!-- CODE INDEX (ASH-91 guardrail #9, Part 2 / ASH-92).            -->
<!-- Reviews and new-context reads START HERE instead of reading   -->
<!-- the tree top-to-bottom. One section per subsystem: what it    -->
<!-- does, entry files, key functions, invariants, DB tables/flags.-->
<!-- Refresh the touched section as part of any PR that changes a  -->
<!-- subsystem's SHAPE (new route, new table, changed invariant) — -->
<!-- a one-paragraph diff, not a rewrite. The feature→file map      -->
<!-- (sections 1–20) stays below as the detailed reference.         -->
<!-- ============================================================= -->

# Code Index

> How to use: to review a diff, read (a) the diff, (b) the files it touches, (c) the direct
> callers/callees of changed functions (grep, don't bulk-read), and (d) the matching section
> here. Pull in a whole extra file only when the diff's correctness depends on it, and say which
> and why in the PR body. If a section is stale or missing the area you touch, fix that section
> in the same PR instead of re-reading everything.

### Auth
- **Entry:** `server/controllers/authController.js`, `server/utils/otpStore.js`, `server/middleware/authMiddleware.js`; client `client/src/context/AuthContext.jsx`, `pages/UnifiedLogin.jsx`, `GoogleAuthDone.jsx`, `LinkedinAuthDone.jsx`.
- **Key fns:** `sendOtp`, `verifyOtp` (booking), `verifyOtpLogin` (session), `loginWithPhone`, `loginUnified`, `linkedinHostAuth`; `otpStore.set(id, otp, type)` / `otpStore.verify(id, otp, expectedType)`.
- **Invariants:**
  - OTP is **namespaced by type**. Login codes are `'login'`-typed, phone-keyed, delivered **to the phone only** (never emailed); `verifyOtpLogin` verifies `'login'` only. A booking code (`'booking'`, emailed to the booker) must **never** authenticate a session (phone-account-takeover guard, audit C2).
  - Host login (`/login-as-vendor`) is Google **or** LinkedIn (`linkedin_oidc`, behind flag `host_linkedin_login`, ships OFF) — never email/password.
  - Guest identity = phone (WhatsApp OTP). One identity across guest+host doors; `mode` = `'traveling'`/`'hosting'`. Superadmin is never reachable by phone OTP.
  - A phone on `PUT /api/auth/me` with no OTP proof is still an **open hole** (audit H1) — do not rely on `guest_phone` for identity.
- **Tables/flags:** `profiles`, `otp_codes`; flag `host_linkedin_login`.

### Payments (Razorpay + Route payouts)
- **Entry:** `server/controllers/paymentController.js`, `server/lib/pricingEngine.js`, `server/lib/subscriptionPricing.js`, `server/services/bookingCapture.js`, `server/services/routeTransferService.js`, `server/services/settlementService.js`; client `ServiceBooking.jsx` (handlePayment), `UpgradePlan.jsx`, `ProductPurchase.jsx`.
- **Key fns:** `createOrder`/`verifyPayment` (booking), `createProductOrder`/`verifyProductPayment`, `createVendorSubscription`/`verifySubscription`, `handleWebhook` (`payment.captured`/`failed`/`refund.processed`), `finalizeBookingCapture`, `computeBooking*` in `pricingEngine.js`.
- **Invariants:**
  - **Razorpay is the source of truth; verify signatures server-side; never trust client pricing** — always snapshot.
  - Webhook `payment.captured` **binds** before finalising: payment's `order_id` must equal the booking's `razorpay_order_id` **and** `amount` must equal `customer_total` (paise); **bail on any kinded payment** (`notes.kind`, e.g. `reschedule_fee`) so a fee capture can't flip the booking paid (audit C3).
  - Pricing is caller-injected — **nothing about plans or rates is hardcoded** in `pricingEngine.js`. `commission% = plan row`; `commissionGst` is **extracted** (`commission − commission/(1+gstRate)`), not added. **TDS (194-O) + TCS (Sec 52) are flat 1% each on the base price**, govt's money, behind flag `tds_tcs_v2`. `payout = price − commission − razorpayFee − tds − tcs`.
  - A paid booking/product is **not our sale** — we invoice only our fee + commission.
- **Tables/flags:** `bookings`, `product_purchases`, `plan_purchases`, `payout_requests`, ledger tables; flag `tds_tcs_v2`, `reschedule_fee`.

### Bookings
- **Entry:** `server/controllers/bookingController.js`, `server/services/availabilityService.js`, `server/services/bookingConfirmation.js`; client `ServiceBooking.jsx`, dashboard `Bookings.jsx`.
- **Key fns:** `createBooking`, `rescheduleBooking`/`confirmReschedule`, `cancelBooking`, `autoCompleteBookings`, `expireStalePendingBookings`, `processReminders`.
- **Invariants:**
  - Always **snapshot pricing** at creation. Double-booking guarded by availability + buffer.
  - Status writes should be **conditional** (`.eq('status', ...)`) so a cancel mid-batch isn't overwritten to `completed` (audit M5). Reschedule must check the old `scheduled_at` (audit H7, still open).
- **Tables/flags:** `bookings` (`payment_status`, `status`, `reminder_24h_sent`, `reminder_1h_sent`, `reschedule_status`, `coupon_id`), `availability`, `services`.

### Subscriptions / Plans
- **Entry:** `server/controllers/paymentController.js` (`createVendorSubscription`/`verifySubscription`), `server/services/planService.js`, `server/services/subscriptionReconciler.js`, `server/middleware/planMiddleware.js`; client `UpgradePlan.jsx`.
- **Key fns:** `attachPlan` (sets `req.vendorPlan`), `checkServiceLimit`, `activateFromSubscription` (charge webhook), `releaseOrphan`.
- **Invariants:**
  - **Limits always come from `subscription_plans.limits`** — never hardcode (`planMiddleware.js` reads `planData.limits?.services`).
  - Plans = **Starter** (free) / **Pro** (paid); `subscription_plans.name` is UNIQUE. (`premium_founding` is an archived copy of Pro for founding checkouts.)
  - On a plan **switch**, grant **only the proration credit** up front (status `pending`); the paid period is granted by the charge webhook (`activateFromSubscription`), which never shrinks the credit — don't grant a full period before payment (audit C4).
- **Tables/flags:** `subscription_plans`, `profiles` (`plan`, `plan_expires_at`, `subscription_status`, `current_period_end`), `plan_gifts`.

### Reminders & scheduled jobs
- **Entry:** `server/server.js` (cron wiring), `server/controllers/bookingController.js` (`processReminders`), `server/services/*Nudges.js`, `server/services/campaignWorker.js`, `server/services/**/*Reconciler.js`, `server/utils/notificationDedupe.js`.
- **Key fns:** `scheduleCron(fn, ms)` (guarded by `CRONS_ENABLED`), `runLocked('reminders', …)`, `processDue` (campaigns), `alreadyNotified(...)`.
- **Invariants:**
  - Dedupe is **fail-closed**: `alreadyNotified` queries real columns (`event_key`, `destination`, `payload->>dedupe_key`) and treats a query error as "already sent" — a broken check must never cause a re-send storm (audit C5). The 7 nudge flags were flipped **OFF** on prod; re-enable only with the dedupe fix live.
  - Long-interval (24h) jobs still on raw `setInterval` never fire on a host that restarts daily (audit M13) — fix only after C5.
- **Tables/flags:** `notification_logs`, `in_app_notifications`; the nudge feature flags (activation/dormancy/festival/human/empathy/review/community-onboard).

### Calendar
- **Entry:** `server/config/google.js` (`createCalendarEvent`, `hasCalendarScopes`), used in `bookingController.createBooking` + `paymentController.verifyPayment`; client `pages/onboarding/CalendarStep.jsx`.
- **Invariants:** OAuth tokens live in **`profile_private`** (since v3.24), not `profiles`; `profiles` keeps `google_calendar_connected`/`calendar_skipped`/`google_id`. `google_calendar_connected` is set only when calendar scopes are granted.
- **Tables/flags:** `profile_private`, `profiles`.

### Admin
- **Entry:** `server/controllers/adminController.js`, `adminAuthController.js`, `server/middleware/adminMiddleware.js`, `server/lib/adminPermissions.js`; client `pages/admin/*` (login `/backstage`).
- **Invariants:**
  - Admin auth is a **separate door + separate JWT** from host/guest auth — never phone OTP. Permissions are embedded in the admin JWT **at sign-in**, so a permission grant (migration) takes effect on the admin's **next login**, not immediately.
  - Roles: `super` (wildcard), `operations`, `support` — permissions in `lib/adminPermissions.js` are the source of truth; migrations must match it.
- **Tables/flags:** `admin_users`, permission columns; `operations`/`support`/`super` roles.

### Middleware & security (DB access boundary)
- **Entry:** `server/middleware/` (`authMiddleware`, `adminMiddleware`, `planMiddleware`, `security`, `validate`, `ipGuard`, `requireFeature`, `communityGate`, `rateLimitStore`); `server/lib/clientIp.js`.
- **Invariants:**
  - **Every product write goes through the Express API with the service_role key** — the browser uses supabase-js for **auth + realtime only**, never a PostgREST table write. `anon`/`authenticated` have **no INSERT/UPDATE/DELETE grant** on public tables (v3.206) and only column-scoped SELECT on `profiles` (v3.205). A new view must set `security_invoker = true`; a function the browser calls needs an explicit GRANT (v3.186). Guarded by `tests/unit/lockdownAnon*Migration.test.js`.
  - `security.js` regex → 24h IP ban is **over-broad** and cross-site triggerable (audit M9) — treat as a known hazard.
- **Tables/flags:** all public tables (grants); `feature_flags` (60s cache, **fail-open** on read error — audit M12).

---

# Feature Map — Meeticulous

## 1. Public Host Profile
**Purpose:** Guest-facing creator page showing bio, services, reviews, products.
- **Primary:** `client/src/pages/HostProfile.jsx`
- **API:** `GET /api/host/:username` → `hostController.getHostProfile`
- **Supporting:** `themeUtils.js`, `ServiceDetail.jsx`
- **DB Tables:** `profiles`, `services`, `reviews`
- **Related:** Service Booking, Service Detail

---

## 2. Service Booking Flow
**Purpose:** Full guest booking journey — date/time selection, details form, OTP, payment, confirmation.
- **Primary:** `client/src/pages/ServiceBooking.jsx`
- **Route:** `/:username/booking/:serviceSlug`
- **Steps:** `time` → `details` → `otp` (guests only) → `payment` (paid) → `confirmed`
- **API Calls:**
  - `GET /api/host/:username/:slug` — load service + host
  - `GET /api/bookings/slots?host_id=&date=` — booked slots
  - `POST /api/auth/send-otp` — send OTP
  - `POST /api/auth/verify-otp` — verify OTP
  - `POST /api/bookings` — create booking
  - `POST /api/payment/create-order` — Razorpay order
  - `POST /api/payment/verify` — verify payment
- **Server:** `bookingController.js`, `authController.js`, `paymentController.js`
- **DB Tables:** `bookings`, `services`, `profiles`, `availability`, `otp_codes`
- **Dependencies:** `pricingEngine.js`, `otpStore.js`, Razorpay SDK, Google Calendar
- **Related:** OTP Verification, Payments, Host Profile

---

## 3. OTP Verification
**Purpose:** Guest identity verification before creating a booking (unauthenticated users only).
- **Primary:** `server/utils/otpStore.js`, `server/controllers/authController.js` (sendOtp/verifyOtp)
- **DB Table:** `otp_codes` (email PK, otp, expires_at, type, phone)
- **Routes:** `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`
- **Client:** Inline in `ServiceBooking.jsx` (OTP step)
- **TTL:** 10 minutes. Single-use (deleted on verify). Upsert on re-request.
- **Note:** Logged-in users skip OTP entirely (`BUG-16` fix)
- **Related:** Service Booking Flow, Password Reset

---

## 4. Payments (Razorpay)
**Purpose:** Service booking payment + plan subscriptions + digital product purchases.
- **Primary:** `server/controllers/paymentController.js`
- **Routes:** `/api/payment/*`
- **Client:** `ServiceBooking.jsx` (handlePayment), `UpgradePlan.jsx`, `ProductPurchase.jsx`
- **Webhooks:** `POST /api/payment/webhook` (raw body middleware)
- **DB Tables:** `bookings` (payment_status, payment_id), `plan_purchases`, `product_purchases`
- **Dependencies:** Razorpay Node SDK, `pricingEngine.js`
- **Related:** Service Booking, Plan Management, Digital Products

---

## 5. Host Dashboard
**Purpose:** Host management UI — bookings, services, availability, earnings, profile.
- **Primary:** `DashboardLayout.jsx` wraps all `/dashboard/*` pages
- **Protected:** `ProtectedRoute.jsx` gates all dashboard routes
- **Pages:** `Dashboard.jsx`, `Bookings.jsx`, `Earnings.jsx`, `Availability.jsx`, `ProfileSetup.jsx`, `Payouts.jsx`, `Transactions.jsx`, `UpgradePlan.jsx`
- **Service sub-pages:** `ServicesList.jsx`, `AddService.jsx`, `EditService.jsx`, `ServiceForm.jsx`
- **API:** `/api/host/*`, `/api/bookings/host`, `/api/vendor/*`, `/api/services/*`
- **DB Tables:** `profiles`, `services`, `bookings`, `availability`, `payout_requests`
- **Related:** Service Management, Availability, Pricing

---

## 6. Service Management (v2)
**Purpose:** CRUD for host services with rich fields, slugs, toggle, duplicate.
- **Primary Server:** `serviceController.js` + `serviceRoutes.js` (`/api/services/*`)
- **Primary Client:** `ServicesList.jsx`, `AddService.jsx`, `EditService.jsx`, `ServiceForm.jsx`
- **DB Table:** `services` (slug unique per host, grace_period_minutes, thumbnail_url)
- **Middleware:** `attachPlan`, `checkServiceLimit`
- **Plan Limits:** Explorer=3 active services, Creator=15, Professional=unlimited
- **Related:** Host Dashboard, Service Booking, Public Profile

---

## 7. Availability Management
**Purpose:** Host sets weekly schedule (JSON), blocked dates, timezone, buffer minutes.
- **Primary Server:** `hostController.js` (setAvailability, getAvailability)
- **Primary Client:** `Availability.jsx`
- **Routes:** `GET/PUT /api/host/availability`
- **DB Table:** `availability` (weekly_schedule JSONB, blocked_dates JSONB, timezone, buffer_minutes)
- **Used by:** `ServiceBooking.jsx` (slot generation), `bookingController.js` (timezone, buffer)
- **Related:** Service Booking, Double-booking Prevention

---

## 8. Authentication
**Purpose:** Host + guest auth via Supabase Auth + custom profile layer.
- **Primary Server:** `authController.js`, `authMiddleware.js`
- **Primary Client:** `AuthContext.jsx`, `Login.jsx`, `VendorSignup.jsx`, `UserSignup.jsx`
- **API Routes:** `POST /api/auth/register/vendor`, `/register/user`, `/login`, `/me`, `/google`, `/forgot-password`, `/reset-password`
- **DB Tables:** `profiles` (extends `auth.users`), `otp_codes`
- **Session Storage:** `localStorage['user']` = `{ token, refresh_token, id, name, email, role, username, plan, ... }`
- **Auto-refresh:** 401 interceptor in `api.js` calls `supabase.auth.refreshSession()`
- **Host LinkedIn login** (flag `host_linkedin_login`, fails closed): `POST /api/auth/linkedin/host` (`linkedinHostAuth`), client `LinkedinAuthDone.jsx` (`/auth/linkedin/done`), `startLinkedinHostAuth` in `AuthContext.jsx`, button `components/ContinueWithLinkedIn.jsx` (HostLogin, BecomeAHost, onboarding/GoogleStart, HomeHero, InviteLanding)
- **Related:** OTP Verification, Admin Auth

---

## 9. Admin Panel
**Purpose:** Platform management — users, bookings, services, settings.
- **Primary Server:** `adminController.js`, `adminAuthController.js`
- **Primary Client:** `pages/admin/` (AdminOverview, AdminUsers, AdminBookings, AdminServices, AdminSettings)
- **Login:** `/backstage` → OTP-based admin auth → `bas_admin` localStorage key
- **Routes:** `/api/admin/*`, `/api/admin-auth/*`
- **Middleware:** `adminMiddleware.js` (separate JWT from host auth)
- **Related:** Platform Settings

---

## 10. Plan Management
**Purpose:** Subscription plans with feature gates and commission tiers.
- **Primary:** `planMiddleware.js`, `paymentController.js` (subscribePlan/verifySubscription)
- **Client:** `UpgradePlan.jsx`
- **Plans:** `explorer` (free), `creator` (₹999/yr), `professional` (₹3,650/yr)
- **DB Tables:** `profiles` (plan, plan_expires_at), `plan_purchases`
- **Commission:** Explorer (after 30-day grace) = 5% of amount above ₹200. Paid plans = 0%.
- **Related:** Pricing Engine, Payments

---

## 11. Digital Products
**Purpose:** Hosts sell downloadable digital products.
- **Primary:** `productController.js`, `productRoutes.js`
- **Client:** `Products.jsx`, `ProductPurchase.jsx`
- **Routes:** `/api/products/*`
- **DB Tables:** `products`, `product_purchases`
- **Plan Limit:** Explorer=0, Creator=5, Professional=unlimited
- **Related:** Payments, Plan Management

---

## 12. Reviews
**Purpose:** Guests leave reviews on completed bookings.
- **Primary:** `reviewController.js`, `reviewRoutes.js`
- **Routes:** `POST /api/reviews`, `GET /api/reviews/:username`, `GET /api/reviews/booking/:id`
- **DB Table:** `reviews`
- **Related:** Public Profile, Bookings

---

## 13. Booking Reminders
**Purpose:** Automated 24h and 1h reminder emails to guests and hosts.
- **Primary:** `bookingController.processReminders()` — called every 5 min from `server.js`
- **Flags:** `reminder_24h_sent`, `reminder_1h_sent` on booking row
- **Related:** Service Booking, Email

---

## 14. Reschedule Flow
**Purpose:** Host or guest reschedules a booking. Host reschedules require guest acknowledgement.
- **Primary:** `bookingController.rescheduleBooking`, `bookingController.confirmReschedule`
- **Routes:** `PUT /api/bookings/:id/reschedule`, `GET /api/bookings/:id/confirm-reschedule?token=`
- **DB Fields:** `reschedule_status`, `reschedule_ack_token`, `reschedule_acknowledged_at`
- **Related:** Bookings, Email

---

## 15. Google Calendar Integration
**Purpose:** Auto-create Google Meet events for confirmed online bookings.
- **Primary:** `config/google.js` → `createCalendarEvent()`
- **Used in:** `bookingController.createBooking`, `paymentController.verifyPayment`
- **Tokens:** live in `profile_private` (since v3.24), not `profiles`. `profiles` keeps `google_calendar_connected`, `calendar_skipped`, `google_id`.
- **OAuth route:** `GET /api/auth/google?return=…` (return allowlist: `/dashboard`, `/vendor-register/<slug>/calendar`), `GET /api/auth/google/callback`
- **Scope check:** `hasCalendarScopes` in `config/google.js`. The callback sets `google_calendar_connected` only when calendar scopes are granted; cancel/errors redirect with `?google=denied|error`.
- **Skip endpoint:** `POST /api/onboarding/skip-calendar` (sets `calendar_skipped`; exposed as `calendarSkipped` in onboarding status and `/auth/me`).
- **Onboarding step:** `client/src/pages/onboarding/CalendarStep.jsx` at `/vendor-register/:slug/calendar`; gated by `client/src/pages/onboarding/needsCalendar.js`.
- **Dashboard nudge:** `calendar` item in `client/src/lib/hostNudges.js`, rendered by `NextStepCard`.
- **Audit script (one-off):** `server/scripts/auditCalendarScopes.js` (dry run by default; `--apply` disconnects hosts with missing scopes or token errors).
- **Related:** Service Booking, Payments

---

## 16. Campaign Platform (Email + WhatsApp broadcasts) — shipped 2026-06-12
**Purpose:** Send targeted Email/WhatsApp campaigns to consented contact segments (distinct from triggered notifications).
- **Primary (client):** `client/src/pages/admin/AdminCampaigns.jsx` (route `/admin/campaigns`)
- **Services (server):** `contactsService.js` (audience sync), `segmentService.js` (consent-enforced resolve), `campaignService.js` (create/launch/stats), `campaignWorker.js` (throttled, 60s in `server.js`), `whatsappTemplateService.js` (variable mapping), `communicationEngine.enqueueCampaignEmail`
- **Controller/API:** `campaignAdminController.js` → `/api/admin/campaigns/*` (contacts, segments, campaigns, wa-templates); webhook `whatsappWebhookController.js` → public `POST /api/notifications/aisensy/webhook`
- **DB Tables:** `contacts`, `segments`, `email_campaigns`, `campaign_recipients`, `whatsapp_templates`, `email_logs.campaign_id` (migrations v2.6, v2.7)
- **Perms:** `campaigns.view` / `campaigns.manage`
- **Dependencies:** `communicationEngine` (email queue/Resend), `aisensyService` (WhatsApp), `notificationEngine.logResult`
- **Reference:** `docs/communication-campaigns-architecture.md`; **guides:** `docs/guides/email-campaigns.md`, `whatsapp-campaigns.md`, `aisensy-onboarding.md`, `segments-and-consent.md`
- **Related:** Email Communication Engine, Notification System

---

## 17. Service Categories — redesign (branch `feat/service-categories`)
**Purpose:** Profession-scoped categories for services; each service stores a validated `(category, primary_category)` pair, feeding both host UX and public SEO landing pages.
- **Primary (server):** `server/lib/serviceCategory.js` (`resolveAndValidateCategory` → `{ok,value,primary}`), `serviceCategoryController.js` (admin CRUD + cached public list), `servicesDirectoryController.js` (SEO landing payloads), `exploreController.js` (`listServices` — cached catalog `explore:v4:catalog`) + `server/lib/exploreSearch.js` (deterministic query parse: topic words + city + mode, synonyms, prefix match, exact→partial→relaxed fallbacks surfaced as `meta.match`)
- **Writers (both stamp the pair, with 42703 schema fallback):** `serviceController.js` (`/api/services`), `hostController.js` (`/api/host/services`, `PUT /api/host/categories` — profession change de-categorises services and returns `services_cleared`)
- **Routes:** `/api/service-categories/*` (public, cached `svccat:`), `/api/admin/service-categories/*` (admin, 4 mutations bust `svccat:`+`svcdir:`+sitemap cache), `/api/services-directory` + `/api/services-directory/:profession` (cached `svcdir:`), `/api/explore` (`category`/`service` params — `service` requires `category` else 400)
- **Client:** `ServiceCategoryPicker` (dashboard `ServiceForm` + onboarding `FirstServiceStep`), `CategoriesSection.jsx` (profile settings, shows `services_cleared` toast), `Explore.jsx` (live listing + service filter chip, stale-response guard), `ServicesDirectory.jsx` (`/services`) + `ProfessionServices.jsx` (`/services/:profession`) with `ServiceCategoryCard` + `professionIcons.js`
- **DB Tables:** `services` (`category`, `primary_category`), `service_categories` (`primary_category`, `slug`, `name`, `description`, `icon`)
- **Migration:** `v3.60_service_category_integrity.sql` — composite FK + CHECK + SEO columns. **PENDING both DBs**
- **Seed:** `server/config/serviceCategorySeed.js` + `server/scripts/seedServiceCategories.js` (gap-fills `description`; re-run after v3.60)
- **SEO:** `/sitemap-professions.xml` sitemap-index child (`sitemapController.js`)
- **Related:** Service Management, Host Dashboard, SEO + Sitemap

---

## 18. Blog (`/blog`) — DB-backed (v3.74), index redesign + paging 2026-07-16
**Purpose:** Public build-in-public blog. Content lives in the `blogs` table; presentation (category colours, generated card/hero art) lives in the client.
- **Primary (client):** `client/src/pages/Blog.jsx` (index `/blog`, paged), `client/src/pages/BlogPost.jsx` (`/blog/:slug`, split hero + dark reading body), `client/src/components/blog/BlogHeroThumbnail.jsx` (generated SVG art — used by BOTH the post hero and the index cards; takes its canvas as `w`/`h`)
- **Presentation source:** `client/src/data/blogPosts.js` — `CATEGORY_THEME` (`band` = hero/CTA, `accent` = body links, `chip*` = index chips; `chipFg` doubles as the card hover colour `--card-hov`), `themeFor`, `AUTHOR_URL`. The `BLOG_POSTS` array is legacy seed data; live content comes from the API.
- **Controller/API:** `server/controllers/blogController.js` → `GET /api/blogs` (returns **every** post in one payload — the index pages client-side off this), `GET /api/blogs/:slug`
- **Admin:** `client/src/pages/admin/AdminBlogs.jsx` (route `/admin/content/blogs`), perm `cms.manage`
- **DB Tables:** `blogs` (`body` = jsonb block array; migration v3.74)
- **Paging:** `PER_PAGE = 13` in `Blog.jsx` (1 featured + 12 grid). URL-driven via `?page=N`, clamped; canonical follows the page
- **Redirects:** `/blogs` + `/blogs/:slug` → `/blog*`. **Two layers, both needed:** `client/vercel.json` `redirects` (301 at the edge, for crawlers) and `BlogsRedirect` in `App.jsx` (local dev + in-app `<Link>` nav). `blogs` is in `client/src/config/reservedSegments.js`
- **Styling landmine:** `.blog-link` in `index.css` draws the body-link hover underline as a **background-image**, not an `::after` — prose links wrap, and an absolute `::after` only covers the first line box
- **Tests:** `client/src/pages/__tests__/Blog.test.jsx` (paging, clamp, pager, byline)
- **Related:** SEO + Sitemap, Admin Panel

---

## 19. Notification System (email + WhatsApp + in-app) — overhauled 2026-08-29 (v3.130–v3.132)
**Purpose:** One engine dispatches every lifecycle event to email, WhatsApp, and the in-app bell; admins toggle channels per event.
- **Engine (server):** `services/notificationEngine.js` — `send({event, data})` fans out to email (`services/email/communicationEngine.js`), WhatsApp (`services/aisensyService.js`), and in-app (`utils/inAppNotify.js`), each gated by `notification_events.{email,whatsapp,in_app}_enabled`. Never throws; 60s config cache; schema-fallback safe.
- **In-app writer/reader:** `utils/inAppNotify.js` (`inAppNotify` insert w/ `dedupe_key`; `resolveInApp` clears on fix) → `in_app_notifications` table. Feed API `routes/notificationRoutes.js` → `controllers/notificationController.js` (`GET /`, `POST /read-all`, `PATCH /:id/read`, `GET /channel`).
- **Real-time:** `utils/realtimeBroadcast.js` broadcasts to an HMAC topic (`utils/notifChannel.js`); client `hooks/useLiveNotifications.js` subscribes both bells (`components/common/DashboardLayout.jsx` NotifBell, `Navbar.jsx`).
- **Templates/config:** `config/emailTemplates.js` + `scripts/seedEmailTemplates.js` (seed BOTH DBs); WhatsApp campaigns keyed by `notification_events.campaign_name`. **AiSensy "Booking Confirmed" = 4 body params exactly** (confirmed) / 5 (reminder) — see `bookingController.js` `customerParams`/`vendorParams` and `services/bookingConfirmation.js`; guard `tests/unit/bookingConfirmedParams.test.js`.
- **Admin console:** `client/src/pages/admin/AdminNotifications.jsx` + `NotificationBell.jsx` (the bell dot = ops work-queue from `controllers/opsAdminController.js`, NOT unread).
- **DB Tables:** `in_app_notifications` (v3.39; `dedupe_key` v3.131; `resolved_at` v3.132), `notification_events` (`in_app_enabled` v3.130), `notification_logs`, `email_logs`.
- **Migrations:** `v3.130_notification_in_app_channel`, `v3.131_in_app_notifications_dedupe`, `v3.132_in_app_notifications_resolution` (all applied BOTH DBs 2026-08-29).
- **Related:** Booking Reminders, Payments, KYC, Subscriptions, Admin Panel

## 20. Community (`/community`) — Phase 1 built 2026-11-03 (v3.185)
- **Spec / plan:** `docs/superpowers/specs/2026-11-03-community-design.md`, `docs/superpowers/plans/2026-11-03-community-phase-1.md`. Mockups: `docs/design/community-mockups.html`.
- **Server:** `routes/communityRoutes.js` → `controllers/communityController.js`; admin `controllers/communityAdminController.js` (routes in `adminRoutes.js`, perms `community.view` / `community.moderate`); bots `controllers/prerenderCommunity.js`.
- **Services:** `services/community/` — `store.js` (all DB access), `adminStore.js`, `text.js` (limits, phone/email/link guard, slugs, mentions), `visibility.js` (the ONE who-can-see rule), `serialize.js` (the ONE author serializer — guests: first name only), `indexable.js`, `cursor.js`, `jsonLd.js`, `notify.js`.
- **Gate:** `middleware/communityGate.js` — flags `community` / `community_writes` / `community_tithi` / `community_ads` (all OFF + fail-closed); early access via `community_members.early_access` or badge official/staff; terms version `2026-11-v1`; per-account limiters.
- **Client:** `pages/community/*`, `components/community/*`, `services/communityApi.js`, `utils/communitySeo.js` (JSON-LD, parity-tested against `server/tests/fixtures/community-jsonld.json`); admin `pages/admin/community/*`; edge bot routing for `/community` in `client/middleware.js`.
- **DB:** 18 `community_*` tables (v3.185). Counters are trigger-owned — never write them from app code.
- **Launch checklist:** name Grievance Officer (`CommunityGuidelines.jsx` placeholders), daily moderation owner, seed 20–30 posts with early access, re-add the llms.txt community line, then flip `community` + `community_writes`.
