# 08 — Production Security Checklist

Operational checklist for Meeticulous. ✅ = verified in this audit · ⬜ = action item (maps to `06`) · 🔁 = recurring.

## Secrets & configuration
- ✅ No secrets committed (only `*.env.example`); `.gitignore` covers all `.env*`.
- ✅ `service_role` key server-only; validated at boot (`config/supabase.js`).
- ✅ Google OAuth tokens AES-256-GCM encrypted in `profile_private` (RLS deny-all).
- ✅ `validateEnv` fail-fast on incomplete prod env.
- ⬜ Set a dedicated `OAUTH_STATE_SECRET` in prod (F-23).
- ⬜ Set `METRICS_TOKEN` (fail-closed today) and send it header-only (F-11).
- 🔁 Rotate Razorpay/SMTP/Supabase keys on any suspected exposure; never log secrets.

## Authentication
- ✅ OTP bcrypt-hashed, CSPRNG, 10-min TTL, 3-attempt lockout, per-contact+per-IP send caps, purpose-scoped.
- ✅ Per-account login lockout (5→15min); enumeration-resistant (timing-equalized, generic forgot-password).
- ✅ Admin: mandatory 2FA/TOTP, bcrypt, lockout, HS256 pinned (alg-confusion-safe), fail-closed secret.
- ✅ Superadmin unreachable via phone OTP.
- ⬜ Enable Supabase leaked-password (HIBP) protection (F-06).
- ⬜ Admin login: equalise unknown-vs-wrong timing; generic locked response (F-15).

## Authorization
- ✅ Every user-facing route enforces ownership (`req.user.id`/owner col); no IDOR found.
- ✅ Every admin route guarded; permissions resolved from DB at login; no impersonation endpoint.
- ⬜ Super-gate `/features*`, `/settings/payment/razorpay*`, `/settings` (F-03).
- ⬜ Add admin session revocation / token epoch (F-02).
- ⬜ Gate `/admin/upload/image` on a content permission (F-14).

## Data exposure
- ✅ Public reads use explicit column allowlists (no PII); community serializer first-name-only for guests.
- ✅ No PostgREST `select=` passthrough from query string.
- ⬜ Remove wildcard `profiles(*)` join on booking lists (F-01).

## Payments
- ✅ Razorpay source of truth; HMAC-SHA256 webhook verify (timingSafeEqual) before any write.
- ✅ Server-authoritative pricing (immutable snapshot); client never trusted.
- ✅ Order-id replay guard + captured-amount re-bind + subscription/product notes re-check.
- ✅ Idempotent on payment/order id; append-only `webhook_events` log.
- 🔁 Alert on `PAYMENT_SIGNATURE_INVALID` / `PAYMENT_AMOUNT_MISMATCH` / `WEBHOOK_SIGNATURE_INVALID` spikes (F-P4-3).

## Input / injection / XSS
- ✅ Parameterized Supabase/PostgREST queries (no string-concat SQL).
- ✅ 100kb JSON body cap; hpp; body sanitizer + suspicious-request blocker (defense-in-depth).
- ✅ Community = escaped React nodes; rich text sanitized via DOMPurify; `images` bucket MIME-locked (no SVG).
- ⬜ Enforce the SPA CSP (currently Report-Only) + drop `script-src 'unsafe-inline'` (F-05).

## Rate limiting & abuse
- ✅ Per-IP **and** per-contact limiter pairs (closes IP/email rotation bypass); ipGuard auto-ban; slowDown.
- ⬜ Add per-route limiters to `POST /explore/click` (F-04) and `/prerender/*` (F-19); stack per-contact on opening OTP (F-21).
- ⬜ **Patch `proxy-addr` (F-07)** — the IP-keyed defenses above are only as trustworthy as the resolved client IP.

## File uploads & storage
- ✅ Magic-byte sniffing (not Content-Type); size caps at multer + controller.
- ✅ Server-generated random keys (no traversal); `kyc`/`products`/`customer-files`/`gst-exports` private + signed URLs + RBAC + audit.
- ✅ `images` public but MIME-locked to raster (no SVG/HTML → no stored-XSS).
- 🔁 Keep `products`/`kyc` **Private** in the Supabase dashboard (confirmed private now).

## Transport & headers
- ✅ HSTS (API + SPA), `X-Content-Type-Options`, `X-Frame-Options`/frameguard, Referrer-Policy, Permissions-Policy.
- ✅ CORS locked to canonical origins in prod.
- ⬜ Promote SPA CSP to enforcing (F-05).

## Dependencies & build
- ⬜ `npm audit fix` server (proxy-addr critical + axios/nodemailer/body-parser/qs highs) (F-07/08/09).
- ⬜ Update client `react-router` + `zod` (+ dev chain) (F-10).
- 🔁 Lockfiles regenerated with a **real install outside OneDrive** (avoids esbuild EBADPLATFORM on CI).
- 🔁 Add `npm audit --audit-level=high` + secret scanner to CI (P4-2).

## Database & backups
- ✅ RLS fail-closed on all tables; no SECURITY DEFINER/view exposed to anon; service_role isolated.
- ⬜ Move extensions out of `public` (F-24); drop `services_price_backup_v394` (DB-4).
- ⬜ Confirm PITR enabled; document RPO/RTO + retention + user-deletion procedure (F-25).
- 🔁 Never boot a local server against the live DB (runs customer crons / seed overwrites templates).

## Deployment process
- ✅ Merge-to-main auto-deploys prod; founder controls merge timing.
- 🔁 PRs target the open release train (`release/YYYY-MM`); stop at PR; founder merges.
- 🔁 Post-deploy smoke: booking + OTP + payment (test mode) + admin 2FA login.

## Monitoring & response
- ✅ Sentry; `securityLog`/`auditLog`/`adminAlert`.
- ⬜ Add alert thresholds for the security events above (P4-3).
- 🔁 Quarterly re-audit: advisors + `npm audit` + the `07` SEC-suite.
