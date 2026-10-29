# Admin 2FA (TOTP) — Design

_Date: 2026-06-16 · Status: approved · Security hardening (follow-up to payment-security-audit)_

## Context

Admin staff authenticate against `admin_users` (separate bcrypt store) and receive
an isolated HS256 session JWT carrying role + permissions (`adminAuthService.jwtSign`,
`adminAuthController.adminLogin`). Today login is **single-factor**: username/email +
password. A stolen admin password = full control of payouts + ledger. This was the
biggest gap from the money-loss security audit.

This adds **TOTP second factor** (authenticator app — Google Authenticator / Authy).
TOTP chosen over WhatsApp/email OTP because it is delivery-independent (no reliance on
the currently-shaky AiSensy/SMTP channels), phishing-resistant, and the standard for
privileged accounts.

## Decisions (from brainstorming)

- **Method:** TOTP only (RFC 6238) via `otplib`. QR generated server-side via `qrcode`.
- **Scope:** ALL admin accounts (super / finance / ops / support).
- **Enforcement:** MANDATORY. An admin without 2FA cannot obtain a full session — they
  are forced to enroll on next login.
- **Recovery:** 8 single-use recovery codes (hashed), shown once at enrollment.
- **Break-glass (last super-admin loses phone + codes):** a SQL one-liner run in the
  Supabase SQL editor (the owner's familiar tool; requires DB access an attacker lacks)
  + a `server/scripts/reset-admin-2fa.js` alternative. Both documented step-by-step.

## Out of scope
WhatsApp/email 2FA fallback; per-device "remember this browser"; hardware keys/WebAuthn;
rate-limited per-account 2FA attempt analytics beyond the existing lockout.

## Schema — migration `v3.13_admin_2fa.sql`

Add to `admin_users` (all nullable / safe defaults; idempotent `ADD COLUMN IF NOT EXISTS`):
- `totp_secret text` — the TOTP shared secret, **encrypted at rest** via existing
  `utils/cryptoTokens.js` (AES-256-GCM). Null until enrolled.
- `totp_enabled boolean NOT NULL DEFAULT false` — true once enrollment confirmed.
- `totp_recovery_codes jsonb` — array of bcrypt-hashed one-time codes. Null until enrolled.
- `totp_enrolled_at timestamptz` — when enrollment completed.

No backfill. Existing admins have `totp_enabled=false` → forced to enroll on next login
(mandatory enforcement).

## Token model

Three token "types" (the `type` claim), all signed by the existing HS256 admin secret:
- `admin` — the real full session (8h). Issued ONLY after 2FA passes. `requireAdmin`
  middleware already requires `type === 'admin'`, so the two pending types below cannot
  access any protected route.
- `admin_2fa` — short-lived (5 min) pending token issued after a correct password when
  `totp_enabled=true`. Carries `sub` (admin id) only. Exchangeable at `/2fa-verify`.
- `admin_2fa_enroll` — short-lived (5 min) pending token issued after a correct password
  when `totp_enabled=false`. Authorizes the enrollment endpoints, then `/2fa-confirm`
  mints the full `admin` token.

`adminAuthService.jwtSign(payload, ttlSec?)` gains an optional TTL param (defaults to the
existing 8h `SESSION_TTL_SEC`) so pending tokens get a 5-min exp. `jwtVerify` is unchanged
(generic). A small `verifyPending(token, expectedType)` helper validates a pending token's
signature, expiry, and `type`.

## Server flows

### Login — `POST /api/admin-auth/login` (modified `adminLogin`)
Unchanged up to and including password verification + lockout + counter reset. THEN:
- If `staff.totp_enabled === true`: return `{ twofa_required: true, pending_token }`
  where `pending_token` is `jwtSign({ type:'admin_2fa', sub: staff.id }, 300)`.
  **No full token, no role/permissions returned.**
- Else (`totp_enabled` false/null): return `{ enroll_required: true, pending_token }`
  where `pending_token` is `jwtSign({ type:'admin_2fa_enroll', sub: staff.id }, 300)`.
- Never return the full `admin` token directly from login anymore.

### Enrollment setup — `POST /api/admin-auth/2fa-setup`
Auth: a valid `admin_2fa_enroll` pending token ONLY (the mandatory-enrollment path).
Re-enrollment by an already-enabled admin (switching authenticator app) is out of scope
this increment — use the break-glass reset, then enroll fresh. Body: none.
- Generate a TOTP secret (`authenticator.generateSecret()`).
- Build the otpauth URI (`authenticator.keyuri(staff.email, 'Meeticulous Admin', secret)`).
- Generate a QR data-URL from the URI (`qrcode.toDataURL`).
- Store the secret **encrypted** on the row in a STAGING column? No — to avoid a second
  column, store the encrypted secret immediately in `totp_secret` but keep
  `totp_enabled=false` until confirmed. A secret with `enabled=false` is never accepted
  at login, so this is safe.
- Return `{ qr_data_url, otpauth_uri, secret_shown_once }` (secret in base32 for manual
  entry). Do NOT return recovery codes yet (only after confirm).

### Enrollment confirm — `POST /api/admin-auth/2fa-confirm`
Auth: `admin_2fa_enroll` pending token. Body: `{ code }`.
- Load `totp_secret` (decrypt), verify `code` with `authenticator.verify({token, secret})`
  (otplib default ±1 step window). Invalid → 400 (no enable).
- On success: set `totp_enabled=true`, `totp_enrolled_at=now`; generate 8 recovery codes
  (random, e.g. 10-char base32), store them **bcrypt-hashed** in `totp_recovery_codes`,
  audit `admin.2fa.enrolled`.
- Mint and return the FULL `admin` token (same shape as the old login response:
  token/type/role/name/email/username/permissions) PLUS `recovery_codes` (plaintext,
  shown once). The admin is now logged in.

### 2FA verify — `POST /api/admin-auth/2fa-verify`
Auth: `admin_2fa` pending token. Body: `{ code }` (a 6-digit TOTP **or** a recovery code).
Rate-limited (`authLimiter`) + per-account lockout reusing `failed_attempts`/`locked_until`.
- Load staff by `sub`. If locked → 429.
- Try TOTP verify against decrypted `totp_secret`. If that fails, try recovery codes:
  bcrypt-compare `code` against each stored hash; on match, REMOVE that code from the
  array (single-use) and persist. Audit `admin.2fa.recovery_used`.
- Success: reset `failed_attempts`/`locked_until`, stamp `last_login_at`, audit
  `admin.2fa.success`, mint + return the full `admin` token (full login response shape).
- Failure: increment `failed_attempts`, lock after MAX_FAILED, audit `admin.2fa.failed`,
  401.

### Reset (break-glass)
- Primary (documented): SQL in Supabase SQL editor —
  `UPDATE admin_users SET totp_enabled=false, totp_secret=NULL, totp_recovery_codes=NULL,
   totp_enrolled_at=NULL WHERE username='<user>';` → next login re-enrolls.
- Alternative: `node server/scripts/reset-admin-2fa.js <username>` (idempotent, prints the
  cleared account). Runbook `docs/admin-2fa-runbook.md` covers both with exact steps.
- A super-admin resetting ANOTHER admin's 2FA via UI is **out of scope** for this
  increment (the SQL/script path covers the rare lockout case and avoids adding a
  UI-driven 2FA-bypass surface).

## Audit events
`admin.2fa.enrolled`, `admin.2fa.success`, `admin.2fa.failed`, `admin.2fa.recovery_used`,
`admin.2fa.reset` (script logs to console + audit if run with context). Reuse
`services/auditService`.

## Client (`client/src/`)
`AdminLogin.jsx` becomes a small state machine:
1. **password step** (existing form) → POST /login.
2. If response `enroll_required` → **enroll step**: POST /2fa-setup, show the QR image +
   manual secret, input for the 6-digit code → POST /2fa-confirm → on success store the
   returned full token (existing `bas_admin` storage) + show the recovery codes in a
   "save these" modal before entering the dashboard.
3. If response `twofa_required` → **code step**: input for 6-digit/recovery code → POST
   /2fa-verify → store full token, proceed.
The existing token storage / `AuthContext` admin handling is otherwise unchanged — the
full `admin` token has the same shape it has today.

## Security considerations
- Secret encrypted at rest (cryptoTokens). Never returned after enrollment (only the QR
  + base32 once, at setup).
- Pending tokens are short-lived (5 min), single-purpose (`type`), and cannot pass
  `requireAdmin` (which demands `type==='admin'`).
- Recovery codes hashed (bcrypt), single-use, removed on use.
- 2FA verify is rate-limited + locked out like the password step (reuses the same
  `failed_attempts`/`locked_until` columns).
- Full session JWT is issued ONLY after the second factor — there is no path to a
  `type:'admin'` token without 2FA.
- otplib default window is ±1 step (30s) to tolerate clock skew; no wider.

## Testing (TDD)
Server (Jest):
1. `jwtSign(payload, ttlSec)` honors a custom TTL; default unchanged.
2. login with `totp_enabled=true` returns `twofa_required` + a pending token, NOT a full
   token (assert no `permissions` in response).
3. login with `totp_enabled=false` returns `enroll_required` + enroll pending token.
4. `/2fa-setup` with a valid enroll token returns a QR + otpauth URI; stores an encrypted
   secret with `totp_enabled` still false.
5. `/2fa-confirm` with a correct TOTP enables 2FA, returns a full token + 8 recovery codes;
   wrong code → 400, stays disabled.
6. `/2fa-verify` with a correct TOTP returns a full `admin` token; wrong code increments
   failed_attempts; lockout after MAX_FAILED.
7. `/2fa-verify` with a valid recovery code succeeds and consumes it (second use of the
   same code fails).
8. a pending token cannot access a `requireAdmin` route (type guard).
9. otplib window: a code from one step ago verifies; a clearly-expired/garbage code fails.
Client (Vitest): AdminLogin renders the code step on `twofa_required`; the enroll step on
`enroll_required`; submits codes to the right endpoints (mocked api).

## Migration / rollout
- Apply `v3.13_admin_2fa.sql` to live Supabase.
- On next login every existing admin (the 4 seeded accounts) hits `enroll_required` and
  sets up their authenticator. Communicate this to staff before deploy.
- New dependency installs: `otplib`, `qrcode` (server). Regenerate server lockfile with the
  pinned npm if needed (server is Render, separate from the client npm-10 pin).

## Success criteria
- No `type:'admin'` token is ever issued without a passed second factor.
- A correct password alone cannot reach any admin endpoint.
- Lost-phone recovery works via a recovery code; total loss recoverable via the documented
  SQL/script reset.
- Server + client suites green; build clean.
