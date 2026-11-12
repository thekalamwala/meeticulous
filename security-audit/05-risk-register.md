# 05 — Risk Register

All findings ranked by **risk** (severity × exploitability × business impact). IDs match `02`. "Exploitable now" = reachable without a prerequisite that doesn't exist today.

| Rank | ID | Finding | Severity | CVSS | Exploitable now? | Business impact | Fix effort |
|---|---|---|---|---|---|---|---|
| 1 | F-07 | `proxy-addr` IP-spoofing CVE undermines all IP-keyed defenses | **CRITICAL** (dep) | ~7.5 | Yes (if XFF spoofable at edge) | Bypass rate limits / OTP / payment caps / IP bans → brute-force, spam, abuse | S (`npm update`) |
| 2 | F-01 | Booking lists leak full counterparty profile (DOB, is_banned, session fields, email) | MEDIUM | 4.3 | Yes (1 booking) | Cross-tenant PII leak; DPDP exposure; phishing/ATO recon | S |
| 3 | F-02 | No admin session revocation (deactivate/demote/reset don't kill live 8h tokens) | MEDIUM | 5.4 | Yes (needs a valid admin token) | Offboarding ineffective; stolen admin token = up to 8h unrevocable admin access | M (migration + middleware) |
| 4 | F-08 | `axios` SSRF/prototype-pollution/ReDoS | HIGH (dep) | ~7.5 | Partially | Weakens outbound-request safety; DoS | S |
| 5 | F-03 | Payments/flags/gateway-secret behind grantable `settings.manage`, not super | MEDIUM | 4.9 | No (needs a role grant) | One mis-scoped grant → Razorpay secret disclosure, mass-send, payment outage | S (route guards) |
| 6 | F-09 | `nodemailer`/`body-parser`/`follow-redirects`/`brace-expansion`/`qs` DoS/injection | HIGH (dep) | ~7.5 | Partially | Request-path DoS; SMTP cross-tenant TLS reuse | S–M |
| 7 | F-04 | Unbounded `explore_clicks` row-flood (no per-route limiter) | MEDIUM | 5.3 | Yes | DB storage/egress cost; analytics/ranking poisoning | S |
| 8 | F-05 | SPA CSP is Report-Only + `script-src 'unsafe-inline'` | MEDIUM | 4.0 | n/a (DiD) | No browser-side XSS containment | M |
| 9 | F-06 | Supabase leaked-password protection disabled | MEDIUM | 3.7 | Yes | Breached passwords accepted on email/phone-password accounts | S (toggle) |
| 10 | F-10 | Client `react-router` open-redirect + `zod` memory-DoS (+ dev-only highs) | HIGH (dep) | ~6 | Partially | Open redirect; build-chain DoS | S |
| 11 | F-15 | Admin login timing/lockout enumeration | LOW | 3.7 | Yes | Narrows staff-credential-stuffing targets | S |
| 12 | F-14 | Admin image upload gated by any-admin | LOW | 3.1 | Yes (any admin) | Low-priv staff storage abuse / asset spoofing | S |
| 13 | F-16 | Free-download link emailed to attacker-chosen address | LOW | 3.1 | Yes | Email bombing (limiter-bounded) | S |
| 14 | F-11 | `/metrics` non-constant-time token + `?token=` | LOW | 3.1 | No (fail-closed when unset) | Metrics disclosure if token set | S |
| 15 | F-13 | `create-order` missing `optionalProtect` (email-only auth) | LOW | 3.1 | Yes (needs booking UUID+email) | No useful read/write; helps pay | S |
| 16 | F-19 | `/prerender/*` no rate limiter | LOW | 3.5 | Yes | Origin DB load on cache-miss | S |
| 17 | F-22 | brevo/aisensy webhook secret via `?secret=` fallback | LOW | 2.5 | Partially | Secret in proxy logs | S |
| 18 | F-23 | `OAUTH_STATE_SECRET` unset in prod (derived fallback) | LOW | 2.0 | n/a | Weaker OAuth-state key separation | S (set env) |
| 19 | F-17 | Product price not clamped | LOW | 2.0 | Yes (own product) | Odd fee math only | S |
| 20 | F-12 | Invoice token `!==` (non-constant-time) | LOW | 1.5 | No (122-bit UUID) | Negligible | S |
| 21 | F-18 | Admin explore blind-spread `req.body` | LOW | 2.0 | No (admin-gated) | DiD only | S |
| 22 | F-20 | Username/email enumeration (public-by-design) | LOW | 2.5 | Yes | Minor recon | S |
| 23 | F-21 | Opening OTP not stacked with per-contact limiter | LOW | 2.0 | No (otpStore cap) | DiD only | S |
| 24 | F-24 | Extensions in `public` schema | LOW | 2.0 | No | Hygiene | S |
| 25 | F-25 | PITR/backup + retention policy not verified | LOW (ops) | — | n/a | Recovery/compliance gap | M (process) |

## Risk themes
1. **Dependency drift is the top risk** — the only CRITICAL (`proxy-addr`) and three HIGHs are CVEs with fixes available. The IP-spoofing one is amplified because the whole abuse-defense design keys on client IP. **Patch first.**
2. **Cross-tenant data minimization** — F-01 is the one real application leak: over-broad joins return more than the UI needs. Pattern to sweep: wildcard `profiles(*)` joins.
3. **Admin blast-radius containment** — F-02/F-03 are about limiting damage *after* an admin credential is abused (revocation + super-gating the money/flag controls). Admin AuthN itself is strong (2FA mandatory).
4. **Browser-side defense depth** — F-05 (enforce CSP) is the main missing layer; app-level XSS hygiene is already good.

## What is NOT a risk (so effort isn't wasted here)
RLS-no-policy tables (fail-closed by design), SSRF (none), webhook forgery (all verified), client-trusted pricing (server-authoritative), IDOR (ownership enforced), secrets-in-code (none), SVG-upload XSS (bucket MIME-locked), admin alg-confusion (pinned).
