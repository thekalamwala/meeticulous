# Security Audit — Book A Sloth (2026-07-02)

_Branch: `fix/security-hardening` • Method: 6 parallel red-team attack-surface agents (auth, payments, authz/IDOR, injection/upload, business-logic, deps/config) → main-thread verification of every claim against source → blue-team fixes + regression tests → live verification (Jest suite, client build, Supabase security advisors on staging)._

Red-team first, blue-team second. Every agent finding below was **re-verified against the actual code** before being accepted — several headline "Critical/High" claims did not survive that check and are documented as rejected with the reason.

---

## 1. Executive Summary

Book A Sloth has now been through **six** security passes (06-17, 06-22, 06-23, 06-27, 07-01, and this 07-02 red-team). It is a **genuinely hardened codebase**. This engagement re-attacked the full surface and found **no new exploitable Critical or High vulnerabilities**. The prior headline CRITICALs (anon `profiles` dump; `platform_settings` webhook-secret leak) remain fixed and were re-confirmed at the DB layer in prior passes.

What this pass produced is a set of **defense-in-depth hardening fixes** — the most meaningful being the booking-grant **channel-tuple binding** (audit R-3), which three independent agents flagged and which closes the cleanest variant of the guest-booking notification-relay vector. All fixes ship with regression tests that assert the exploit is dead.

- **Attack surface reviewed:** 39 controllers, 24 route files, 10 middleware; auth/OTP/JWT/2FA/OAuth, Razorpay order+subscription+webhook+settlement+ledger, IDOR across every by-id route, injection/upload/XSS/SSRF/SSTI/email, booking + plan-limit + followup business logic, dependency + config + secrets + CORS + RLS.
- **Result:** 0 Critical, 0 High (exploitable). 6 defense-in-depth fixes implemented + tested. Remaining items are Low / policy / infra-scaling, each with a documented mitigation.

**Overall residual risk: LOW.**

---

## 2. Risk Score

| Dimension | Rating |
|---|---|
| Exploitable Critical | **0** |
| Exploitable High | **0** |
| Medium (all with documented mitigation) | 0 code-exploitable; 3 config/process items |
| Low / defense-in-depth (fixed this pass) | 6 |
| Overall residual risk | **LOW** |
| OWASP Top 10 (2021) coverage | A01–A10 reviewed; no failing control |
| OWASP ASVS alignment | L1 met; L2 substantially met (gaps: session tokens not httpOnly, no per-channel OTP binding) |

---

## 3. Vulnerability Inventory (all agent findings + verdict)

Legend: **FIXED** (patched this branch) · **DOC** (real, documented as residual/mitigation) · **REJECTED** (not exploitable after source verification).

