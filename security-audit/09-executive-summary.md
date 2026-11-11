# 09 — Executive Summary

**Meeticulous security audit — 2026-11-11.** Full codebase (React client + Express server) + live read-only Supabase introspection + dependency/secret scanning, with five parallel domain deep-dives. No production data was modified; nothing destructive was run.

## Overall posture: **Strong.**
This is a security-mature codebase. The vulnerability classes that sink most SaaS platforms are **already closed**: pricing is server-authoritative, payment webhooks are HMAC-verified and idempotent, OTPs are bcrypt-hashed and rate-limited, admin auth is isolated with **mandatory 2FA**, object ownership is enforced on every endpoint (no IDOR found), there is **no SSRF anywhere**, uploads are magic-byte-validated into locked-down buckets, RLS is fail-closed, and **no secrets are committed**.

**Zero CRITICAL or HIGH application-logic vulnerabilities were found.** The one CRITICAL is a dependency CVE; the remaining findings are MEDIUM/LOW hardening items.

### The numbers
25 findings: **1 CRITICAL** (dependency), **3 HIGH** (dependencies), **6 MEDIUM**, **15 LOW/INFO**. The CRITICAL + all three HIGHs are `npm audit` CVEs with fixes available — patchable in an afternoon.

---

## The 8 questions you asked

**1. How can someone hack this website?**
Realistically, they can't via the application logic we reviewed — auth, payments, authorization, and webhooks are solid. The **one practical lever is the `proxy-addr` CRITICAL CVE (F-07)**: it lets an attacker spoof their client IP, which would bypass the rate limits and IP bans that defend every brute-force/abuse surface. Patch it first. Beyond that, residual risk is a compromised/rogue **admin** account staying active longer than it should (no session revocation, F-02) — but getting in as admin requires defeating mandatory 2FA.

**2. How can someone spam or abuse it?**
Abuse defenses are comprehensive (per-IP **and** per-contact limiters, OTP caps, auto-ban). Two gaps: an **unbounded `explore_clicks` insert** (F-04) can flood a table, and `/prerender/*` has no limiter (F-19, origin DB load). Both are low-impact and simple to close — **but all of this keys on the client IP, so F-07 is the real spam enabler.** Fix F-07, then F-04/F-19.

**3. What data could they steal?**
Very little across the trust boundary. The one genuine leak: **booking lists return the full counterparty profile** (F-01) — a host (or guest) sees the other party's `date_of_birth`, email, and internal flags (`is_banned`, session-revocation timestamps) because a join uses `profiles(*)`. No KYC, payment, or password data is exposed; private documents sit behind signed URLs + RBAC; public pages leak no PII. Fix F-01 to close the one cross-user PII path.

**4. What financial damage could they cause?**
Essentially none through the app. Pricing is computed server-side and snapshotted; payment signatures and amounts are re-verified against Razorpay; a cheap order cannot activate an expensive plan; refunds/disputes reverse payouts; everything is idempotent. The residual *financial-adjacent* risk is governance: the **Razorpay secret and the CRM mass-send / payments kill-switches are reachable by a grantable permission** (F-03) rather than super-admin-only — not exploitable today, but one mis-scoped role grant away.

**5. What is currently protecting us?**
Layered rate limiting (IP + contact), ipGuard auto-ban, helmet/security headers, HMAC-verified idempotent payment webhooks, server-authoritative pricing, bcrypt OTP with lockouts, isolated admin auth with mandatory TOTP, per-controller ownership checks, AES-256-GCM-encrypted OAuth tokens, RLS fail-closed on 150+ tables, service-role isolation, OAuth-state CSRF + open-redirect allowlists, and DOMPurify/escaped-React XSS hygiene. This is well above the norm for a company at this stage.

**6. What is missing?**
(a) **Patched dependencies** — `proxy-addr`, `axios`, `nodemailer`, `body-parser`, `qs`, `react-router`, `zod`. (b) **Data minimization** on the booking-list join. (c) **Admin blast-radius controls** — session revocation + super-gating the money/flag controls. (d) **An *enforced* CSP** on the browser app (today it's Report-Only, so it blocks nothing). (e) **Enable Supabase leaked-password protection.**

**7. What should we fix first?**
In order: **(P0)** patch `proxy-addr` + the request-path CVEs and re-verify `trust proxy`; **(P1)** stop the booking-list PII leak, add admin session revocation, super-gate payments/flags/gateway-secret, enable leaked-password protection; **(P2)** rate-limit the unbounded public writes and harden token comparisons; **(P3)** enforce the SPA CSP and update client deps. Full task breakdown with effort/acceptance in `06`.

**8. How do we verify the fixes work?**
`07` defines a security regression suite (SEC-* tests + standing invariants INV-1…15) that both proves each fix and fails CI on regression — e.g. "a forged X-Forwarded-For can't change the rate-limit bucket", "booking lists carry no counterparty DOB/internal flags", "a deactivated admin's token is rejected on the next request", "a signature-valid payment with a mismatched amount is refused". Add `npm audit --audit-level=high` to CI so dependency drift can't silently return.

---

## Bottom line
Nothing here warrants an emergency takedown. **Patch the dependency CVEs this week** (the `proxy-addr` IP-spoof is the one that matters), **close the booking-list PII leak**, and **tighten admin containment** — and the platform moves from "strong" to "hard target." The deliverables (`01`–`08`) contain the architecture map, every finding with `file:line`, the API inventory, the DB audit, the ranked risk register, the prioritized roadmap, the test plan, and the production checklist.

*No fixes have been applied — this is the audit. Awaiting approval to proceed with the `06` roadmap in priority order.*
