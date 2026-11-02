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
- **Profile fields:** `google_calendar_connected`, `google_access_token`, `google_refresh_token`
- **OAuth route:** `GET /api/auth/google`, `GET /api/auth/google/callback`
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
