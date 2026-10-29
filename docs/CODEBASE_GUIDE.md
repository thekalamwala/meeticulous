# Codebase Guide — Meeticulous

This guide explains every module in the codebase. Use it as your map before opening any file.

---

## Server (`server/`)

### Entry Point

**`server.js`**
- Mounts all middleware and routes
- Starts 4 cron jobs (reminders, OTP cleanup, email queue, badge eval)
- Raw body parser applied before `express.json()` — required for Razorpay webhook

### Controllers

Each controller owns one domain. Never put business logic in routes.

| File | Domain | Key functions |
|---|---|---|
| `authController.js` | User auth, OTP, password reset, Google OAuth | `register`, `login`, `sendOtp`, `verifyOtp`, `forgotPassword`, `resetPassword` |
| `bookingController.js` | Create/list/cancel/complete/reschedule bookings, reminders | `createBooking`, `getHostBookings`, `cancelBooking`, `processReminders` |
| `paymentController.js` | Razorpay orders, webhook, plan purchase, product purchase | `createOrder`, `verifyPayment`, `subscribePlan`, `verifySubscription` |
| `serviceController.js` | CRUD services, slug validation, toggle, duplicate | `createService`, `updateService`, `toggleService`, `duplicateService` |
| `hostController.js` | Public profile, availability, vendor dashboard data | `getHostProfile`, `setAvailability`, `getEarnings` |
| `vendorController.js` | Vendor-specific profile updates | `updateVendorProfile` |
| `vendorOnboardingController.js` | 10-step onboarding state machine | `startOnboarding`, `verifyOnboardingOtp`, `setOnboardingPassword`, etc. |
| `productController.js` | Digital product CRUD, download token generation | `createProduct`, `purchaseProduct`, `downloadProduct` |
| `reviewController.js` | Review submission and display | `createReview`, `getReviews` |
| `uploadController.js` | Cloudinary image upload (multer → Cloudinary) | `uploadImage` |
| `adminController.js` | Platform admin: users, bookings, services, stats | `getStats`, `getUsers`, `updateUser`, `deleteUser` |
| `adminAuthController.js` | Admin login/logout/me, lockout enforcement | `login`, `verify`, `me`, `logout` |
| `planAdminController.js` | Plan CRUD, clone, archive, reorder, assign | `getPlans`, `createPlan`, `updatePlan`, `assignPlan`, `publicPlans` |
| `badgeAdminController.js` | Badge CRUD, rule builder, vendor assign/revoke | `createBadge`, `evaluateBadge`, `assignBadgeToVendor` |
| `badgePublicController.js` | Public badge display (no auth) | `getVendorBadges` |
| `notificationAdminController.js` | Provider config, event toggles, test send, logs | `getProviders`, `updateProvider`, `testSend` |
| `emailAdminController.js` | Template CRUD, preview, test send, logs, settings | `getTemplates`, `updateTemplate`, `previewTemplate`, `testSend` |
| `staffAdminController.js` | Admin staff CRUD, role assign, invite, deactivate | `createStaff`, `updateStaff`, `deactivateStaff` |
| `auditAdminController.js` | Audit log viewer | `getAuditLogs` |
| `opsAdminController.js` | Operations attention queue | `getSummary` |

### Middleware

| File | What it does |
|---|---|
| `authMiddleware.js` (`protect`) | Verifies Supabase JWT; attaches `req.user` |
| `adminMiddleware.js` (`requireAdmin`, `requireSuperAdmin`) | Verifies admin JWT; checks permission |
| `planMiddleware.js` (`attachPlan`, `checkServiceLimit`, `checkBookingReceiveLimit`) | Attaches host plan; enforces limits |
| `security.js` | Helmet, rate limiter, speed limiter, HPP, XSS-clean, block suspicious |
| `maintenanceMiddleware.js` | Returns 503 when `platform_settings.maintenance_mode=true` (30s cache; admin exempt) |
| `validate.js` | express-validator chains for input validation |
| `errorMiddleware.js` | Global error handler — formats JSON error response |

