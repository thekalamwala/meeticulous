# 07 — Security Testing & Verification Plan

Regression tests to (a) prove each fix and (b) fail CI if a future change re-opens the hole. Stack: Jest (server, `server/tests/`) + Vitest (client). Where a test needs live Razorpay/Supabase, mock as the existing suites do (`razorpayConfigFallback.test.js`, `effectiveSchedule.test.js` patterns).

## A. Tests that pin the fixes in `06`

| ID | Pins | What it asserts |
|---|---|---|
| **SEC-DATA-1** | F-01 | `GET /api/bookings/host` and `/guest` responses: embedded counterparty object has **no** `date_of_birth`, `is_banned`, `sessions_valid_after`, `failed_login_count`, `login_locked_until`, `google_id`, `linkedin_sub`; phone still redacted per plan. |
| **SEC-ADMIN-2** | F-02 | Mint admin token → set `is_active=false` (or bump `token_version`) → next `/api/admin/*` request = 401. |
| **SEC-ADMIN-3** | F-03 | Admin token holding `settings.manage` but not super → 403 on `PATCH /admin/features/:key`, `PUT /admin/settings/payment/razorpay`. Super token → 200. |
| **SEC-RL-1** | F-07 | With `trust proxy` configured, a forged `X-Forwarded-For` does **not** change the rate-limit key; limiter trips on real IP. |
| **SEC-RL-2** | F-04/F-19/F-21 | `POST /api/explore/click` 429s after its per-route cap; opening OTP honours per-contact cap across rotating IPs. |
| **SEC-TOK-1** | F-11/F-12/F-22 | Token/secret comparisons reject on length-mismatch without throwing; no endpoint accepts a secret via query string. |
| **SEC-ADMIN-4** | F-15/F-14 | Admin login: unknown-user and wrong-password return identical status+shape (and comparable timing); `/admin/upload/image` 403s for a role lacking `cms.manage`. |
| **SEC-CSP-1** | F-05 | Deployed SPA response carries an **enforcing** `Content-Security-Policy` (not Report-Only) with no `script-src 'unsafe-inline'`. (Smoke/E2E or header assertion.) |
| **SEC-DEP-1** | F-07/08/09/10 | CI `npm audit --audit-level=high` passes for server + client runtime deps. |

## B. Standing invariants (the prompt's required checklist) — tests that must always hold

| ID | Invariant |
|---|---|
| INV-1 | Unauthenticated request to any `protect`/`host`/`admin` route → 401/403 (no data). |
| INV-2 | User A cannot read/modify User B's booking/service/product/invoice/review/KYC (pass B's id → 403/404). *(Already largely covered by the ownership checks; add explicit cases.)* |
| INV-3 | A host cannot reach another host's resources; a guest cannot reach host-only ops (`requireHost`). |
| INV-4 | A non-admin JWT (vendor/guest) is rejected by every `/api/admin*` route (`type!=='admin'`). |
| INV-5 | OTP: >3 wrong attempts locks out 15 min; >3 sends/hr per contact throttles; a `password_reset` code is rejected on the booking/login verifier. |
| INV-6 | Login: per-account lockout after 5 fails; unknown vs wrong-password are indistinguishable (status+timing). |
| INV-7 | Payment webhook with an invalid/missing signature → 400, **no** state change; a replayed `event_id` is a no-op. |
| INV-8 | `verify`/`verify-subscription`/`verify-product` reject a signature-valid payment whose order amount/notes don't match the expected booking/plan/product. |
| INV-9 | Duplicate payment (same `razorpay_payment_id`/`order_id`) does not double-activate / double-insert (idempotent). |
| INV-10 | Upload: a non-image (SVG/HTML/PDF-as-image/oversize) is rejected; stored key is server-generated (no user filename). |
| INV-11 | A private-bucket object (KYC/product/customer-file) is reachable only via a server-minted signed URL after an ownership/permission check. |
| INV-12 | Plan limits (services/products/bookings) cannot be exceeded by a free host; limits read from `subscription_plans.limits` (not hardcoded). |
| INV-13 | No authenticated write accepts `role`/`plan`/`is_banned`/`vendor_amount`/`commission` from the body (mass-assignment). |
| INV-14 | Every public write endpoint has a per-route limiter beyond the global 100/min. |
| INV-15 | No public read returns another user's PII (email/phone/DOB/internal flags) beyond the documented allowlist. |

## C. Test procedure per fix
1. Write the failing test against current code (red) — proves the finding.
2. Apply the `06` fix.
3. Test passes (green); run the full suite (`cd server && npm test`, `cd client && npm test`) + `cd client && npm run build`.
4. For payment/webhook/CSP changes, add a **manual** smoke: real booking in Razorpay **test mode**, OTP email receipt, admin login + 2FA, checkout under the enforced CSP.
5. Record result in `02`/the PR; mark the finding fixed only when the test is green **and** (for DB-dependent items) the migration is applied to both DBs.

## D. Non-destructive testing rules (honoured in this audit)
- No writes to prod data; DB introspection was read-only catalog/advisor queries.
- No load/DoS tests against prod; rate-limit tests run against a local/mocked app.
- Secrets never printed; exploit validation for anything requiring real credentials is documented, not executed against prod.
- Payment flows validated against Razorpay **test** keys only.

## E. Suggested test file layout
```
server/tests/security/
  bookingsDataExposure.test.js      # SEC-DATA-1, INV-15
  adminSessionRevocation.test.js    # SEC-ADMIN-2
  adminSuperGating.test.js          # SEC-ADMIN-3
  adminLoginEnumeration.test.js     # SEC-ADMIN-4
  rateLimitKeying.test.js           # SEC-RL-1/2, INV-14
  tokenCompare.test.js              # SEC-TOK-1
  paymentWebhookIntegrity.test.js   # INV-7/8/9  (extend existing payment tests)
  authInvariants.test.js            # INV-5/6
  uploadValidation.test.js          # INV-10/11
client/src/__tests__/csp.test.*      # SEC-CSP-1 (or an E2E header check)
```
