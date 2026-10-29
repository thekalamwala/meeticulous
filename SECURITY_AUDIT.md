# Security Audit — Book A Sloth

_Date: 2026-07-01 • Branch: `fix/security-patches` • Method: red-team code review (4 parallel attack-surface agents) + live prod-DB verification via Supabase MCP._

## Executive Summary

Book A Sloth has been through **multiple prior security audits** (06-17, 06-22, 06-23, 06-27) and is a **genuinely hardened codebase**. This pass re-attacked the full surface — auth/session, payments/webhooks, authorization/IDOR, and input/upload/infra — and **found no new Critical or High severity exploitable vulnerabilities.**

The two prior headline CRITICALs were re-verified as **fixed and enforced live on the production DB**:

| Prior CRITICAL | Status | Verification |
|---|---|---|
| `platform_settings` anon-readable → Razorpay webhook secret exposed (06-23) | **FIXED** | `set role anon; select` on prod returns only 12 allowlisted keys; `razorpay_webhook_secret` + `subscription_reconciler_status` filtered out by the `v3.46` allowlist RLS policy. |
| Anon key dumps `profiles` (Google tokens, OTP, PII) (06-22) | **FIXED** | `anon` has **zero** SELECT grant on `public.profiles` (revoked v3.27). Query returns `permission denied for table profiles`. |

**Security posture: strong.** Signature verification, amount-binding, replay idempotency, ownership scoping, injection sanitization, upload magic-byte validation, CORS allowlisting, CSP/HSTS, and secret handling are all correctly implemented. This audit fixed **3 real defense-in-depth items** (1 meaningful, 2 low) and documents the residual risks.

**Attack surface reviewed:** 39 controllers, 24 route files, 10 middleware, auth/OTP/JWT/2FA, Razorpay order+subscription+webhook flows, product downloads, file uploads, Supabase RLS on prod.

---

## Fixes Implemented (this branch)

### FIX-1 — Feature flags fail OPEN on a security boundary → made fail CLOSED  _(defense-in-depth, meaningful)_

**Affected:** `server/services/featureFlags.js`
**Consumed at:** `server/controllers/authController.js:643,837,888`

**Root cause.** `isFeatureEnabled(key)` returned `true` for any key not present in the `feature_flags` map, and the map defaults to `{}` on a Supabase read error. Every host/guest login-boundary guard is written `if (!unifiedLogin && isHostAccount) reject`. So if the `unified_login` row were **missing** (migration skipped) or the **DB read threw**, `unifiedLogin` silently became `true` and the host-rejection guard was **skipped entirely** — a boundary control that fails open is not a control.

**Attack scenario.** During any transient `feature_flags` read failure (Supabase blip, cache populated with `{}`), the guest phone-OTP door (`sendOtp` / `verifyOtpLogin`) stops rejecting host/superadmin numbers, contradicting the "hosts log in only via Google" product rule. (Not account-takeover — the OTP still delivers only to the phone owner — but the boundary should never self-disable.)

**Fix.** Introduced `FAIL_CLOSED_KEYS = new Set(['unified_login'])`. Security-boundary keys default to `false` (safe/more-restrictive) when absent or on DB error; all other flags keep the fail-open default so a missing migration never bricks a normal feature. **No change to current prod behavior** — the flag row is present, so its explicit value is still honored; only the degraded/misconfigured path is now safe.

**Verification.** 3 new regression tests in `server/tests/unit/featureFlags.test.js` assert `unified_login` → `false` when absent, `false` on DB error, and honors its explicit stored value. Full suite green.

### FIX-2 — Product-file uploads did not pin content-type / disposition  _(Low)_

**Affected:** `server/controllers/uploadController.js:160`

**Root cause.** `.upload(key, buffer, { upsert: true })` omitted `contentType`, so Supabase Storage fell back to the client-supplied multipart mimetype. The image path already pins `contentType: sniffed.mime`; the product path did not.

**Residual risk (why Low).** Content is magic-byte sniffed (`sniffProductFile`) against an allowlist that **excludes HTML/SVG**, and the extension must match the byte family, so an active/inline polyglot is already rejected. The gap was only a theoretical inline-render of an allowlisted type.

**Fix.** Pin `contentType: sniffed.mime || 'application/octet-stream'` and `contentDisposition: 'attachment'` so product objects always download rather than render inline — guaranteed even for any future allowlisted type.

### FIX-3 — Signed product-download route had no rate limiter  _(Low)_

**Affected:** `server/routes/productRoutes.js:16`, new `downloadTokenLimiter` in `server/middleware/security.js`

**Root cause.** `GET /api/products/download/:token` was unauthenticated (by design — capability URL) with **no throttle**. The token is `crypto.randomUUID()` (~122 bits, not brute-forceable) and capped at 3 downloads / 24h, so blast radius was already small — but a leaked token (forwarded email, proxy log, referrer) or a token-guessing flood hit the storage-URL minting endpoint uncapped.

**Fix.** Added a persistent-store-backed IP limiter (30/hr) to the route, consistent with the existing `freeDownloadIpLimiter` pattern.

---

## Verified Safe (attacked, no fix needed)

