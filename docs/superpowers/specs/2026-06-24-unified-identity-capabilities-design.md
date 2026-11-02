# Unified Identity + Capabilities + Mode Switch — Design Spec

**Date:** 2026-06-24
**Status:** Approved design — pending implementation plan
**Author:** Architecture session (founder + Claude)
**Supersedes:** the separate-account direction of PR #151 (guest=phone / host=email). Replaces the reverted PR #154 patch.

---

## 1. Problem

A single human cannot be both a host and a guest under one login. The root cause is **two parallel identity systems** that were never unified, plus a **binary `role`** column that forces an either/or:

| | Guest | Host |
|---|---|---|
| Identifier | phone | email / Google |
| Auth path | phone OTP, phone+password (`/login-phone`, `/verify-otp-login`) | email+password (`/login`), Google OAuth (vendor auth) |
| Internal id | synthetic `pXXXX@users.meeticulous.app` | real email |
| `profiles.role` | `'guest'` | `'host'` |

Every feature layered on this split has been a patch: the binary `role`, the removed become-host flip, the two-way role wall (PR #151), and the reverted host-bookings view (PR #154). The disease is the split itself.

### Concrete failing case
A doctor signs up as a host (email + password). He wants to book a cricket turf as a customer with the **same** login. Today: booking technically works (the booking page is public; a logged-in host skips OTP and books under their own id), but he has **no UI to see/manage** that booking (the role wall bounces hosts out of `/user/*`), and every customer-facing login path rejects his host email. The experience reads as "I can't."

---

## 2. Goals / Non-Goals

### Goals
- One account per human; that account can **both** host and book.
- One login surface: sign in with email, Google, or phone — all resolve to the same account.
- Replace binary `role` with a **capability** (`is_host`) + a **UI mode switch** (Hosting ↔ Traveling).
- Reach the end-state via **safe, independently-shippable phases** on a live, money-handling system — never a big-bang on auth/RLS.
- The doctor case fully solved: one login, books in Traveling mode, manages services in Hosting mode.

### Non-Goals
- **No risky bulk auto-merge** of pre-existing duplicate accounts (a human who already has both a phone-guest row and an email-host row). Provide an **opt-in "link accounts"** flow instead (Phase 4, optional).
- No change to the admin/superadmin system (`bas_admin` session stays isolated).
- No change to payments, services, availability, or reviews data models beyond what the identity change requires.

---

## 3. Target model

### 3.1 Identity
- One `profiles` row per human, able to hold **both** `email` and `phone`.
- Login by email / Google / phone all resolve to the same row.
- Drop the rule "phone ⇒ guest, email ⇒ host." Identifier ≠ role.

### 3.2 Capabilities (replaces binary role)
- New column `profiles.is_host boolean NOT NULL DEFAULT false`.
- **Everyone is implicitly a guest** (can book). No `is_guest` column needed — guest is the universal baseline.
- `is_host = true` once host onboarding completes.
- `superadmin` stays orthogonal (separate admin auth; not expressed via `is_host`).
- **Compatibility shim:** keep `profiles.role`, auto-mirrored from `is_host` (`role = is_host ? 'host' : 'guest'`, `superadmin` left as-is), maintained by a DB trigger AND the app's profile writes, until every consumer is migrated off `role` (Phase 4). This is the key to a safe, incremental rollout.

### 3.3 Mode switch (UX)
- Navbar control toggles **Traveling ↔ Hosting**. "Hosting" only appears when `is_host`.
- `active_mode` persisted client-side (localStorage); URL space reflects it:
  - `/dashboard/*` = Hosting space
  - `/user/*` = Traveling space
- The two-way *identity* wall becomes **capability + mode**:
  - `/dashboard/*` requires `is_host` (else → "Become a host" CTA)
  - `/user/*` open to any logged-in user (a host in Traveling mode sees their own trips)
  - No automatic cross-bounce; switching is a deliberate user action.

### 3.4 "Become a host"
- A logged-in user (a guest) triggers "Become a host" → runs the **existing Google-first onboarding**, but it **attaches to the current account** (`is_host = true`, connect Google Calendar, choose plan, etc.) rather than creating a second row.
- Re-introduces the capability PR #151 removed, the correct way: additive on one identity, not a separate login.

### 3.5 Booking as a host (the doctor)
- Backend already resolves `guest_id = req.user.id` (`bookingController.createBooking`), so a logged-in host already books under their own id.
- After the wall relaxes (Phase 2), the doctor books in Traveling mode and sees it under `/user/my-bookings`; switches to Hosting to manage his own services. One login, two modes. (This is what the reverted #154 was reaching for — now done on the correct foundation.)

---

## 4. `role` dependency inventory (must be migrated before dropping `role`)

To be enumerated exactly in the plan; known surfaces today:
- **Server middleware:** `requireHost` (`middleware/authMiddleware.js`) — fail-closed host gate on `/api/host/*`, `/api/services`, etc.
- **Auth login paths:** `login-phone` + `verify-otp-login` reject `role !== 'guest'`; `googleCallback` rejects `role !== 'host'` for vendor flow.
- **Controllers:** any `req.user.role` / `profile.role` checks.
- **Client guards:** `HostRoute`, `GuestRoute`, `roleRoutes.isHost`, `hostPathToGuestPath`; `Navbar`, `Dashboard`, `Login`, `CustomerProfile`, `BecomeAHost`, etc.
- **Serialization:** `serializeProfile` returns `role` (keep returning it during shim phases; also return `is_host`).
- **Admin:** user/provider list filters by `role`.
- **RLS:** audit which policies (if any) reference `role`; most sensitive tables are service-role-only, so the dependency is expected to be mostly app-layer, not RLS — confirm during the plan.

Until Phase 4, all of the above keep working unchanged because `role` stays mirrored from `is_host`.

---

## 5. Phasing (each phase independently shippable, testable, reversible)

### Phase 0 — Data foundation (no behavior change)
- Migration: add `is_host` (+ optional `active_mode`), backfill `is_host = (role = 'host')`.
- DB trigger keeps `role` mirrored from `is_host` going forward.
- `serializeProfile` also returns `is_host`.
- **Ship.** Zero behavior change; pure additive.

### Phase 1 — Read capability (behavior identical)
- `requireHost` + client guards + controllers read `is_host` (equivalent to `role==='host'` via the mirror).
- Add the navbar **mode switch** UI (cosmetic until the wall relaxes; defaults to Traveling, Hosting shown only when `is_host`).
- **Ship.** Behavior identical; switch visible but inert on routing.

### Phase 2 — Relax the wall (the doctor flow goes live)
- `/user/*` open to logged-in hosts (Traveling mode). `/dashboard/*` gated by `is_host`.
- "Become a host" attaches Google-first onboarding to the **current** account.
- Re-add the host "My Bookings / Trips" view (the #154 intent) under Traveling mode.
- **Ship.** One account now hosts + books with a real mode switch.

### Phase 3 — Unify login/identity (riskiest — staging first)
- One account holds both email + phone. Login-by-either resolves to one row.
- New signups never create duplicate guest/host rows.
- Phone-guest synthetic-email scheme retired for new accounts (kept readable for legacy).
- **Ship after a full staging pass + auth test suite.**

### Phase 4 — Cleanup + legacy
- Migrate any remaining `role` consumers (incl. RLS) to `is_host`; **drop `role` + the mirror trigger**.
- Optional opt-in **"link accounts"** flow for pre-existing duplicate humans (verify ownership of both identifiers → merge). Never automatic.
- **Ship.** Clean end-state, single model.

Phases 0–2 already solve the founder's doctor problem on one login. Phases 3–4 complete the "once and for all."

---

## 6. Data migration

- `is_host` backfill: `UPDATE profiles SET is_host = (role = 'host')` (superadmin → `is_host=false`; admin capability is separate).
- Idempotent migration files; apply to **both** Supabase DBs (Mumbai prod + Tokyo staging) per project convention.
- No destructive change until Phase 4 (`role` drop), gated on the consumer inventory being fully migrated + verified.

---

## 7. Testing strategy

- **Per phase, TDD.** Each phase lands with its own server (Jest) + client (Vitest) tests.
- Phase 0: migration + `serializeProfile` includes `is_host`; trigger mirrors `role`.
- Phase 1: guards/middleware read `is_host`; mode-switch renders by capability.
- Phase 2: capability+mode routing (host can reach `/user/*`; non-host blocked from `/dashboard/*`; become-host flips `is_host` on the same row); host trips view.
- Phase 3: login-by-email-or-phone resolves to one account; no dup creation; full auth regression.
- Phase 4: no remaining `role` reads; link-flow ownership proof.
- Live deploy verification each phase (bundle/route checks + smoke), per project deploy-verify habit.

---

## 8. Rollback

- Phases 0–2: pure code/additive-schema → revert PR + redeploy (as done for #154).
- Phase 3: feature-flag the new login resolution; flip off without redeploy if regressions appear.
- Phase 4: only run the `role` drop once Phases 0–3 are stable in prod for a soak period.

---

## 9. Risks

- **Auth (Phase 3)** is the highest-risk change — gate behind tests, a feature flag, and a staging pass.
- **`role` mirror drift** — the trigger + app writes must both maintain it; add a test that asserts `role` always equals the `is_host` projection until Phase 4.
- **Legacy duplicates** — explicitly out of auto-scope; the link-flow is opt-in and ownership-verified.
- **Admin isolation** — confirm no `is_host`/`role` change touches the `bas_admin` path.

---

## 10. Open questions (resolve during planning)

1. Phase 3 login: is one shared password per account acceptable (email + phone share it), or keep Google-only for hosts + password for guests initially?
2. Default landing mode for a dual-capability user on login: last-used (persisted) vs. always Traveling.
3. Should "Become a host" require plan selection up front (current onboarding) or allow a free host shell first?
4. Exact RLS audit result for `role` references (confirms Phase 4 scope).