### Routes

One file per domain, mounted in `server.js`. Pattern:
```js
router.get('/path',  protect, optionalMiddleware, handler);
router.post('/path', protect, requireAdmin('permission'), handler);
```

Admin routes use `requireAdmin(permission)` from `lib/adminPermissions.js`.

### Lib

**`pricingEngine.js`** — pure functions, no DB, no side effects.
- `computeBreakdown(price, commissionPct, platformFee, gstRate)` → full pricing object
- `calculatePlatformFee(amount)` → legacy tiered fee (kept for compatibility)
- `calculateCommission(amount, plan, vendorAgeDays)` → legacy per-plan fee

**`adminPermissions.js`** — canonical catalog of 45 permissions + 6 roles.
Kept in sync with the `admin_roles` DB seed.

### Services

**`badgeEngine.js`**
- Reads badge rules from DB; evaluates against `vendor_metrics` view
- Awards badges to eligible vendors, auto-revokes if no longer eligible
- Groups ANDed internally; combined with `badge.rule_logic` (AND/OR)

**`notificationEngine.js`**
- Central event dispatcher
- Reads channel toggles + AiSensy campaign names from DB (60s cache)
- Sends WhatsApp (AiSensy) + email, logs to `notification_logs`

**`planService.js`**
- Cached DB reads for subscription plans
- Legacy alias: `explorer` → `starter`
- Fallback defaults pre-migration

**`platformConfig.js`**
- Reads `platform_fee` + `gst_rate` from `platform_settings` (60s cache)
- `clearCache()` called after admin saves settings

**`auditService.js`**
- `audit(adminId, action, target)` → inserts to `admin_audit_logs`
- Called on every destructive mutation by admin staff

**`adminAuthService.js`**
- `login(username, password)` → bcrypt verify + lockout logic
- `mintJwt(payload)` → creates admin JWT
- Throws if `SUPER_ADMIN_JWT_SECRET` is unset in production (fail-closed)

**`aisensyService.js`**
- AiSensy campaign API client
- Credentials read from `notification_providers` DB row (never hardcoded)

**`email/`** — Email engine (see [ARCHITECTURE.md](ARCHITECTURE.md) email section)
- `communicationEngine.js` — render → queue/send → log
- `placeholderResolver.js` — fills `{{snake_case}}` variables
- `emailLayout.js` — 600px HTML shell (single shared template wrapper)
- `providers/smtpProvider.js`, `resendProvider.js`, `sesProvider.js`

### Utils

| File | Purpose |
|---|---|
| `otpStore.js` | DB-backed OTP: set (bcrypt), verify (compare + delete), cleanup, rate limit |
| `sendEmail.js` | Low-level Nodemailer wrapper used by legacy paths + admin infra |
| `notify.js` | High-level notification: `sendAppointmentEmail`, `sendAppointmentWhatsApp` (stub) |
| `logger.js` | Winston logger — file + console; `auditLog()` + `securityLog()` helpers |

### Config

| File | Purpose |
|---|---|
| `config/supabase.js` | Creates `supabaseAdmin` (service role) client |
| `config/google.js` | Google OAuth2 client + `createCalendarEvent()` |
| `config/emailTemplates.js` | 29 template definitions used by seed script |
| `config/schema.sql` | Base table DDL |
| `config/migration_v*.sql` | Older migrations (now superseded by `migrations/`) |

### Migrations

Run in order for a fresh setup:

