# 06 — Remediation Roadmap

Prioritised plan. Each task: addressed findings · files · approach · effort (S/M/L) · dependencies · regression risk · acceptance criteria · tests. **No code is changed yet — this is the plan to approve.**

Effort: **S** < 0.5 day · **M** 0.5–2 days · **L** > 2 days.

---

## Priority 0 — Emergency (do first; small, high-leverage)

### P0-1 · Patch the IP-spoofing & request-path dependency CVEs
- **Findings:** F-07 (proxy-addr CRITICAL), F-08 (axios), F-09 (body-parser/qs/follow-redirects/brace-expansion/nodemailer).
- **Files:** `server/package.json`, `server/package-lock.json`.
- **Approach:** `npm audit fix` for non-breaking; manually bump `proxy-addr`, `axios`, `nodemailer`, `body-parser`, `qs` to patched versions; re-run `npm test`. Regenerate the lockfile with a **real install outside OneDrive** (see memory: esbuild/EBADPLATFORM hazard) so CI doesn't break.
- **Effort:** S · **Deps:** none · **Regression risk:** Medium (axios/nodemailer are on hot paths — run server tests + a manual booking+email smoke).
- **Acceptance:** `npm audit` shows 0 critical / 0 high in server runtime deps; booking, OTP email, Razorpay call still work.
- **Tests:** existing server suite green; SEC-RL-1 (IP-spoof can't bypass limiter — see `07`).

### P0-2 · Verify `trust proxy` after the proxy-addr patch
- **Findings:** F-07. **Files:** `server/server.js:24`.
- **Approach:** confirm hop count matches the real edge chain (Cloudflare → Render). After patching proxy-addr, re-test that `getClientIp()` returns the true client IP and an injected `X-Forwarded-For` can't override it.
- **Effort:** S · **Acceptance:** forged `X-Forwarded-For` does not change the rate-limit bucket (SEC-RL-1).

---

## Priority 1 — Critical hardening (auth, authz, data exposure, secrets)

### P1-1 · Stop the booking-list PII leak
- **Findings:** F-01. **Files:** `server/controllers/bookingController.js:785,833`, `server/lib/contactVisibility.js`.
- **Approach:** replace both `profiles!…fkey(*)` joins with an explicit allowlist (`id, name, username, profile_image, email`). Keep the stale-schema fallback already using explicit columns. Optionally also harden `redactBookingContact` to delete non-allowlisted fields as defense-in-depth.
- **Effort:** S · **Regression risk:** Low (the dashboard already consumes a subset; confirm it doesn't read a now-removed field).
- **Acceptance:** embedded counterparty object contains no `date_of_birth`/`is_banned`/`sessions_valid_after`/internal columns. **Tests:** SEC-DATA-1.

### P1-2 · Admin session revocation (token epoch)
- **Findings:** F-02 (+ INFO stale-permissions twin). **Files:** `admin_users` (migration: add `token_version int default 0`), `services/adminAuthService.js` (embed `tv` in JWT), `middleware/adminMiddleware.js` (reject on `tv` mismatch / `is_active=false`), `staffAdminController` (bump `token_version` on deactivate/demote/reset).
- **Approach:** one indexed read per admin request (or 30–60s cache). Run both DBs per the migration workflow.
- **Effort:** M · **Deps:** migration applied to prod+staging · **Regression risk:** Medium (every admin request now re-checks — cache to avoid latency; fail-open only on DB error for `is_active`, fail-closed on `tv` mismatch).
- **Acceptance:** deactivating an admin invalidates their live token on the next request. **Tests:** SEC-ADMIN-2.

### P1-3 · Super-gate payments/flags/gateway-secret
- **Findings:** F-03. **Files:** `server/routes/adminRoutes.js:76-108`.
- **Approach:** change `requireAdmin('settings.manage')` → `requireSuperAdmin` on `/features*`, `/settings/payment/razorpay*`, and `/settings`; or introduce `payments.manage`/`flags.manage` that are never auto-granted and wire the flag routes to `flags.manage`. Keep low-risk settings (reserved slugs, appearance, categories, explore curation) on `settings.manage`.
- **Effort:** S · **Regression risk:** Low (only affects which admin role can reach them; confirm the super account still can). **Acceptance:** non-super `settings.manage` token 403s on these. **Tests:** SEC-ADMIN-3.

### P1-4 · Enable Supabase leaked-password protection + set OAUTH_STATE_SECRET
- **Findings:** F-06, F-23. **Where:** Supabase dashboard (Auth → Password); Render env (`OAUTH_STATE_SECRET`).
- **Effort:** S · **Acceptance:** HIBP check on; a dedicated OAuth-state secret set in prod (no boot warning).

---

## Priority 2 — Abuse & spam prevention

### P2-1 · Rate-limit the unbounded public writes
- **Findings:** F-04 (explore/click), F-19 (prerender), F-21 (opening OTP per-contact).
- **Files:** `server/routes/exploreRoutes.js`, mount for `/prerender` in `server.js`, `server/routes/openingRoutes.js`, `server/middleware/security.js` (add a light `clickLimiter` if desired).
- **Approach:** attach `newsletterIpLimiter` (or a new `clickLimiter`) to `POST /explore/click`; add a limiter or confirm edge caching for `/prerender/*`; stack `otpContactLimiter` on opening OTP.
- **Effort:** S · **Acceptance:** each public write has a per-route limiter beyond the global cap. **Tests:** SEC-RL-2.

### P2-2 · Harden token comparisons & secret transport
- **Findings:** F-11 (/metrics), F-12 (invoice), F-22 (webhook `?secret=`), F-16 (free-download recipient).
- **Files:** `opsController.js`, `invoiceController.js`, `brevoInboundController.js`, `whatsappWebhookController.js`, `productController.js`.
- **Approach:** `crypto.timingSafeEqual` over hashed inputs; header-only secrets (drop `?secret=`/`?token=` query fallbacks); derive the free-download recipient from the OTP identifier instead of free-form `buyer_email`.
- **Effort:** S · **Acceptance:** no non-constant-time secret compare; no secret accepted via query string.

### P2-3 · Admin login enumeration + upload permission
- **Findings:** F-15, F-14. **Files:** `adminAuthController.js:85-99`, `adminRoutes.js:51`.
- **Approach:** dummy `bcrypt.compare` on the not-found path to equalise timing; return generic 401 for the locked case (or reveal lock only after a correct password); gate `/admin/upload/image` on `cms.manage`.
- **Effort:** S · **Acceptance:** identical timing/status for unknown vs wrong-password; read-only `support` role 403s on upload.

---

## Priority 3 — Infrastructure & application hardening

### P3-1 · Enforce the SPA Content-Security-Policy
- **Findings:** F-05. **Files:** `client/vercel.json`, Vite build config.
- **Approach:** audit built SPA for inline scripts; move to hashes/nonces; promote `Content-Security-Policy-Report-Only` → enforcing `Content-Security-Policy`, drop `script-src 'unsafe-inline'`, add `report-to`. Stage behind Report-Only to collect violations first.
- **Effort:** M · **Regression risk:** Medium (an over-tight CSP can break Razorpay/analytics — keep their allowances; test checkout). **Acceptance:** enforcing CSP header; checkout + analytics still load; no console CSP errors in normal flows.

### P3-2 · Client dependency updates
- **Findings:** F-10. **Files:** `client/package.json`.
- **Approach:** update `react-router`/`react-router-dom` (open-redirect) and `zod`; update the dev/build chain (`vite`, `esbuild`, `puppeteer` for OG script). Regenerate lockfile outside OneDrive.
- **Effort:** S–M · **Regression risk:** Medium (react-router major-ish — run client tests + manual nav). **Acceptance:** `npm audit` high-sev cleared or dev-only; app builds + routes work.

### P3-3 · DB & ops hygiene
- **Findings:** F-24, F-25, DB-4. **Approach:** move `btree_gist`/`pg_trgm`/`vector` out of `public`; confirm PITR enabled + document RPO/RTO + a data-retention/user-deletion procedure; drop `services_price_backup_v394` when safe.
- **Effort:** M · **Acceptance:** advisor `extension_in_public` clears; retention doc exists; PITR confirmed.

---

## Priority 4 — Continuous security

### P4-1 · Security regression suite (see `07`)
Add the SEC-* tests to the existing Jest suite so each fix is pinned and future regressions fail CI. **Effort:** M.

### P4-2 · Automated SCA + secret scanning in CI
Add `npm audit --audit-level=high` (or Dependabot/`osv-scanner`) and a secret scanner (gitleaks) to the PR CI. A known hazard: lockfiles must be regenerated with a real install outside OneDrive. **Effort:** M.

### P4-3 · Monitoring & alerting
`securityLog`/`adminAlert`/Sentry already exist; add alerts on spikes of `PAYMENT_SIGNATURE_INVALID`, `WEBHOOK_SIGNATURE_INVALID`, `PAYMENT_AMOUNT_MISMATCH`, admin login failures, and ipGuard auto-bans. **Effort:** M.

### P4-4 · Recurring audit cadence
Re-run advisors + `npm audit` + this suite each release; full review quarterly. **Effort:** S (process).

---

## Dependency / sequencing notes
- **Independent (parallelisable):** P0-1, P1-1, P1-3, P1-4, P2-1, P2-2, P2-3, P3-1, P3-2, P3-3 are isolated changes.
- **Needs a migration (both DBs):** P1-2 (admin token epoch), P3-3 (extensions).
- **Needs the migration workflow** in CLAUDE.md: run on prod+staging, keep schema fallback until confirmed.
- **Order that de-risks fastest:** P0-1 → P0-2 (restore the IP-defense), then P1-1 (stop the live leak), then the rest by priority.
- Per repo policy: each change → fresh branch → PR against the open **release train** (`release/2026-11`) → **stop at the PR** (founder merges).
