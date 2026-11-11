# 02 — Security Audit Report (Detailed Findings)

**Date:** 2026-11-11 · **Method:** static code review of client + server + live read-only Supabase introspection + dependency (SCA) + secret scan, with five parallel domain deep-dives (IDOR/BOLA, admin RBAC, public/SSRF, mass-assignment/exposure, upload/storage). Every CONFIRMED finding below was verified against primary source (`file:line`).

## How to read this
- **CONFIRMED** = proven from code/DB. **SUSPECTED** = needs runtime/dashboard check. **SAFE** = checked, no issue.
- Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO (see `05` for the ranked register with CVSS).
- **Headline:** the platform is security-mature. No CRITICAL or HIGH *application-logic* vulnerability was found. The single CRITICAL is a dependency CVE (`proxy-addr`) that undermines the IP-based defenses. The rest are MEDIUM/LOW hardening items. The classic holes (client-trusted pricing, unsigned webhooks, plaintext OTP, shared admin/user auth, public RLS tables, secrets in code, SSRF, SVG-upload XSS, IDOR) are **closed**.

---

## MEDIUM findings

### F-01 · Booking lists leak the full counterparty profile (excessive data exposure / cross-user PII)
1. **ID:** F-01
2. **Name:** Wildcard profile join on booking lists exposes private PII
3. **Location:** `server/controllers/bookingController.js:785` (getHostBookings), `:833` (getGuestBookings); redaction `server/lib/contactVisibility.js:49-68`
4. **Endpoint/table:** `GET /api/bookings/host`, `GET /api/bookings/guest` → `profiles`
5. **Severity:** MEDIUM · **CVSS:** 4.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N)
6. **Mechanism:** Both handlers embed the counterparty's profile with a **wildcard** PostgREST join — `profiles!bookings_guest_id_fkey(*)` / `profiles!bookings_host_id_fkey(*)`. `redactBookingContact` only nulls `.phone`/`.guest_phone`; every other column of the joined `profiles` row is returned verbatim.
7. **Attacker scenario:** Any host, after one paid booking, reads each guest's full `profiles` row — `date_of_birth` (private PII, migration v3.138 states "never shown publicly"), `email`, `is_banned`, `sessions_valid_after`, `failed_login_count`, `login_locked_until`, `plan`, `google_id`, `linkedin_sub`. Symmetrically, any guest reads the host's full row. Harvestable at scale by a host with many bookings.
8. **Business impact:** Privacy/DPDP exposure of DOB + internal moderation/session fields across the tenant boundary; aids targeted phishing and account-takeover reconnaissance (e.g. knowing a target's lockout/ban state).
9. **Fix:** Replace `(*)` with an explicit column allowlist (`id, name, username, profile_image, email`) on both joins, **or** extend `redactBookingContact` to delete `date_of_birth, is_banned, sessions_valid_after, failed_login_count, login_locked_until, google_id, linkedin_sub, plan_*` from `booking.profiles`. Allowlist is preferred (fail-closed against future column additions).
10. **Dependencies:** none.
11. **Test:** as a host, `GET /api/bookings/host`; assert the embedded guest object contains no `date_of_birth`/`is_banned`/`sessions_valid_after`. Mirror for guest. (See `07` SEC-DATA-1.)
12. **Status:** CONFIRMED.

### F-02 · No admin session revocation (deactivation/demotion/reset don't kill live tokens)
1. **ID:** F-02 · 2. Stateless admin JWT ignores account state
3. **Location:** `server/middleware/adminMiddleware.js:21-49`; `server/services/adminAuthService.js` (SESSION_TTL ≈ 8h); `staffAdminController.setStaffActive/updateStaff/resetStaffPassword`
4. **Endpoint:** all `/api/admin/*` (guard), admin offboarding routes
5. **Severity:** MEDIUM · **CVSS:** 5.4 (AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:L/A:N — requires a previously-valid admin token)
6. **Mechanism:** The guard verifies the HS256 admin JWT, asserts `type==='admin'`, and trusts the **permission array embedded at login**. It never re-reads `admin_users`, so it never checks `is_active`, `locked_until`, or the current `role_key`. Deactivate/demote/reset only mutate DB columns.
7. **Attacker scenario:** A rogue or compromised admin who is deactivated or demoted (the primary offboarding control) keeps full access — including `*` for a demoted super — until their token expires (up to ~8h). A stolen admin token cannot be revoked at all.
8. **Impact:** Offboarding and incident-response containment are ineffective for up to a session lifetime; theft of one admin token = up to 8h of unrevocable admin access to all PII, finance, payouts, flags.
9. **Fix:** Add a `token_version` (or `jti`/epoch) column to `admin_users`, embed it in the JWT, and reject on mismatch or `is_active=false` in the middleware (one indexed read or a short TTL cache). Bump the epoch on deactivate/demote/reset-password. Closes the stale-permissions direction too (INFO twin).
10. **Dependencies:** migration (add column), middleware change.
11. **Test:** mint an admin token → deactivate that admin → next request returns 401. (See `07` SEC-ADMIN-2.)
12. **Status:** CONFIRMED.

### F-03 · Payments/flags/gateway-secret gated by a grantable permission, not `requireSuperAdmin`
1. **ID:** F-03 · 2. Sensitive admin controls behind `settings.manage` (latent privilege escalation)
3. **Location:** `server/routes/adminRoutes.js:76-77, 100-108` (vs structural `requireSuperAdmin` at `:117-123` staff, `:251-256` gifts)
4. **Endpoints:** `PATCH /api/admin/features/:key` (toggles `crm_admin_sends` mass-send + payments kill-switch), `POST /api/admin/features`, `GET/PUT/POST /api/admin/settings/payment/razorpay` (reads/writes the **Razorpay secret**), `GET/PUT /api/admin/settings`
5. **Severity:** MEDIUM · **CVSS:** 4.9 (AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:N — conditioned on a role grant)
6. **Mechanism:** These ride `requireAdmin('settings.manage')`. The codebase deliberately gates staff management, plan gifting, and IP block/allowlist with **structural** `requireSuperAdmin` "so it can never become grantable to a non-super role by a future `admin_roles` DB edit" — but the flag/payment-credential/settings writes did not get that treatment. (Also: a `flags.manage` permission exists and is held by the developer role, yet the flag routes check `settings.manage` — a latent mis-wire.)
7. **Attacker scenario:** `settings.manage` is held by no seeded non-super role **today** (so not live-exploitable), but permissions are resolved from the `admin_roles` row at login and roles are edited via migrations. One grant of `settings.manage` to, e.g., a marketing role silently lets it unmask/rotate the Razorpay secret, flip `crm_admin_sends` to mass-send, or disable payments — no super required.
8. **Impact:** A single mis-scoped role grant → gateway-credential disclosure, mass-email abuse, payment outage.
9. **Fix:** Move feature-flag writes, payment-credential routes, and platform-settings writes behind `requireSuperAdmin` (matching staff/gifts), or a dedicated never-auto-granted `payments.manage`/`flags.manage` gate; wire flag routes to `flags.manage`.
10. **Dependencies:** none (route-guard change).
11. **Test:** a non-super admin token with `settings.manage` must 403 on `PATCH /features/:key` and `/settings/payment/razorpay`. (See `07` SEC-ADMIN-3.)
12. **Status:** CONFIRMED (structural); exploitability SUSPECTED (requires a role grant first).

### F-04 · Unbounded row-flood on `explore_clicks`
1. **ID:** F-04 · 2. Public click-log insert has no per-route rate limit
3. **Location:** `server/controllers/exploreController.js:222-228`; route `server/routes/exploreRoutes.js:10`
4. **Endpoint:** `POST /api/explore/click` → `explore_clicks`
5. **Severity:** MEDIUM · **CVSS:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L)
6. **Mechanism:** Fire-and-forget `INSERT` into `explore_clicks` guarded only by the global `apiLimiter` (100/min/IP); IP rotation removes even that ceiling. No session dedupe.
7. **Attacker scenario:** Script the `sendBeacon` endpoint to flood `explore_clicks` (≈144k rows/day/IP, unbounded via IP rotation), bloating the table and poisoning explore-ranking analytics.
8. **Impact:** DB storage/egress cost (free-tier bandwidth cliff), degraded analytics, possible ranking manipulation.
9. **Fix:** Attach a dedicated limiter (reuse `newsletterIpLimiter` or a new `clickLimiter`) and/or per-session dedupe.
10. **Dependencies:** none. 11. **Test:** 200 rapid `POST /explore/click` from one IP → 429 after the cap. 12. **Status:** CONFIRMED.