**Payments / subscriptions / webhooks** — Razorpay order signature verified server-side (HMAC-SHA256 + length-guarded `timingSafeEqual`); charged amount re-fetched from Razorpay and bound to the immutable server-computed snapshot (`customer_total`), never from the request body; order↔booking binding blocks cross-booking replay; webhook HMAC verified over the **raw body buffer**; all capture paths idempotent (unique `razorpay_order_id`, `subscription_payments` / `reschedule_payments` dedupe); plan-swap blocked (`notes.plan` asserted). `LOAD_TEST_MODE` **fails closed** — honored only when `NODE_ENV` is `development`/`test`, ignored in production/staging/unset (`config/loadTestMode.js`). **No payment-forgery or price-tampering vector found.**

**Authorization / IDOR** — Ownership enforced consistently in code (`.eq('host_id', req.user.id)` / explicit `req.user.id` checks) on every by-id read/update/delete for bookings, services, products, reviews, notifications, feedback, payouts — correct pattern given `supabaseAdmin` bypasses RLS. Anonymous bookings require an OTP `guestGrant` bound to the verified contact (prior H-1 fix). Mass-assignment blocked by explicit field whitelists (`plan`/`role`/`is_host`/`is_verified`/`commission`/`balance` not self-writable). Admin routes gated by `requireAdmin(<perm>)` with a separate JWT secret. **No Critical/High IDOR, missing-auth, or privilege-escalation found.**

**Auth / session / admin** — Admin JWT fails closed if `SUPER_ADMIN_JWT_SECRET` absent in prod; `jwtVerify` pins `alg:HS256`/`typ:JWT` (blocks alg-confusion); admin 2FA has no bypass (typed pending tokens, monotonic TOTP step, bcrypt single-use recovery codes); login enumeration neutralized (timing-equalized dummy `signInWithPassword`, identical 401s, generic reset response); OTP bcrypt-hashed, 3-attempt lockout, per-purpose `(email,type)` rows; OAuth `state` CSRF-checked; no `supabaseAdmin` sign-in poisoning.

**Input / upload / infra** — Supabase `.or()`/`.ilike()` search routed through `sanitizeLikeTerm()`; UUIDs validated before raw interpolation; `.rpc()` uses named params; no raw SQL string building. Uploads validated by magic bytes (client mimetype/extension distrusted), 2MB dual-enforced, server-generated filenames (no traversal), allowlisted folders, auth-gated, rate-limited. No SSRF (no server-side fetch of user-supplied URLs). CORS strict allowlist with `credentials:true` (no reflected wildcard). Helmet CSP (`objectSrc:'none'`, no `unsafe-inline` scripts), HSTS preload, frameguard deny. Errors generic in prod, stack nulled; `.env` gitignored; no hardcoded secrets. Server-rendered HTML/XML escaped (`escHtml`, sitemap escaping); no SSTI.

---

## Remaining Risks / Recommended Hardening (not fixed here)

| # | Item | Severity | Why deferred |
|---|---|---|---|
| R-1 | `unified_login = true` in both prod DBs disables the host/guest login separation as a **product decision** (unified-identity direction). Per CLAUDE.md hosts should log in via Google only. | Low (policy) | Flipping the flag is a **product call**, not a security fix. FIX-1 ensures it fails safe when unreadable; the live value stays as the product owner set it. |
| R-2 | Session `access_token` + long-lived `refresh_token` returned in JSON body (SPA stores client-side), not httpOnly cookies. Raises blast radius of any future client XSS. | Low | Architectural; migrating to httpOnly/SameSite cookies is a larger change. CSP + no-`unsafe-inline`-scripts already limit XSS. |
| R-3 | Guest `verifyOtp` issues the booking grant phone-first; a request with a verified phone + arbitrary email can carry an unverified email into the booking (platform-domain notification relay). | Low–Med | Real but low-impact (spam/phishing echo, not takeover). Fix = bind grant to the exact verified channel tuple; touches the booking flow — schedule as a follow-up. |
| R-4 | In-memory rate-limit store resets on deploy / not shared across instances when `RATE_LIMIT_STORE_URL` unset. | Med (multi-instance only) | Per-account DB lockouts remain the backstop. Set `RATE_LIMIT_STORE_URL` + apply `v3.18` before running >1 instance. |
| R-5 | `platformConfig`/`razorpayConfig` fail open to defaults/env on DB error (mispricing risk, not auth). | Low | Add a `securityLog` on the catch so silent fallback is observable. |

---

## Future Hardening (beyond scope)

- **Phase 3 measurement:** submit to Google Search Console / Bing; add periodic Rich Results + `get_advisors` (Supabase security advisor) checks in CI.
- Move refresh tokens to httpOnly cookies (R-2).
- Enable persistent rate-limit store in production (R-4).
- Bind the guest booking grant to the full verified contact tuple (R-3).
- Enable Supabase leaked-password protection (pending from prelaunch remediation).

---

## Code Changes

| File | Change |
|---|---|
| `server/services/featureFlags.js` | FIX-1: `FAIL_CLOSED_KEYS` — security keys default `false` when absent/errored. |
| `server/controllers/uploadController.js` | FIX-2: pin `contentType` + `contentDisposition: attachment` on product-file upload. |
| `server/middleware/security.js` | FIX-3: new `downloadTokenLimiter` (IP, 30/hr) + export. |
| `server/routes/productRoutes.js` | FIX-3: apply `downloadTokenLimiter` to `GET /download/:token`. |
| `server/tests/unit/featureFlags.test.js` | 3 regression tests for FIX-1 fail-closed behavior. |

## Tests

Full server suite: **144 suites / 1074 tests pass** after changes (incl. 3 new fail-closed regression tests).
