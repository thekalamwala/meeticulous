# Security — Meeticulous

## Authentication Model

### Two Completely Isolated Auth Systems

**Vendor/Guest Auth (Supabase JWT):**
- Sessions stored in `localStorage['user']` as `{ token, refresh_token, ...profile }`
- Token verified server-side via `supabaseAdmin.auth.getUser(token)` in `protect` middleware
- Auto-refresh on 401: `api.js` calls `supabase.auth.refreshSession()` and retries

**Admin Auth (Custom JWT):**
- Sessions stored in `localStorage['bas_admin']`
- Credentials stored in `admin_users` table (bcrypt, **not** `auth.users`)
- JWT signed with `SUPER_ADMIN_JWT_SECRET` — completely separate from Supabase JWT
- `requireAdmin(permission)` middleware verifies JWT and checks permission array in payload
- **Fail-closed:** server throws on startup if `SUPER_ADMIN_JWT_SECRET` is unset in `NODE_ENV=production`

### Admin Lockout

After 5 consecutive failed login attempts, the admin account locks for 15 minutes. Tracked via `admin_users.locked_until`. Prevents brute-force attacks on admin credentials.

---

## HTTP Security Headers

Applied via [Helmet](https://helmetjs.github.io/) on all routes:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS in production)
- `Content-Security-Policy` (Helmet defaults)
- Referrer-Policy, Permissions-Policy

---

## Rate Limiting

Configured in `server/middleware/security.js`:

| Scope | Limit | Window |
|---|---|---|
| General API (`/api/*`) | 100 requests | 15 minutes |
| Auth routes (`/api/auth/*`) | 5 requests | 15 minutes |
| OTP routes | 3 requests | 5 minutes |
| Admin auth | 5 requests | 15 minutes |

Speed limiting (progressive delay) applied to all API routes via `express-slow-down`.

Suspicious request blocking: common attack patterns (path traversal, SQL injection probes, etc.) are blocked and logged.

---

## Input Validation & Sanitization

- **XSS-clean** (`xss-clean`) strips script tags and event handlers from all request bodies
- **HPP** (`hpp`) prevents HTTP Parameter Pollution attacks on query strings
- **express-validator** chains validate and sanitize specific fields in auth routes

---

## Supabase Service Role Key

The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Rules:

- **Server-only.** Never sent to the client, never in `VITE_*` variables, never logged.
- Only used via `supabaseAdmin` client in `server/config/supabase.js`.
- All client-side DB access uses the anon key and is subject to RLS.

### RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | Public | — | `auth.uid() = id` | — |
| services | `is_active = true` | `auth.uid() = host_id` | `auth.uid() = host_id` | `auth.uid() = host_id` |
| availability | Public | `auth.uid() = host_id` | `auth.uid() = host_id` | — |
| bookings | `uid = host_id OR guest_id` | Public | `uid = host_id OR guest_id` | — |
| otp_codes | deny_all | deny_all | deny_all | deny_all |
| admin_users | deny_all | deny_all | deny_all | deny_all |
| admin_audit_logs | deny_all | deny_all | deny_all | deny_all |

---

## Payment Security

**Razorpay webhook verification** in `paymentController.verifyPayment`:
```js
const expectedSignature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest('hex');
if (expectedSignature !== razorpay_signature) {
  return res.status(400).json({ message: 'Invalid payment signature' });
}
```

No booking status is updated without this verification passing first.

**Raw body preservation** for webhook endpoint:
```js
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
```
The raw body is required before `express.json()` for HMAC verification to work.

---

## OTP Security

- OTPs are **bcrypt-hashed** before storage (not plaintext)
- Single-use: deleted immediately on successful verification
- 10-minute TTL
- 3 verify attempts before lockout
- 3 sends per hour per email address (prevents SMS/email abuse)
- 15-minute lockout after limit breach
- `otp_codes` table has `deny_all` RLS — only accessible via server's service role

---

## CORS

```js
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
```

Only the exact origin set in `CLIENT_URL` is allowed. No wildcard. No multiple origins (add array support if needed for staging/production split).

---

## Admin RBAC

45 granular permissions organized into 6 roles:

| Role | Access |
|---|---|
| `superadmin` | All 45 permissions |
| `operations` | Users, bookings, services, providers, ops queue |
| `finance` | Transactions, earnings, refunds, payouts |
| `support` | Tickets, disputes, reviews, bookings (read) |
| `content` | Pages, blogs, FAQ, testimonials, newsletter |
| `technical` | Settings, audit, notifications, email config, badges |

Permission enforcement: every admin route uses `requireAdmin('permission_name')`. The permission is checked against the JWT payload (not a DB lookup per request). JWT is regenerated on login.

**Audit logging:** every destructive admin mutation (create/update/delete on users, bookings, services, staff) writes to `admin_audit_logs` via `auditService.audit()`.

---

## Secrets Management

| Secret | Where stored | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `server/.env` | Never commit. Never log. |
| `RAZORPAY_KEY_SECRET` | `server/.env` | Never commit. |
| `SUPER_ADMIN_JWT_SECRET` | `server/.env` | Server throws on startup if missing in production. |
| `SMTP_PASS` | `server/.env` | Use app password, not account password. |
| AiSensy API key | `notification_providers` DB table | Admin-entered, never hardcoded. |
| Email provider key | `email_settings` DB table | Admin-entered. |
| Admin passwords | `admin_users` table (bcrypt) | Never in plaintext anywhere. |

`.env` files are in `.gitignore`. Never commit secrets.

---

## Known Security Gaps

1. **No CSRF protection** — API is JWT-only (no cookies), so CSRF is generally not applicable, but worth noting for future cookie-based auth.
2. **`admin_users` passwords** — initial passwords delivered in chat, not force-changed on first login. Change them immediately after deployment.
3. **Download tokens** — product download tokens are UUIDs stored in `product_purchases`. Expiry is enforced, but tokens are not single-use (can be downloaded multiple times before expiry).
4. **Google tokens in DB** — `google_access_token` and `google_refresh_token` are stored in plaintext in `profiles`. Consider encrypting at rest.
5. **Log files** — Winston logs may contain PII (email addresses). Ensure log files are not publicly accessible.

---

## Security-Sensitive Files

Modifying these files carries high risk — review carefully:

| File | Risk |
|---|---|
| `middleware/authMiddleware.js` | Breaks all host/guest auth if changed incorrectly |
| `middleware/adminMiddleware.js` | Bypasses all admin auth if misconfigured |
| `middleware/security.js` | Removing rate limits opens DoS vectors |
| `controllers/paymentController.js` | Signature bypass leads to fraudulent bookings |
| `utils/otpStore.js` | Weakening OTP = account takeover |
| `services/adminAuthService.js` | Misconfiguring fail-closed check leaves admin unprotected |
| `config/supabase.js` | Service role key exposure = full DB access |

---

## Related Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) — auth flow diagrams
- [API_REFERENCE.md](API_REFERENCE.md) — endpoint permission requirements