| ID | Surface | Finding | Agent sev | Verified verdict |
|---|---|---|---|---|
| A-1 | Auth | "OTP cross-purpose reuse (booking→login)" | Critical | **REJECTED** — `otpStore.js:122-149`: booking+login intentionally share `type='booking'`; only `password_reset` is isolated. Redeeming needs the OTP (victim's own channel) and still hits the host guard at `authController.js:889`. No privilege gain. |
| A-2 | Auth | "login timing enumeration not equalized" | Med | **REJECTED** — `authController.js:844` performs a dummy `signInWithPassword` to equalize timing. Agent misread. |
| A-3 | Auth | Phone/account collision via desync | High | **REJECTED as code bug** — reduces to SIM-swap, inherent to the phone-as-identity product model (CLAUDE.md). |
| A-4 / B-5 | Auth/Logic | Booking grant binds phone only; email swappable → host-branded confirmation relayed to arbitrary victim | Med | **FIXED** (FIX-1). = R-3. CVSS 5.3 `AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:L`. |
| P-1 | Payments | Reschedule-fee GST rate not snapshotted | "Critical" | **DOC (Low)** — agent's own trace shows the journal stays balanced; only matters if an admin changes the GST rate inside the charge→post window. Snapshot recommended, not shipped (marginal, touches money-critical path). |
| P-2 | Payments | Negative `vendor_amount` in settlement | High | **FIXED** (FIX-4) as DiD — was already clamped downstream by `Math.max(0, matured-claimed)`; now clamped at source too. Requires DB write to trigger. |
| P-3 | Payments | Sub-cancel doesn't downgrade plan immediately | "Critical" | **REJECTED** — standard SaaS: cancel keeps paid access to period end (`resolveVendorPlan` expires at `plan_expires_at`). Agent's "immediate downgrade" fix would revoke features the user paid for. Refund→revoke is a **process** rec (DOC). |
| P-4 | Payments | `calculatePlatformFee` no upper-bound | High | **DOC (Low)** — `assertNonNegative` already blocks negatives; abuse needs admin/DB compromise. Correct fix layer = validate at the admin settings **write** path, not the pure pricing lib. |
| P-5 | Payments | Commission not snapshotted in order notes | High | **REJECTED** — the booking row already snapshots commission (`bookingController.js:412`) and `customer_total`; tampering needs DB write. Order-notes copy is redundant. |
| P-6/7/8 | Payments | proration / webhook-rebind / free-service ledger | — | **REJECTED** — self-retracted by the agent after re-reading (Razorpay notes are server-set; `Math.max` clamps proration; free services carry no commission). |
| I-1 | Injection | CRLF in WhatsApp template params (`host_name`/`guest_name`) | Med | **FIXED** (FIX-2). Strip CR/LF/TAB before the AiSensy boundary. |
| I-2 | Injection | Deep-link username not URL-encoded | Low | **FIXED** (FIX-2). `encodeURIComponent` on the slug. |
| I-rest | Injection | Supabase filters, uploads, sitemap XML, email HTML, path traversal | — | **VERIFIED SAFE** — `sanitizeLikeTerm`, magic-byte upload sniffing, `xmlEscape`, `htmlEscape`, server-generated filenames, `encodeURIComponent` on download links. |
| B-2 | Logic | Pending-unpaid slot squatting / calendar DoS | High | **DOC (Low-Med)** — reaper EXISTS (`bookingController.js:1566-1591`); creation gated by OTP grant + `bookingLimiter`/`bookingContactLimiter`. Consider shorter hold. Overstated by agent. |
| B-1 | Logic | Review race on `no_show` status | Med | **DOC (Low)** — millisecond window, low impact (review on a no-show); `reviewController` already checks `status='completed'`. |
| B-3 | Logic | Completion time-gate μs race | Low | **REJECTED** — agent called it academic (clock granularity ≫ window). |
| B-4 | Logic | Service price snapshot drift | Low | **REJECTED** — `customer_total` is snapshotted; order amount-binding enforced. Cosmetic only. |
| B-7 | Logic | Free-service cap activate/deactivate race | Very Low | **DOC** — millisecond soft-cap race; DB partial-unique constraint would harden. |
| D-H1 | Deps | `nodemailer <=9.0.0` file-read/SSRF (GHSA-p6gq-j5cr-w38f) | High | **FIXED** (FIX-5) → 9.0.3. Not exploitable here (no caller passes user-controlled `raw`/`path`/`href`); bumped for hygiene. |
| D-H2/M1 | Deps | `undici` (client), `js-yaml` (server) | High/Mod | **FIXED** (FIX-6) via non-major `npm audit fix`. Both dev/build-time only. |
| D-H3 | Deps | `vite<=6.4.2`/`esbuild` dev-server issues | High | **DOC** — dev-server only, **zero prod impact** (prod ships static build); needs `vite@8` major bump (coordinate with lockfile-drift runbook). |
| D-M2 | Config | `express.json()` implicit 100kb limit | Mod | **FIXED** (FIX-3) — limits now explicit (json 100kb, raw 1mb). |
| D-M3 | Config | Webhook replay relies on state idempotency, no event-id ledger | Mod | **DOC** — signature verified over raw body + idempotent transitions + unique `razorpay_payment_id`. Event-id ledger = optional belt-and-suspenders. |
| D-L1 | Config | In-memory rate-limit store | Info | **DOC** — safe on single instance; set `RATE_LIMIT_STORE_URL` before horizontal scaling. |
| D-L2 | Config | `trust proxy=1` latent if a 2nd proxy added | Low | **DOC** — correct today (single Render hop, XFF not spoofable); runbook gate for adding Cloudflare. |
| Authz | AuthZ/IDOR | ~30 by-id endpoints, admin RBAC, mass-assignment | — | **VERIFIED SAFE** — ownership `.eq(host_id/guest_id, req.user.id)` on every by-id op; `requireAdmin(perm)`; whitelisted writes. Zero findings. |
| DB | Config | Supabase security advisors (staging) | — | RLS deny-by-default (safe; app uses service role). 2 WARN: `btree_gist` in public schema; **leaked-password protection disabled** (enable both DBs). |

---

## 4. Fixes Implemented (this branch)

| # | File(s) | Change | Test |
|---|---|---|---|
| FIX-1 | `server/utils/bookingGrant.js` | **Channel-tuple binding (R-3).** Grant now carries `ph`+`em` claims; `verify` pins every channel the booking presents to the verified one, and rejects any channel that was never verified. Legacy tokens (no channel claims) still pass on `sub` during the 30-min TTL rollout. Closes "verify my own phone → book with a victim's email" relay. | `bookingGrant.test.js` +5 tests (email-swap reject, phone-swap reject, phone-only-can't-add-email, email-only-can't-add-phone, legacy compat) |
| FIX-2 | `server/services/followups/followupService.js` | Strip CR/LF/TAB from `host_name`/`guest_name` before WhatsApp template params; `encodeURIComponent` the deep-link username. | `followupProcess.test.js` +1 (CRLF stripped) |
| FIX-3 | `server/server.js` | Explicit body-parser limits: `express.json({limit:'100kb'})`, `express.raw({..., limit:'1mb'})`. | covered by existing route tests |
| FIX-4 | `server/services/settlementService.js` | Clamp `vendor_amount` to ≥0 at source (a corrupted negative row can't suppress a real balance). | `settlementService.test.js` +1 |
| FIX-5 | `server/package.json` | `nodemailer` 8.0.11 → **9.0.3** (GHSA-p6gq-j5cr-w38f). Server `npm audit` → **0 vulnerabilities**. | full suite |
| FIX-6 | `server/package-lock.json`, `client/package-lock.json` | Non-major `npm audit fix`: `js-yaml` (server), `undici` (client). | build + suite |

**Verification (evidence, not assertion):**
- `server: npm test` → **153 suites / 1131 tests pass** (incl. 7 new security regression tests).
- `client: npm run build` → **clean, built in ~24s**.
- `server: npm audit` → **0 vulnerabilities**. `client: npm audit` → 2 remaining (dev-only vite/esbuild; documented).
- Supabase **security advisors (staging)** reviewed — RLS posture safe; 2 WARN documented.

The regression tests are the exploit re-verification: e.g. `verify(grant_for_my_phone, { phone: mine, email: victim })` now returns `false`.

---

## 5. Remaining Risks (with mitigations)

| ID | Risk | Sev | Mitigation / status |
|---|---|---|---|
| R-1 | `unified_login = true` in prod disables host/guest login separation | Low (policy) | Product decision; flag fails-closed if unreadable. Flip to `false` if unified identity isn't intended yet. |
| R-2 | Session `access`/`refresh` tokens in JSON body (SPA client-side), not httpOnly cookies | Low | CSP + no `unsafe-inline` scripts limit XSS blast radius. Migrate to httpOnly/SameSite cookies. |
| R-3b | Notification-relay **residual**: FIX-1 closes post-verification email swap, but an attacker who supplies a victim email at the OTP-request step can still relay (that also emails the victim an OTP). Full close needs per-channel OTP verification. | Low | Architectural follow-up (verify email + phone independently). |
| R-4 | In-memory rate-limit store resets on deploy / not shared across instances | Med (multi-instance only) | Per-account DB lockouts backstop; set `RATE_LIMIT_STORE_URL` before scaling >1 instance. |
| R-5 | Webhook replay guarded by state idempotency, not an event-id ledger | Low | Add a unique-constrained `webhook_event_id` short-circuit. |
| R-6 | Slot squatting via abandoned pending-unpaid bookings | Low-Med | Reaper + OTP grant + rate limits already gate it; consider reducing `PENDING_BOOKING_HOLD_MIN`. |
| R-7 | `platform_fee` / reschedule-fee GST rate: no upper-bound / not snapshotted | Low | Validate fee range at the admin-settings write path; snapshot `gst_rate` into reschedule order notes. |
| R-8 | Refund does not auto-revoke a paid plan | Low (process) | On refund, admin should set `plan_expires_at = now`. |
| R-9 | Supabase leaked-password protection disabled; `btree_gist` in `public` schema | Low | Enable HaveIBeenPwned check on **both** DBs; move extension to a dedicated schema. |
| R-10 | `vite`/`esbuild` dev-server advisories (Windows dev machine) | Low (dev-only) | Plan `vite@8` major bump; meanwhile don't browse untrusted sites while `vite dev` runs. |

---

## 6. Recommended Future Hardening

1. Migrate refresh tokens to httpOnly/SameSite cookies (R-2).
2. Per-channel OTP verification so email and phone are each independently proven (fully closes R-3b).
3. Persistent rate-limit store (`RATE_LIMIT_STORE_URL`) + `v3.18` before horizontal scaling (R-4).
4. Webhook `event_id` idempotency ledger (R-5).
5. Enable Supabase leaked-password protection on prod + staging; relocate `btree_gist` (R-9).
6. `vite@8` upgrade via `npx npm@10` (respect lockfile drift) (R-10).
7. Deploy-runbook gate: adding Cloudflare/any 2nd proxy **must** bump `trust proxy` + set `CLIENT_IP_HEADER` in the same change.
8. Add `get_advisors` (Supabase) + `npm audit` to CI so new advisories surface automatically.

---

## 7. Security Checklist for Future Development

**Auth & session**
- [ ] New login/verify path? Equalize timing (dummy `signInWithPassword`) and return identical errors — no enumeration.
- [ ] OTP verify calls pass the correct `expectedType`; never widen the shared `booking` type.
- [ ] Any signed token pins `alg` and a `purpose`/`typ` claim; compare with `timingSafeEqual` + length guard.

**Authorization / IDOR**
- [ ] Every by-id read/update/delete on `supabaseAdmin` carries an ownership filter (`.eq('host_id'|'guest_id', req.user.id)`) — service role bypasses RLS.
- [ ] `host_id`/`guest_id`/`plan`/`role`/`is_host`/`commission`/`balance`/`is_verified` are NEVER taken from the request body.
- [ ] Admin routes gated by `requireAdmin(<specific perm>)`.

**Payments**
- [ ] Amount re-fetched from Razorpay and bound to the server-computed snapshot; never trust body amounts.
- [ ] Signatures verified server-side over the raw body; capture paths idempotent (unique payment/order id).
- [ ] Money-affecting config (fee, GST, commission) snapshotted at charge time.

**Input / injection / output**
- [ ] User input into a Supabase `.or()/.ilike()/.filter()` goes through `sanitizeLikeTerm`; UUIDs validated.
- [ ] User free-text into an external API (WhatsApp/email) is control-char stripped; URLs `encodeURIComponent`d.
- [ ] Uploads magic-byte sniffed against an allowlist (no HTML/SVG), server-generated filename, `contentDisposition: attachment`.

**Config / deps**
- [ ] New body route has an explicit `limit`.
- [ ] `npm audit` clean (or dev-only + documented) before merge; bump majors via `npx npm@10`.
- [ ] New table: RLS enabled; access via service role in app code (or explicit policy if client-facing).
- [ ] No secrets in code; new secret added to `validateEnv` as CRITICAL if prod-required.

---

## 8. Methodology & OWASP Top 10 (2021) Mapping

| Category | Status |
|---|---|
| A01 Broken Access Control | Strong — code-enforced ownership; RLS deny-by-default. |
| A02 Cryptographic Failures | Strong — bcrypt OTP, HMAC-SHA256 signatures, `timingSafeEqual`. |
| A03 Injection | Strong — parameterized Supabase, sanitizers; CRLF hardened this pass. |
| A04 Insecure Design | Improved — grant channel binding (FIX-1). |
| A05 Security Misconfiguration | Strong — Helmet CSP/HSTS, strict CORS; body limits added this pass. |
| A06 Vulnerable Components | Improved — nodemailer/js-yaml/undici fixed; vite dev-only remaining. |
| A07 Identification & Auth | Strong — OTP lockouts, admin 2FA, alg-pinned JWT. |
| A08 Software & Data Integrity | Strong — webhook signature over raw body, idempotent capture. |
| A09 Logging & Monitoring | Good — secret redaction, generic prod errors, `/metrics`. |
| A10 SSRF | N/A — no server-side fetch of user-supplied URLs. |
