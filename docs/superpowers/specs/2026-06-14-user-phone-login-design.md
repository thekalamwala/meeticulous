# User Phone Login — Design Spec

**Date:** 2026-06-14
**Status:** Approved design, pending implementation plan
**Author:** Meeticulous + Claude

## Summary

End-users log in with **phone + password**. The login is built on the
already-working booking-time OTP flow (`sendOtp`/`verifyOtp` +
`mintSessionForEmail`). If a user has no password set, OTP verification
bootstraps the account and prompts them to set one. Vendors and admins keep
their existing email-based login, unchanged.

## Goals

- Phone is the primary identifier for end-users (role `guest`).
- Login screen at `/login` = phone + password for users.
- "If no password set, ask them to set it" — via the existing OTP flow.
- Reuse the proven booking OTP infrastructure; no new OTP/notification code.
- No Twilio/Supabase-phone-auth dependency (keep custom OTP engine).
- Existing email-keyed auth (`protect`, sessions) stays intact.

## Non-Goals

- Replacing email auth for vendors/admins. **Vendors log in via email at
  `/login-as-vendor`; users log in via phone at `/login`.**
- Migrating Supabase Auth to its native phone provider.
- Backfilling historical phones at scale (current data: 0 profiles with phone).
  Existing-guest linking is handled at login time via dedup (below), not a batch
  migration.

## Identity Model

Supabase Auth is email-keyed; that does not change. Phone login resolves
**phone → profile → account email → session**:

- **Password path:** look up `profiles.phone`, resolve `profiles.email`, call
  `signInWithPassword(email, password)`.
- **OTP path:** verify phone OTP, find-or-create the profile by phone, then
  `mintSessionForEmail(profile.email)` to issue a real session without a
  password.

New phone-only accounts get a **synthetic auth email** `p<e164>@users.meeticulous.app`
(real phone stored on `profiles.phone`). Synthetic email is an internal auth
artifact only; the user never sees or types it.

### `password_set` semantics

Supabase exposes no reliable "has a user-chosen password" flag. Existing guest
profiles are created with a random throwaway password (`ensureGuestProfile`), so
"has a password in Supabase" is not the same as "the user knows their password."

Add `profiles.password_set boolean default false`. It is the honest signal:

- `false` → user has never chosen a password → password login is disallowed;
  route them through OTP and offer to set one.
- `true` → set by `setPassword`; password login is allowed.

## Flow

Single login screen at `/login`, mirroring the booking step UI.

1. User enters **phone + password** and submits.
2. `POST /auth/login-phone { phone, password }`:
   - Normalize phone. Look up `profiles` by phone.
   - Not found → `404 { message: "No account found for this number." }` with a
     hint to use OTP (OTP path will auto-create).
   - Found, `password_set = false` → `409 { needsPassword: true }`. Client
     switches to the OTP path.
   - Found, `password_set = true` → `signInWithPassword(email, password)`.
     Success → `serializeProfile(profile, session)`. Bad password → `401`.
3. **OTP path** (button "Log in with OTP" or auto after `needsPassword`):
   - `POST /auth/send-otp { phone }` — existing endpoint, unchanged.
   - User enters 6-digit code.
   - `POST /auth/verify-otp-login { phone, otp }`:
     - Verify OTP via `otpStore.verify` (same identifier rule as today).
     - `findOrCreateProfileByPhone(phone)` (see below).
     - `mintSessionForEmail(profile.email)`.
     - Return `serializeProfile(profile, session)` plus `password_set`.
   - Client `adoptSession({ token, refresh_token })`.
4. If `password_set = false` after OTP login → show **"Set a password for
   faster login next time"** (skippable):
   - `POST /auth/set-password { password }` (`protect`):
     - `supabaseAdmin.auth.admin.updateUserById(req.user.id, { password })`.
     - Set `profiles.password_set = true`.
5. Logged-in user lands on `/my-bookings`.

