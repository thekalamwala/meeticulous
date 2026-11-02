# Account Role Model — Guest/Host Separation & Authz Hole Fix

**Date:** 2026-06-23
**Branch:** `fix/host-authz-hole`
**Status:** Approved design → planning

## Problem

A logged-in **guest** can act as a **host** without ever signing up as one. Two layers:

1. **Server authz hole (root cause).** `protect` ([server/middleware/authMiddleware.js](../../../server/middleware/authMiddleware.js)) verifies the JWT and attaches only `{ id, email }` — it never loads or checks `role`. Every `/api/host/*` and protected `/api/services` route uses `protect` alone, so a guest's normal token already works on vendor APIs (create services, set availability, edit host profile, etc.).
2. **Client-trusted role (cosmetic).** The app gates host UI on `user.role` read from `localStorage`. Setting it to `host` unlocks the vendor dashboard until the next `getMe()` reverts it — but the unlocked UI's API calls succeed because of layer 1.

Live prod audit (`PROD_PROJECT_REF`, 2026-06-23): 17 hosts, 4 guests, **0** services or bookings owned by a non-host, 0 null roles. The hole exists but **has not been exploited**. Low blast radius → safe to fix additively.

### Already in place (not part of this work)
- Email separation: [registerVendor](../../../server/controllers/authController.js) rejects guest emails; [registerUser](../../../server/controllers/authController.js) rejects host emails; Google vendor flow rejects customer emails.
- Phone uniqueness: `profiles_phone_unique_idx` (v3.1) makes any real phone globally unique → already cannot sit on two accounts.
- `ensureGuestProfile` returns an existing profile as-is (never clobbers role); `upsertProfile` only runs for freshly-created auth users → booking-as-guest can't downgrade a host.

## Decisions (from brainstorming)

1. **Scope:** Full fix — server-side role enforcement + client hardening + cross-role messaging cleanup.
2. **Account model:** **Unified + explicit opt-in.** One account can hold both capabilities (book *and* host), like Airbnb/Fiverr. Same email/phone is allowed. The bug is killed by making the guest→host switch a deliberate, **server-enforced** action — never a silent flip.
3. **Opt-in mechanics:** A logged-in guest clicks "Become a host" (with confirm); `role` flips to `host` immediately; the existing host onboarding then drives WhatsApp verify → profile → first service → plan. "Verified" is satisfied by the onboarding WhatsApp step.

Consequence: `role='host'` is a **superset** — a host can also book. The single `role` enum is kept (no capability-flag refactor).

## Architecture (Approach 1 — surgical guard + activate endpoint)

