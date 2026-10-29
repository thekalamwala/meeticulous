# AI Context — Book A Sloth

## What This Project Is
A multi-tenant appointment booking SaaS. Hosts (creators) sign up, create services, set availability, and receive bookings. Guests browse public profiles, book via OTP verification or logged-in session, and pay via Razorpay.

## Active Rules (follow every session)

### Schema Fallback Pattern
The codebase uses supabaseAdmin for all server queries. Because Supabase caches its schema and migrations may lag, every SELECT that touches newer columns must include a fallback:
```js
let result = await supabaseAdmin.from('bookings').select('*, commission_applied');
if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
  result = await supabaseAdmin.from('bookings').select('id, status, ...'); // core fields only
}
```
INSERT fallbacks use destructuring:
```js
const { newColumn: _dropped, ...safePayload } = fullPayload;
result = await supabaseAdmin.from('table').insert(safePayload);
```

### Auth Pattern
- Server uses Supabase JWT verification via `protect` middleware (`authMiddleware.js`)
- Admin uses separate JWT verified by `adminMiddleware.js` — stored under `bas_admin` in localStorage
- Frontend stores session as `user` key in localStorage; admin session as `bas_admin`
- `api.js` has auto-refresh via `supabase.auth.refreshSession()` on 401

### OTP Flow
- Booking OTP: `server/utils/otpStore.js` → writes to `otp_codes` Supabase table (DB-backed, survives restarts)
- Password reset OTP: `authController.js` → writes directly to `otp_codes` table
- `otp_codes.email` is PRIMARY KEY → upsert replaces prior OTP atomically
- TTL: 10 minutes. Single-use (deleted on verify).

### Pricing Engine
- All pricing in `server/lib/pricingEngine.js` — pure functions, no DB access
- Platform fee tiers: free=₹0, ₹1-199=₹2, ₹200-499=₹5, ₹500+=₹10
- Commission: paid plans=0%, free plan after 30-day grace = 5% of amount above ₹200
- Snapshots written to `bookings`: `vendor_amount`, `platform_fee_amount`, `commission_applied`
- Never recalculate pricing from current settings — always read snapshots from booking row

### Plan Enforcement
- DB slugs: `starter` (free), `creator`, `professional` — shown in the UI as the
  final brand names **Starter / Host+ / Studio** (slugs kept unchanged on purpose, #194).
- Pricing (source of truth = `subscription_plans`): Starter ₹0 · Host+ (`creator`)
  ₹229/mo, ₹1,499/yr · Studio (`professional`) ₹555/mo, ₹3,650/yr. `supreme` is a
  hidden god-tier (inactive).
- Limits/features come from `subscription_plans.limits` — NEVER hardcode. Enforced in
  `planMiddleware.js`, checked in `bookingController.js`.
- Starter: 3 services, 300 bookings/yr, 1 digital product, 5% commission over ₹200.
  Host+ / Studio: 0% commission; Studio is unlimited everything.
- Expired paid plan → falls back to `starter` silently.

### Theme System
- Each host has a `theme_color` hex (plan-gated palette)
- Use `getContrastColor(hex)` from `themeUtils.js` for text-on-color
- `getPlanBorderColor(plan)` for avatar border: grey=Starter, orange=Host+, gold=Studio
- Never hardcode colors in booking flow — always derive from `host.theme_color`

### URL Structure
- Public profiles: `/:username`
- Service detail: `/:username/:serviceSlug`
- Booking flow: `/:username/booking/:serviceSlug`
- Product purchase: `/:username/product/:productId`
- Dashboard: `/dashboard/*`
- Admin: `/admin/*` (login at `/hello-sloth`)

## Known Issues / Constraints
- WhatsApp is live via AiSensy — `notify.js` routes through `notificationEngine.js`, DB-configured per event/provider
- `commission_applied` column requires `v1.7_pricing_snapshot.sql` migration (fallback in place)
- Server reminder cron runs every 5 minutes, OTP cleanup every 60 minutes (set in `server.js`)
- `supabaseAdmin` (service role key) bypasses RLS — use only in server-side controllers
- Client uses `supabase` (anon key) for auth state change listener only

## File Opening Priority
For booking bugs: `bookingController.js` → `ServiceBooking.jsx` → `api.js`
For auth bugs: `authController.js` → `authMiddleware.js` → `AuthContext.jsx`
For UI bugs: relevant page in `client/src/pages/` → `design-system.md`
For payment bugs: `paymentController.js` → `ServiceBooking.jsx` (handlePayment)
For dashboard bugs: `client/src/pages/services/ServicesList.jsx` or `Dashboard.jsx`
