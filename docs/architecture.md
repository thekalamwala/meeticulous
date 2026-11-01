# Architecture — Meeticulous

## System Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                   │
│                                                           │
│  api.js (Axios + auto-refresh) ─────────────────────►    │
│  Supabase JS SDK (auth listener only)                    │
│  Razorpay JS SDK (checkout widget only)                  │
└──────────────────────────┬───────────────────────────────┘
                           │  Bearer JWT
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  Express API (port 5000)                   │
│                                                           │
│  Middleware: helmet → hpp → xss-clean → blockSuspicious  │
│             → slowDown → rateLimiter → maintenanceCheck  │
│                                                           │
│  /api/auth/*          authController                     │
│  /api/admin-auth/*    adminAuthController                 │
│  /api/onboarding/*    vendorOnboardingController          │
│  /api/host/*          hostController                     │
│  /api/bookings/*      bookingController                  │
│  /api/payment/*       paymentController                  │
│  /api/admin/*         adminController + sub-controllers  │
│  /api/reviews/*       reviewController                   │
│  /api/products/*      productController                  │
│  /api/services/*      serviceController                  │
│  /api/vendors/*       badgePublicController              │
│  /api/upload/*        uploadController                   │
│  /api/plans           planAdminController.publicPlans    │
│                                                           │
│  Cron (setInterval in server.js):                        │
│    5 min  → processReminders()                           │
│    60 min → cleanupOtps()                                │
│    60 min → emailQueue.processQueue()                    │
│    60 min → badgeEngine.evaluateAll()                    │
└──────────────────────────┬───────────────────────────────┘
                           │  supabaseAdmin (service role)
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL)                     │
│  auth.users  profiles  services  bookings  availability  │
│  otp_codes   plan_purchases  payout_requests  products   │
│  product_purchases  reviews  app_settings                │
│  notification_providers/events/logs                       │
│  badge_categories/badges/badge_rules/vendor_badges       │
│  vendor_metrics (view)  subscription_plans               │
│  email_settings/templates/logs  platform_settings        │
│  admin_roles  admin_users  admin_audit_logs              │
└──────────────────────────────────────────────────────────┘

External:
  Razorpay API    ← payment orders + verification
  Google Calendar ← Meet event creation
  Supabase Storage ← image uploads (bucket `images`)
  SMTP/Resend/SES ← transactional email
  AiSensy         ← WhatsApp notifications
```

---

## Authentication Flows

### Host / Guest Auth (Supabase JWT)

```
1. POST /api/auth/login  { email, password }
2. Server: supabaseAdmin.auth.signInWithPassword()
3. Returns: { token, refresh_token, user profile fields }
4. Client: stores in localStorage['user']
5. api.js interceptor attaches "Authorization: Bearer <token>"
6. protect middleware: supabaseAdmin.auth.getUser(token) → req.user
7. On 401: api.js calls supabase.auth.refreshSession() → retries
```

### Admin Auth (Separate JWT)

```
1. POST /api/admin-auth/login  { username, password }
2. adminAuthController: bcrypt.compare() against admin_users table
3. Mints JWT with { adminId, role, permissions[] }
4. Client: stores in localStorage['bas_admin']
5. api.js: /admin routes → uses bas_admin token
6. requireAdmin(permission): verifies JWT, checks permission
7. Lockout: 5 fails → 15-min lockout via admin_users.locked_until
```

### OTP Flow

```
1. POST /api/auth/send-otp  { email, type }
2. otpStore.set() → bcrypt-hash OTP → upsert to otp_codes
3. communicationEngine sends email immediately
4. POST /api/auth/verify-otp  { email, otp }
5. otpStore.verify() → DB lookup + bcrypt compare + expire check
6. On success: row deleted (single-use)
7. Limits: 3 verify attempts, 3 sends/hour, 15-min lockout
```

---

## Booking Creation Flow

```
Guest (unauthenticated):
  1. GET  /api/host/:username/:slug    — load service + host
  2. GET  /api/bookings/slots?...      — check booked slots
  3. POST /api/auth/send-otp           — send OTP
  4. POST /api/auth/verify-otp         — verify OTP
  5. POST /api/bookings                — create booking
     a. Double-booking check (slot + grace period)
     b. Plan limit check (host monthly quota)
     c. pricingEngine.computeBreakdown() → snapshot values
     d. Insert to bookings
     e. Free service → send emails, done
     f. Paid → return booking ID

  6. POST /api/payment/create-order   — Razorpay order
  7. Razorpay checkout widget (client-side)
  8. POST /api/payment/verify          — verify payment
     a. HMAC-SHA256 signature check
     b. Fetch actual Razorpay fee from API → finalise vendor_amount
     c. booking: status='confirmed', payment_status='paid'
     d. Create Google Calendar Meet event
     e. Send confirmation emails (host + guest)

Logged-in guest: steps 3 + 4 skipped (bookDirectly())
```

---

## Pricing Flow

```
Inputs:  service.price, platform fee (DB), GST rate (DB), plan commission %

computeBreakdown():
  platformFee   = settings.fee                      (₹10 flat)
  gst           = platformFee × gstRate             (₹1.80)
  commission    = price × commissionPct / 100       (5% for free)
  customerTotal = price + platformFee + gst
  vendorAmount  = price − commission − razorpayFee  (finalised post-capture)

Stored as immutable snapshot on bookings row — never recalculated.
```

---

## URL Structure

```
Public:
  /                                   Home
  /:username                          Host profile
  /:username/booking/:slug            Booking flow
  /:username/:slug                    Service detail (legacy)
  /:username/badges                   Badge showcase
  /:username/product/:id              Product purchase

Vendor onboarding (10 steps):
  /vendor-register → /vendor-register/:slug/verify → /password
  → /type → /category → /booking-type → /calendar
  → /profile → /first-service → /plans → /explore

Vendor dashboard (/dashboard/*):
  /  /bookings  /services  /service/add-new  /service/edit/:id
  /availability  /earnings  /payments/payouts  /payments/transactions
  /profile  /products  /upgrade

Admin (/admin/* + /backstage + /super-dashboard):
  /backstage          Admin login
  /super-dashboard      Operations center
  /admin/bookings       Bookings
  /admin/users          Users
  /admin/plans          Plans
  /admin/badges         Badge engine
  /admin/platform/communication  Email engine
  /admin/notifications  WhatsApp / notification config
  /admin/staff          Staff management
  /admin/system/audit   Audit log
  /admin/settings       Platform settings
  (+ finance, content, support, providers — mostly shells)
```

---

## Email Architecture

```
Business event fires
  ↓
notificationEngine.emit(event, { audience, data })
  ↓
communicationEngine.send({ event, audience, data, immediate? })
  ↓
  immediate=true (OTP, password reset): send synchronously
  immediate=false: insert into email_logs (status='queued')
  ↓
Every 60s: processQueue() picks rows with retry backoff 5m/30m/2h
  ↓
placeholderResolver: fills {{variables}} from data + globals
emailLayout: wraps in 600px HTML shell
  ↓
provider (SMTP / Resend / SES — from email_settings.provider)
  ↓
email_logs: status + provider_response updated
```

---

## Theme System

Each host has `profiles.theme_color` (hex). The booking flow derives all colors from it:

```js
const tc = isValidHex(host.theme_color) ? host.theme_color : DEFAULT_THEME_COLOR;
const textOnTheme = getContrastColor(tc);         // WCAG-compliant black/white
const borderColor = getPlanBorderColor(host.plan); // grey / orange / gold
```

Colors are never hardcoded in the booking or profile pages.

---

## Security Architecture

See [SECURITY.md](SECURITY.md) for full details.

- Helmet + HPP + XSS-clean + suspicious-request blocker on all routes
- Rate limits: auth=5/15min, OTP=3/5min, general API=100/15min
- `supabaseAdmin` (service role) is server-only, never in client
- Razorpay webhook verified via HMAC-SHA256 before any state change
- Admin auth is completely isolated from vendor auth (separate JWT, separate table)
- Maintenance middleware can 503 all public traffic while keeping admin reachable

---

## Related Documentation
- [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) — file-by-file breakdown
- [DATABASE.md](DATABASE.md) — table schemas
- [SECURITY.md](SECURITY.md) — security model