## `findOrCreateProfileByPhone(phone)`

Order matters to avoid duplicate accounts:

1. `profiles.phone == phone` → return it.
2. Else, look for a prior booking with `bookings.guest_phone == phone` that has a
   `guest_id`; if found, load that profile, set its `phone` (now that we own the
   unique index), return it. (Links existing email-guests to their phone.)
3. Else, create a new auth user with synthetic email `p<e164>@users.meeticulous.app`
   + random temp password, then a `profiles` row (`role: 'guest'`,
   `phone`, `password_set: false`). Mirrors `ensureGuestProfile`'s
   create-or-resolve resilience.

The `profiles_phone_unique_idx` (v3.1) guarantees one account per phone at the DB
level even under races.

## Data Model

Migration `server/migrations/v3.2_user_password_set.sql`:

```sql
-- v3.2 — Track whether a user has chosen their own password
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT false;
```

`serializeProfile` gains `phone` and `password_set` so the client can decide
whether to show the set-password step.

## API Contracts

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/login-phone` | public | `{ phone, password }` | profile+session, or `{needsPassword}` (409), or 401/404 |
| POST | `/auth/send-otp` | public | `{ phone }` | `{ message }` (existing) |
| POST | `/auth/verify-otp-login` | public | `{ phone, otp }` | profile+session+`password_set` |
| POST | `/auth/set-password` | `protect` | `{ password }` | `{ ok: true }` |

Rate limiting: all phone-login + OTP routes use the existing `authLimiter`.
Password rule: minimum 8 chars (matches current implicit expectation; enforced
server-side in `setPassword`).

## Client

- **`/login`** reworked to phone-first: phone + password fields, "Log in with
  OTP" affordance, OTP entry sub-step (reuse the booking OTP markup/pattern),
  optional set-password sub-step. Vendor link points to `/login-as-vendor`.
- **`api.js`**: `loginWithPhone`, `verifyOtpLogin`, `setPassword`.
- **`AuthContext`**: add `loginWithPhone`; reuse existing `adoptSession` for the
  OTP session, `updateUser` to reflect `password_set` after setting.

## Edge Cases

- **Phone belongs to a vendor/host profile:** `login-phone` and
  `verify-otp-login` only authenticate `role = 'guest'`. A phone matching a
  host profile returns `409 { message: "This number is registered as a vendor.
  Use vendor login." }`. (Vendors authenticate by email/Google only.)
- **Duplicate prevention:** `findOrCreateProfileByPhone` checks profile, then
  booking history, before creating; unique index is the backstop.
- **Synthetic-email collision:** deterministic from e164, so idempotent;
  create-or-resolve handles an already-existing auth user.
- **Forgot password:** the OTP path *is* the recovery path — verify OTP, then set
  a new password. No separate email reset needed for phone users.
- **OTP delivery:** unchanged — WhatsApp + email via the Notification Engine,
  whichever channels admin config enables.

## Security

- Passwords set via `admin.updateUserById`; never logged.
- `signInWithPassword` / `mintSessionForEmail` run on disposable anon clients
  (never on `supabaseAdmin`) — preserves the service-role poisoning guard.
- Role gate prevents a user-login flow from minting a session for a vendor/host
  account.
- `authLimiter` on every entry point; `otpStore` already enforces 3 attempts /
  3 sends per hour / 15-min lockout.

## Testing

- Unit (`server/tests/unit/`): `loginWithPhone` (success / bad password /
  needsPassword / not-found / vendor-phone), `verifyOtpLogin` (new account /
  existing-by-phone / existing-by-booking dedup / bad otp), `setPassword`
  (flips flag, min length).
- Existing OTP and email-login tests remain green (no behavior change to those
  paths).

## Rollout

1. Apply `v3.2` migration (live Supabase) — additive, safe.
2. Ship server + client together (phone login + email login coexist by role).
3. No data backfill required; existing guests are linked on first phone login.