### F-05 · SPA Content-Security-Policy is Report-Only and allows `script-src 'unsafe-inline'`
1. **ID:** F-05 · 2. CSP not enforced on the browser app
3. **Location:** `client/vercel.json:703-705` (`Content-Security-Policy-Report-Only`)
4. **Surface:** meeticulous.com (Vercel-served SPA)
5. **Severity:** MEDIUM · **CVSS:** 4.0 (defense-in-depth gap; raises XSS blast radius)
6. **Mechanism:** The only CSP on the app is **Report-Only**, so it blocks nothing; it also lists `script-src 'unsafe-inline'` and has no `report-uri`/`report-to`, so it neither enforces nor even collects reports. (The API's helmet CSP applies only to API/JSON responses, not the SPA.)
7. **Attacker scenario:** Any XSS that slips past React's escaping / DOMPurify (e.g. a future unsanitized sink) executes unimpeded; the CSP provides no containment.
8. **Impact:** No browser-side mitigation layer for XSS/data exfiltration.
9. **Fix:** Promote to enforcing `Content-Security-Policy`; drop `'unsafe-inline'` from `script-src` (use hashes/nonces — Vite supports this) while keeping the Razorpay/analytics allowances; add a `report-to` endpoint. Roll out behind Report-Only first to catch violations.
10. **Dependencies:** verify inline-script usage in the built SPA. 11. **Test:** response header `Content-Security-Policy` present and enforcing; an inline `<script>` is blocked. 12. **Status:** CONFIRMED.

### F-06 · Supabase leaked-password protection disabled
See `04` DB-1. `MEDIUM` — enable HaveIBeenPwned check in Supabase → Auth so email/password and phone-password accounts can't use breached passwords. Status: CONFIRMED (advisor).

---

## Dependency (SCA) findings — see `05` for the full table

### F-07 · `proxy-addr` IP-spoofing CVE (CRITICAL dependency)
- **Location:** server `node_modules/proxy-addr` (Express transitive). **Severity:** CRITICAL (per npm audit).
- **Mechanism:** IP spoofing via IPv4-mapped IPv6 trust subnet. The app runs `app.set('trust proxy', 1)` and **every** rate limiter, the ipGuard auto-ban, and `getClientIp()` key on the resolved client IP. A spoofable X-Forwarded-For lets an attacker forge the client IP.
- **Impact:** Bypass of per-IP rate limits, OTP/login/payment caps, and IP bans — the backbone of the abuse defenses. Also skews ipGuard offense attribution (could ban an innocent IP).
- **Fix:** `npm update proxy-addr` (fix available); re-pin Express transitive. Re-verify `trust proxy` hop count matches the Render/Cloudflare edge.
- **Status:** CONFIRMED (SCA). Priority 0.

### F-08 · `axios` SSRF/prototype-pollution/ReDoS (HIGH dependency)
- Multiple advisories incl. *fetch adapter ignores `maxRedirects:0` (redirect-based SSRF)*, prototype-pollution gadgets, ReDoS. Server uses axios for outbound calls. Fix available (`npm update axios`). The app's *own* code has no SSRF (confirmed), but a vulnerable axios weakens outbound-request safety. **Status:** CONFIRMED. Priority 1.

### F-09 · Other high-sev server deps — `nodemailer`, `body-parser`, `follow-redirects`, `brace-expansion`, `qs`
- DoS (ReDoS/stack/CPU), header-injection, cross-tenant SMTP TLS servername reuse (nodemailer). All have fixes. `body-parser`/`qs` are request-path (DoS). **Status:** CONFIRMED. Priority 1–3.

### F-10 · Client ships `react-router` (open redirect) + `zod` (memory DoS); dev deps `puppeteer/vite/esbuild` high-sev
- `react-router` open-redirect via backslash in `<Link>`/`useNavigate`; `zod` memory exhaustion. Update both. The 8 other client high-sevs (puppeteer/chromium-bidi/vite/esbuild/extract-zip/basic-ftp/get-uri/pac-proxy-agent) are **dev/build-only** (OG-image + dev server) — not shipped to the browser; still update. **Status:** CONFIRMED. Priority 3.

---

## LOW findings (consolidated)

| ID | Finding | Location | Note / mitigation | Status |
|---|---|---|---|---|
| F-11 | `/metrics` token compared with `!==` (non-constant-time) + accepts `?token=` (log leak) | `opsController.js:52` | Fail-closed (404 when unset). Use `timingSafeEqual` over hashes; header-only | CONFIRMED |
| F-12 | Invoice `access_token` compared with `!==` | `invoiceController.js:14` | 122-bit UUID id+token → infeasible to time-brute | CONFIRMED (impact negligible) |
| F-13 | `create-order` route lacks `optionalProtect` → authed-guest branch dead, auth is email-only | `paymentController.js:246`, `paymentRoutes.js:23` | Booking id is UUID; only writes `razorpay_order_id`; reuses/409s. Add `optionalProtect` | CONFIRMED (low) |
| F-14 | `POST /admin/upload/image` gated by any-admin, not a content permission | `adminRoutes.js:51` | Read-only `support` role can upload ≤2MB images | CONFIRMED |
| F-15 | Admin login timing enumeration + 429 lockout discloses account existence | `adminAuthController.js:85-99` | Add dummy bcrypt on not-found; generic 401 on lock | CONFIRMED |
| F-16 | Free-product download emails link to attacker-chosen `buyer_email` | `productController.js:225-288` | Email bombing; bounded by freeDownload email+IP limiters. Derive recipient from OTP identifier | CONFIRMED |
| F-17 | Product `price` not clamped | `productController.js:71,123` | Own product; odd fee math only. Clamp like services | CONFIRMED (minor) |
| F-18 | Admin explore update blind-spreads `req.body` | `exploreController.js:336,390` | Admin-gated; non-privileged tables. Pin to allowlist | SUSPECTED (DiD) |
| F-19 | `/prerender/*` has no rate limiter | `server.js:216` | Not SSRF (DB-lookup keys only); origin DB load on cache-miss. Add limiter/edge cache | CONFIRMED |
| F-20 | Username-resolve + guest-signup 409 email/username enumeration | `usernameController.js:38`, `authController.js:386` | Usernames public by design; signup 409 standard. Bounded by authLimiter | CONFIRMED (low) |
| F-21 | Opening OTP route not stacked with per-contact limiter | `openingRoutes.js:16` | Mitigated by `otpStore` per-number 3/hr cap. Stack `otpContactLimiter` for consistency | CONFIRMED (mitigated) |
| F-22 | brevo + aisensy webhooks accept secret via `?secret=` query fallback | `brevoInboundController`, `whatsappWebhookController` | Verified before write; header preferred (query lands in logs). Drop the query fallback | CONFIRMED (DiD) |
| F-23 | `OAUTH_STATE_SECRET` not set in prod → derived fallback (warned) | `authController.js:54-60` | Purpose-separated derivation from service key; set a dedicated secret | CONFIRMED (ops) |
| F-24 | `extension_in_public` (3 extensions) | Supabase | Move out of `public` schema | CONFIRMED (LOW) |
| F-25 | PITR/backup + data-retention policy not verified/codified | ops | Confirm PITR; document retention + user-deletion | LOW (ops) |

---

## SAFE — notable controls verified correct (not vulnerabilities)

- **Payments:** HMAC-SHA256 webhook verify (`timingSafeEqual`), order-id replay guard, captured-amount re-bind to created order, subscription/product order-notes re-check (no cheap→expensive activation), idempotency on payment/order id, append-only `webhook_events` log. All pricing server-derived from DB; client never trusted.
- **AuthN:** OTP bcrypt-hashed CSPRNG, 3-attempt lockout, per-contact + per-IP send caps, purpose-scoped codes; per-account login lockout; timing-equalized enumeration resistance; generic forgot-password response with lockout that re-requests can't clear; OAuth `state` HMAC (CSRF) + anchored open-redirect allowlist; tokens delivered in URL fragment; superadmin barred from phone-OTP sessions; contact-bound booking grant.
- **AuthZ (IDOR/BOLA):** every user-facing read/mutate scopes by `req.user.id`/owner column or a high-entropy signed token; no confirmed IDOR across bookings, services, products, invoices, reviews, support, vendor, notifications, KYC, community, referrals.
- **Admin:** separate isolated JWT (HS256 pinned, alg-confusion-safe, fail-closed secret), **mandatory 2FA/TOTP** with replay guard + single-use recovery codes, per-account + IP lockout, permissions resolved from DB (never client), no impersonation endpoint, every admin route guarded.
- **Mass-assignment:** every authenticated write uses an explicit allowlist; no plan/role/`is_banned` self-set; money fields 100% server-derived; `updateMe`/`updateProfile` strip privileged columns.
- **SSRF:** none — no server-side fetch takes an attacker-controlled host (bot, prerender, seoCrawler, gscSync, OAuth, OG cards, RISC, meta all fixed-host/internal).
- **Webhooks:** all five (resend/svix, meta, github, brevo, aisensy) verify signature/secret before any DB write, fail-closed, env secrets.
- **Uploads/storage:** magic-byte sniffing (not Content-Type), server-generated random keys (no traversal), size caps at multer **and** controller, private `kyc`/`products`/`customer-files` buckets + 60s signed URLs + RBAC + audit, public `images` bucket MIME-locked (no SVG/HTML → no stored-XSS).
- **DB:** service_role isolated; RLS fail-closed on 123 tables; no SECURITY DEFINER / view exposed to anon; tokens AES-256-GCM in `profile_private`.
- **Secrets:** none committed; `.env*` gitignored; validateEnv fail-fast; Vite prod build emits no sourcemaps by default.
- **Frontend XSS:** community renders escaped React text nodes; rich-text service description sanitized via DOMPurify before render; other HTML sinks are static dev assets.