| File | What it adds |
|---|---|
| `config/schema.sql` | Base tables: profiles, services, availability, bookings |
| `migrations/v1.1.sql` | otp_codes table |
| `migrations/v1.2.sql` | profiles.plan, plan_purchases |
| `migrations/v1.3.sql` | services: grace_period, slug, thumbnail_url; otp_codes.type |
| `migrations/v1.4.sql` | payout_requests |
| `migrations/v1.5.sql` | increment_product_purchase_count function |
| `migrations/v1.6_catchup.sql` | All profile columns through v1.6 |
| `migrations/v1.7_pricing_snapshot.sql` | bookings.commission_applied ⚠️ |
| `migrations/v1.8_vendor_onboarding.sql` | Onboarding state tables |
| `migrations/v1.9_notification_system.sql` | Notification tables + hardened otp_codes |
| `migrations/v2.0_badge_system.sql` | Badge tables + vendor_metrics view |
| `migrations/v2.1_subscription_plans.sql` | subscription_plans table, plan seeding |
| `migrations/v2.2_payout_model.sql` | Full money model columns on bookings |
| `migrations/v2.3_email_communication_engine.sql` | Email tables + 29 templates seeded |
| `migrations/v2.4_admin_rbac.sql` | admin_roles, admin_users, admin_audit_logs |

---

## Client (`client/src/`)

### Entry Point

**`main.jsx`** — renders `<App />` inside `BrowserRouter` + `AuthProvider`.

**`App.jsx`** — all route definitions, lazy-loaded page components, `DashboardWrapper` + `AdminWrapper` guards.

### Pages

**Public:**
- `Home.jsx` — landing page
- `Login.jsx` / `VendorSignup.jsx` / `UserSignup.jsx` — auth pages
- `ForgotPassword.jsx` / `ResetPassword.jsx` — password reset
- `HostProfile.jsx` — public creator profile (`/:username`)
- `ServiceDetail.jsx` — service detail page (legacy `/:username/:slug`)
- `ServiceBooking.jsx` — full booking flow (time → details → OTP → payment → confirmed)
- `ProductPurchase.jsx` — digital product purchase
- `BadgeShowcase.jsx` — public badge display

**Vendor Dashboard** (`/dashboard/*`):
- `Dashboard.jsx` — overview with booking stats
- `Bookings.jsx` — booking list with filter/cancel/reschedule
- `Earnings.jsx` — earnings overview
- `Availability.jsx` — weekly schedule editor + blocked dates
- `ProfileSetup.jsx` — profile, theme, social links
- `Products.jsx` — digital product CRUD
- `UpgradePlan.jsx` — plan comparison + Razorpay checkout
- `Payouts.jsx` — payout request form + history
- `Transactions.jsx` — transaction history

**Services** (`/dashboard/service/...`):
- `ServicesList.jsx` — list with search, filter, toggle, duplicate, delete
- `AddService.jsx` / `EditService.jsx` — wrappers
- `ServiceForm.jsx` — shared form with all v2 fields

**Vendor Onboarding** (`/vendor-register/...`):
Ten sequential steps: `SlugClaim → OtpVerify → PasswordStep → VendorTypeStep → CategoryStep → BookingTypeStep → CalendarStep → ProfileStep → FirstServiceStep → PlansStep → ExploreWithBolt`

**Admin Pages** (`/admin/...` and `/super-dashboard`):
- `SuperDashboard.jsx` — operations center with real attention queue
- `AdminUsers.jsx` / `AdminBookings.jsx` / `AdminServices.jsx` — core ops
- `AdminPlans.jsx` — full plan management UI
- `AdminBadges.jsx` — badge + rule builder
- `AdminCommunication.jsx` — email templates, editor, logs, settings
- `AdminNotifications.jsx` — WhatsApp provider + event config
- `AdminStaff.jsx` / `AdminAudit.jsx` — RBAC management
- `AdminSettings.jsx` — platform-wide settings
- `AdminProviders.jsx` / `AdminKYC.jsx` / `AdminTransactions.jsx` / `AdminEarnings.jsx` / `AdminRefunds.jsx` — partially implemented
- Content + support pages (`AdminPages`, `AdminBlogs`, etc.) — UI shells, no backend yet

### Components

**`components/common/`:**
- `DashboardLayout.jsx` — sidebar + header for vendor dashboard
- `AdminLayout.jsx` — sidebar + header for admin panel; checks `bas_admin` session
- `ProtectedRoute.jsx` — redirects to `/login` if no vendor session
- `Navbar.jsx` — public-facing top nav
- `BackButton.jsx` — reusable back navigation
- `ImageCropper.jsx` — crop + upload to Cloudinary

