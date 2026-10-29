# Security Remediation — 2026-06-23

Remediation of the 25 findings (2 Critical, 6 High, 9 Medium, 8 Low) from the
full-codebase security audit. Branch: `fix/security-audit-remediation`.

## Root-cause fix (Critical)

**C1/C2/H2/H3 — direct PostgREST write bypass.** The `anon`/`authenticated`
Postgres roles held INSERT/UPDATE/DELETE grants on public tables; combined with
self-row RLS policies and the public anon key, any logged-in user could write
`profiles.plan`, `profiles.is_verified`, `bookings.payment_status`,
`payout_requests`, etc. straight through PostgREST, bypassing the Express API.

- **Fix:** `v3.27_revoke_public_write_grants.sql` — revoke write privileges from
  `anon`/`authenticated` (SELECT preserved). All app writes go through the
  Express server's `service_role` client, which bypasses RLS and is unaffected.
- **Status: APPLIED LIVE to prod (`PROD_PROJECT_REF`) + staging
  (`STAGING_PROJECT_REF`) and verified** — `has_column_privilege` for the
  columns above is now `false`; SELECT/read paths unchanged. Reversible via GRANT.

## Fixed in code (this branch)

| ID | Fix | Files |
|----|-----|-------|
| H1 | `createBooking` derives `host_id` from the service (body value ignored); rejects inactive services | `controllers/bookingController.js` |
| H4 | Paid/free product downloads serve 60s **signed URLs**; products bucket privatized (`v3.28`) | `controllers/productController.js`, `v3.28` |
| H5 | Enforce `must_set_password` (forced change before any session/2FA); add `POST /admin-auth/change-password`; client change-password step; closes first-login 2FA-enrollment race | `controllers/adminAuthController.js`, `routes/adminAuthRoutes.js`, `client/.../AdminLogin.jsx`, `services/api.js` |
| H6 | `freeDownload` now requires a verified OTP for `buyer_email` | `controllers/productController.js`, `client/.../ProductPurchase.jsx` |
| M1 | `deepSanitize`/`blockSuspiciousRequests` skip `Buffer` bodies — fixes the Razorpay **webhook HMAC** that was silently always-failing | `middleware/security.js` |
| M2 | Anonymous bookings no longer attributed to an existing account by email match | `controllers/bookingController.js` |
| M3 | Plan-limit middleware fails **closed** (503) on errors instead of allowing | `middleware/planMiddleware.js` |
| M4 | Product `file_url`/`thumbnail_url`/`product_url` validated (http/https only); validators wired into routes | `middleware/validate.js`, `routes/productRoutes.js`, client |
| M5 | `social_links` scheme-validated on render **and** save (client + server) | `client` HostProfile/ServiceDetail/ProfileSetup, `controllers/hostController.js` |
| M6 | Admin `updateUser` allow-lists `role ∈ {guest,host}`; audits name/email | `controllers/adminController.js` |
| M7 | TOTP replay prevention via `last_totp_step` (`v3.29`) | `services/admin2faService.js`, `controllers/adminAuthController.js`, `v3.29` |
| M8 | PostgREST `.or()` search interpolation sanitized (transactions + staff lookup) | `controllers/vendorController.js`, `controllers/staffAdminController.js` |
| L1 | OAuth-state + unsubscribe secrets are **purpose-separated** (never the raw admin/service key); unsubscribe keeps legacy-link backward-compat | `controllers/authController.js`, `services/email/unsubscribeToken.js` |
| L2 | `cryptoTokens` hard-fails in prod if `GOOGLE_TOKEN_KEY` is absent (no silent derive) | `utils/cryptoTokens.js` |
| L4 | Dropped broad list policies on `products`/`images` buckets (`v3.28`) | `v3.28` |
| L6 | WhatsApp webhook secret read from `x-webhook-secret` header (query = legacy) | `controllers/whatsappWebhookController.js` |
| L8 | Buffer guard + comment that the regex sanitizers are defense-in-depth only | `middleware/security.js` |

### Migrations
- `v3.27_revoke_public_write_grants.sql` — **applied live (prod+staging)**.
- `v3.29_admin_totp_last_step.sql` — **applied live (prod+staging)** (additive column).
- `v3.28_private_product_bucket.sql` — **applied to staging**; **run on PROD at deploy** (only with the signed-URL code live).
- `v3.30_relock_profile_secret_columns.sql` — committed for reproducibility (live DBs already locked; run before `v3.24`).

## Manual / ops actions required (cannot be done in code)

- **M9 — Enable "Leaked Password Protection"** (HaveIBeenPwned). This toggle is
  **Supabase Pro-only** ($25/mo) — the Free tier rejects it ("available on Pro
  Plans and up"). DECIDED 2026-06-23: founder upgrades to Pro, then enables it at
  Auth → Sign In/Providers → Email → Password security on **both** projects.
  (A free server-side HIBP k-anonymity check on the password-set endpoints was
  offered and declined in favour of the native Pro toggle.)
- **Deploy step for H4:** run `v3.28` on prod when this branch deploys.
- **L1 (recommended):** set dedicated `OAUTH_STATE_SECRET` and `UNSUBSCRIBE_SECRET`
  env vars in prod (the code now uses purpose-separated derived fallbacks, so this
  is hardening, not a blocker).

## Accepted / deferred (with reasoning)

- **L5 — `btree_gist` in the `public` schema.** Not moved: the `bookings_no_overlap`
  GiST exclusion constraint depends on its operator class, and relocating the
  extension on a live DB risks breaking that constraint. Low severity. Safe future
  remediation: recreate the constraint after `ALTER EXTENSION btree_gist SET SCHEMA extensions;`
  in a maintenance window.
- **L7 — JWT/refresh token in `localStorage`.** Architectural to this SPA
  (Supabase access/refresh + cross-origin API). Mitigated by eliminating the XSS
  sinks (M4/M5) rather than re-architecting to httpOnly cookies. Accepted.
- **Migration version dupes** (two each of `v3.2`/`v3.16`/`v3.17`): pre-existing,
  additive/idempotent. Recommend a `schema_migrations` ledger to disambiguate;
  not changed here to avoid touching already-applied history.

## Verification
- Server test suite: **passing** (exit 0) after all server-side changes.
- Client build/tests: see branch CI.
- Live DB grants re-verified post-revoke (write columns → `false`, reads intact).

## Follow-up — 2026-06-23 (branch `fix/security-followup`)
- **Unsubscribe secret hardening (L1):** `unsubscribeToken.verifyToken` now accepts
  ALL historical signing secrets (dedicated env, derived, raw base), so setting a
  dedicated `UNSUBSCRIBE_SECRET` later never invalidates already-sent links.
- **v3.24 prep (drop dormant `profiles` secret columns):** removed the last code
  that read/wrote `profiles.google_access_token`/`google_refresh_token`
  (getAvailableSlots, paymentController createOrder + verifyPayment selects, and
  the authController OAuth dual-write — tokens now live ONLY in `profile_private`).
  Verified `profile_private` is fully in sync (**prod 23/23, staging 3/3,
  missing_in_private=0**), so the drop loses nothing. `v3.24` is now safe to apply
  **at deploy of this branch** (run on prod + staging after the new code is live;
  the previously-deployed code still SELECTs the columns until then).
- **Task 3 secrets:** set dedicated `OAUTH_STATE_SECRET` + `UNSUBSCRIBE_SECRET` on
  Render (optional hardening; L1 already purpose-separated in code).