### A. Server — role guard
- Add `requireHost` to [server/middleware/authMiddleware.js](../../../server/middleware/authMiddleware.js): reads `profiles.role` for `req.user.id` (single indexed PK select), returns `403 { message: 'Host account required' }` if role ∉ {`host`, `superadmin`}.
- `protect` attaches `req.user.role` once (so `attachPlan` / `requireHost` don't double-read). `requireHost` uses the attached role if present, else reads.
- Apply `requireHost` **only** to host-capability routes:

| File | Routes guarded |
|---|---|
| `hostRoutes.js` | `PUT /profile`, `PUT /categories`, `PUT /username`, `POST /services`, `PUT /services/:id`, `DELETE /services/:id`, `PUT /availability` |
| `serviceRoutes.js` | `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/duplicate`, `PUT /:id/toggle` |
| `productRoutes.js` | `POST /`, `PUT /:id`, `DELETE /:id` |
| `feedbackRoutes.js` | `POST /` (vendor feedback) |
| `categoryRoutes.js` | `POST /suggest` |
| `whatsappRoutes.js` | `POST /send-otp`, `POST /verify-otp` (host WhatsApp verify) |

- **Left role-agnostic (must keep working for guests; ownership-checked, not role-checked):** booking create/cancel/complete/reschedule, reviews, `PUT /auth/me`, `set-password`, all payment + guest flows.

> Note: middleware **order** matters — `requireHost` runs after `protect`, and before `attachPlan`/`checkServiceLimit`/`requireFeature` (cheaper rejection first, and plan/limit logic should only run for hosts).

### B. Server — opt-in endpoint
- `POST /api/host/activate` (`protect`, **not** `requireHost`):
  - role `host`/`superadmin` → idempotent `200` with current serialized profile.
  - role `guest` → set `role='host'`; set onboarding markers so [ProtectedRoute](../../../client/src/components/common/ProtectedRoute.jsx) routes them through remaining steps:
    - `onboarding_slug` = fresh slug (reuse the onboarding slug generator).
    - `onboarding_step_completed` = `2` if `password_set` is true (skip identity+password), else the step that collects a password — confirm exact index against the existing flow during implementation.
  - Returns fresh serialized profile (client re-`getMe()`s anyway).
- Wire in [hostRoutes.js](../../../server/routes/hostRoutes.js) (or authRoutes — pick host since it's a host action) + controller (`hostController` or `authController`).

### C. Server — registration message reconcile
- In [registerUser](../../../server/controllers/authController.js) and [registerVendor](../../../server/controllers/authController.js), replace the cross-role 409 copy ("Hosts and users must use separate email addresses." / "registered as a user account") with a single generic message: **"An account with this email already exists. Please log in."** (Unified model: one account per email; the in-app path to hosting is login → Become a host.)
- Keep the existing-account *block* itself (auth email uniqueness still holds); only the messaging/intent changes.

### D. Client
- "Become a host" CTA where a logged-in guest can see it: guest [Dashboard](../../../client/src/pages/Dashboard.jsx) view (the existing "Want to offer services?" area) and `/become-a-host` when already logged in.
- CTA → `activate()` API → on success re-`getMe()` and update AuthContext → `role==='host'` → ProtectedRoute drives onboarding.
- New API fn in [client/src/services/api.js](../../../client/src/services/api.js): `activateHost = () => API.post('/host/activate')`.
- AuthContext: add an `activateHost` helper that calls the API then refreshes the user.
- localStorage `role` stays cosmetic. No need to "secure" it — a faked `role='host'` now powers nothing (every host API 403s; `getMe` reverts it). Defense-in-depth only.

### E. Data / migration
- **None.** Live data clean. No role backfill, no schema change. (Explicitly skip a role-transition trigger — YAGNI.)

### F. Testing
- **Unit** (`server/tests/unit/`):
  - `requireHost`: guest→403, host→200, superadmin→200, missing profile→403/401.
  - `activateHost`: guest→role becomes host + onboarding markers set; host→idempotent 200; unauthenticated→401.
  - registration messaging: existing email returns the generic message (no "separate addresses" text).
- **Integration** (`server/tests/integration/`): a guest token is rejected (403) on a representative guarded route (`POST /api/services`); a host token passes.
- **Regression:** guest can still `POST /api/bookings`, cancel/complete own booking, review, `PUT /auth/me`.
- Run full suites: `cd server && npm test`, `cd client && npm test`. Both must stay green.

### G. Rollout
- Additive. Deploy **server first** (guard + activate), then client (CTA). Until the client ships, guests simply can't reach host APIs (intended).
- **No feature flag on the guard** — flag-off would reopen the hole. The "Become a host" UI may sit behind a flag if desired (optional).

## Out of scope
- Capability-flag refactor (`is_host`/`is_guest`).
- BUG-01 booking ownership checks (separate issue; those routes stay role-agnostic here).
- "Stop being a host" / host→guest downgrade.
- Forbidding a host from booking with their host identity (allowed under the unified model).

## Risk summary
Low. Surgical middleware on a classified route list; shared routes untouched; no DB change; clean live data; full test coverage incl. guest regression. Main risk is **mis-classifying a route** as host-only and breaking a guest path — mitigated by the explicit table above and the regression tests.