**`components/admin/AdminEmptyState.jsx`** — shared empty state for admin list pages

### Context

**`context/AuthContext.jsx`**
- Provides `{ user, login, logout, updateUser }` to the entire app
- `user` shape: `{ id, name, email, role, username, plan, token, refresh_token, ... }`
- On mount: restores session from `localStorage['user']`
- Supabase JS SDK used only for `onAuthStateChange` listener

### Services

**`services/api.js`**
- Single Axios instance with `VITE_API_URL` base URL
- Request interceptor: attaches Bearer token (vendor or admin based on route)
- Response interceptor: on 401 → refresh token → retry
- Exports one function per API call (e.g., `createBooking`, `getHostBookings`)

**`services/supabaseClient.js`**
- Creates Supabase anon client for auth state listening only
- Never used for DB queries from the client

### Utils

**`utils/themeUtils.js`**
- `getContrastColor(hex)` — returns `#000` or `#fff` for WCAG contrast
- `getPlanBorderColor(plan)` — `grey` / `orange` / `gold` by plan tier
- `isValidHex(color)` — validates hex color string
- `DEFAULT_THEME_COLOR` — fallback `#FE5100`

### Styles

**`styles/design-tokens.css`** — CSS custom properties for the design system
**`styles/base-fb.css`** — base utility overrides
**`styles/components/`** — `badge.css`, `button.css`, `card.css`, `input.css`, `modal.css`
**`src/index.css`** — Tailwind directives + global styles

---

## Coding Rules (Summary)

See [CONTRIBUTING.md](CONTRIBUTING.md) for full rules. Key rules:

1. **Schema fallbacks** — any query touching a post-v1.6 column must have a catch-and-retry fallback
2. **Pricing snapshots are immutable** — read from booking row, never recalculate
3. **pricingEngine.js is pure** — no DB access, no side effects
4. **supabaseAdmin is server-only** — never send service role key to client
5. **All API calls via api.js** — never use `fetch()` or raw Axios
6. **Email failures are non-fatal** — always wrap in try/catch, never re-throw
7. **OTP is DB-backed** — `otpStore.js` only, never in-memory Maps

### Anti-Patterns (Never Do)

- ❌ `fetch()` for API calls — use `api.js` exports
- ❌ Hardcode `₹10` platform fee — use `calculatePlatformFee(value)` or `platformConfig`
- ❌ Recalculate commission from current plan — read `booking.commission_applied`
- ❌ In-memory OTP storage — `otpStore.js` is DB-backed
- ❌ Skip schema fallback on migration columns
- ❌ `/profile/service/:slug` — correct URL is `/:username/booking/:slug`
- ❌ `max-w-lg mx-auto` on booking step cards — use `max-w-md mx-auto` for inner content

---

## Finding Anything

| I need to... | Go to |
|---|---|
| Fix a booking bug | `bookingController.js` → `ServiceBooking.jsx` |
| Fix an auth bug | `authController.js` → `authMiddleware.js` → `AuthContext.jsx` |
| Fix a payment bug | `paymentController.js` → `ServiceBooking.jsx` (handlePayment) |
| Fix a UI bug | `client/src/pages/<Page>.jsx` + `docs/design-system.md` |
| Add a new admin section | `controllers/adminController.js` + `routes/adminRoutes.js` + `pages/admin/` |
| Change platform fee | `platform_settings` table (admin UI) → `platformConfig.js` |
| Add a notification event | `notification_events` DB table + `notificationEngine.js` |
| Add an email template | `emailTemplates.js` + `seedEmailTemplates.js` + run seed |
| Add a badge rule | Admin UI → `AdminBadges.jsx` → badge rule builder |
| Debug slow queries | `server/coverage/lcov-report/` or Supabase dashboard |

---

## Related Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) — system-level flows
- [DATABASE.md](DATABASE.md) — table schemas
- [CONTRIBUTING.md](CONTRIBUTING.md) — full coding rules and conventions
