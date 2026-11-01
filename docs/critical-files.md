# Critical Files — Meeticulous

High-risk files. Always understand the full impact before modifying.

---

## 🔴 TIER 1 — Touch with extreme caution

### `server/controllers/bookingController.js`
**Owns:** Booking creation, slot checking, cancel, complete, reschedule, reminders
**Risk:** Pricing snapshot logic, double-booking prevention, email triggers
**Before changing:**
- Understand the schema fallback pattern (SELECT and INSERT)
- Pricing snapshots (`vendor_amount`, `platform_fee_amount`, `commission_applied`) are immutable — never recalculate from current settings
- `processReminders()` runs on a 5-min cron — changes affect all future reminders
- Free services trigger emails immediately; paid services wait for `verifyPayment`
- `wallClockToUTC` in client must stay aligned with `hostTimezone` from availability

### `server/controllers/paymentController.js`
**Owns:** Razorpay order creation, payment verification, plan subscriptions, product purchases
**Risk:** HMAC signature verification for security; booking status updates; plan activation
**Before changing:**
- Razorpay webhook uses raw body (`express.raw`) — do not add `express.json` before it
- HMAC verification: `order_id|payment_id` signed with `RAZORPAY_KEY_SECRET`
- Successful payment triggers: booking status→confirmed, Google Calendar event, confirmation emails
- Plan activation updates `profiles.plan` and `profiles.plan_expires_at`

### `server/lib/pricingEngine.js`
**Owns:** All pricing calculations (platform fee, commission, vendor payout)
**Risk:** Direct financial impact on every booking
**Before changing:**
- All functions must remain pure (no DB, no side effects)
- Changes affect existing snapshots differently than new bookings — snapshots are immutable
- Commission grace period (30 days) and floor (₹200) are business rules — change only with PM approval
- Test with `server/tests/unit/pricingEngine.test.js` before deploying

### `server/config/supabase.js`
**Owns:** `supabaseAdmin` client (service role key — bypasses all RLS)
**Risk:** Entire database security model
**Before changing:**
- `supabaseAdmin` must NEVER be imported or used in client-side code
- Service role key must stay in `server/.env` only

### `server/middleware/authMiddleware.js`
**Owns:** JWT verification for all protected routes
**Risk:** Breaks authentication for all `protect`-gated endpoints
**Before changing:**
- Attaches `req.user` — all controllers that use `req.user.id` depend on this
- Must handle token expiry gracefully (returns 401 for client to refresh)

---

## 🟠 TIER 2 — Significant risk, verify before shipping

### `server/utils/otpStore.js`
**Owns:** OTP storage and verification for booking flow
**Risk:** OTP verification failure breaks guest booking flow entirely
**Before changing:**
- Uses `supabaseAdmin` for DB access (bypasses RLS on `otp_codes`)
- `email` is PRIMARY KEY — upsert replaces existing OTP atomically
- `verify()` deletes row on success (single-use) — do not change this
- `cleanup()` is called every 60 min from `server.js` cron

### `server/middleware/planMiddleware.js`
**Owns:** Plan limits enforcement for services, products, bookings
**Risk:** Incorrect limits could allow Explorer hosts to exceed caps or block paid hosts
**Before changing:**
- `PLAN_LIMITS` object is the source of truth — keep in sync with `app_settings` table
- `attachPlan` must run before any `checkXLimit` middleware
- `checkBookingReceiveLimit` is called inside `bookingController.createBooking` (not as route middleware)

### `client/src/services/api.js`
**Owns:** All client-side HTTP calls + 401 refresh interceptor
**Risk:** Breaking the interceptor breaks auth refresh for all users
**Before changing:**
- Admin routes (`/admin`, `/admin-auth`) use `bas_admin` localStorage key
- Standard routes use `user` localStorage key
- 401 interceptor: one retry with refreshed token, then redirect to `/login`
- Do not create secondary Axios instances — all calls go through `API`

### `client/src/context/AuthContext.jsx`
**Owns:** Global auth state (user object, login, logout)
**Risk:** Breaking `user` object shape breaks every component that reads auth state
**Before changing:**
- `user` object shape: `{ id, name, email, role, username, plan, token, refresh_token, ... }`
- `getMe()` refresh on load keeps plan/username up to date
- Supabase `onAuthStateChange` listener handles Google OAuth sign-out

### `client/src/pages/ServiceBooking.jsx`
**Owns:** Entire guest booking journey
**Risk:** Breaks core revenue-generating flow
**Before changing:**
- `wallClockToUTC()` converts host-timezone time to UTC — must align with server timezone handling
- `STEPS` array logic depends on `user` (skip OTP) and `isPaid` (add payment step)
- `bookDirectly()` for logged-in users; `handleVerifyAndBook()` for guests
- All booking step cards must use `bg-white border rounded-2xl p-5 sm:p-7` (no `max-w-lg`)

### `server/config/schema.sql`
**Owns:** Canonical DB schema definition
**Risk:** Incorrect schema causes table creation failures on fresh deployments
**Before changing:**
- This is the baseline — migrations build on top of it
- Does NOT include columns added by v1.1–v1.7 migrations
- For fresh setup: run schema.sql THEN v1.6_catchup.sql THEN v1.7

---

## 🟡 TIER 3 — Moderate risk, test after changes

### `server/server.js`
**Owns:** App bootstrap, middleware order, route mounting, cron jobs
**Risk:** Middleware order matters (raw body before json, security before routes)
**Key:** Webhook route `'/api/payment/webhook'` must use `express.raw` BEFORE `express.json()`

### `client/src/utils/themeUtils.js`
**Owns:** Host theme colors, WCAG contrast, plan border colors
**Risk:** Affects visual appearance across all public profiles and booking flows

### `client/src/App.jsx`
**Owns:** All client-side routes
**Risk:** Route order matters — specific literal paths (`/backstage`) must come before dynamic ones (`/:slug`)
**Key rule:** `/:profileSlug/booking/:serviceSlug` must be declared BEFORE `/:profileSlug/:serviceSlug`

### `server/migrations/v1.7_pricing_snapshot.sql`
**Owns:** `commission_applied` column on `bookings`
**Risk:** Running twice is safe (IF NOT EXISTS). NOT running it means commission snapshots aren't stored.
**Status:** ⚠️ PENDING — must be run in production Supabase

---

## Environment Variables (server/.env)

| Variable | Risk if wrong |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | All DB operations fail |
| `SUPABASE_URL` | All DB operations fail |
| `RAZORPAY_KEY_SECRET` | Payment signature verification fails → all payments fail |
| `RAZORPAY_KEY_ID` | Order creation fails |
| `SMTP_HOST/USER/PASS` | All emails fail (silent — doesn't break booking) |
| `CLIENT_URL` | CORS blocks all browser requests |
| `API_URL` | Reschedule acknowledgement links broken |

## Environment Variables (client/.env)

| Variable | Risk if wrong |
|---|---|
| `VITE_API_URL` | All API calls fail |
| `VITE_RAZORPAY_KEY_ID` | Payment checkout fails |
| `VITE_SUPABASE_URL` | Auth listener fails |
| `VITE_SUPABASE_ANON_KEY` | Auth listener fails |
