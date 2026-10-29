# Unified Identity — Phase 4 (FUTURE / OPTIONAL): Drop `role` + Account Linking

> **Status:** Deferred indefinitely. As of 2026-06-24 the founder does not plan to do this. Documented so it can be executed cold if priorities change. **The unified model is fully functional WITHOUT this phase** — Phase 4 is cleanup, not capability.

## Context (what already shipped)

Phases 0–3 of the unified-identity refactor are merged + live (see
[`2026-06-24-unified-identity-capabilities-design.md`](../specs/2026-06-24-unified-identity-capabilities-design.md) and
[`2026-06-24-unified-identity-capabilities.md`](2026-06-24-unified-identity-capabilities.md)):

- **Phase 0** — `profiles.is_host` (v3.34) + a bidirectional `role`↔`is_host` trigger (`sync_host_role` / `trg_sync_host_role`). `role` is now an **auto-mirrored compatibility shim**.
- **Phase 1** — `requireHost` (server) + `isHost()` (client) read `is_host` (role fallback). Persisted `mode` + `ModeSwitch`.
- **Phase 2a/2b** — guest space open to hosts; `POST /auth/become-host`; mode-aware navbar.
- **Phase 3** — login by email **or** phone behind the `unified_login` flag (v3.35, ships OFF).

Because `role` stays perfectly mirrored from `is_host` by the DB trigger, **leaving the shim in place forever is harmless**. The only reasons to do Phase 4 are aesthetic/maintenance (one source of truth) — there is no functional or security driver.

## Why it's deliberately deferred

Phase 4 drops a **load-bearing column from a live, money-handling database**. If any consumer still reads `role` after the drop, it breaks in production (auth guards, admin filters, RLS). The risk/reward is poor while the shim works flawlessly. Do it ONLY after a long soak and a complete audit.

## Prerequisites (do not start Phase 4 until ALL are true)

1. Phases 0–3 have been live in prod for a meaningful soak (suggest ≥ 1 month) with no `is_host`/`role` drift incidents.
2. `unified_login` has been enabled in prod and soaked (so the phone-login paths are exercised under the new model).
3. A point-in-time DB backup / PITR window is confirmed before the column drop.
4. The role-reference audit (Part A) returns a **known, complete** list and every item is migrated (Part B).

---

## Part A — `role` reference audit (find EVERY consumer)

Run these and resolve every hit. The known surfaces as of 2026-06-24:

```bash
# Server: every read/write of profiles.role
grep -rEn "\.role\b|'role'|\"role\"|role *:" server/ --include=*.js | grep -vi "test"
# Client
grep -rEn "\.role\b|user\?\.role|=== *'host'|=== *'guest'" client/src
# SQL / RLS policies referencing role
grep -rEn "\brole\b" server/migrations server/config/schema.sql
```

Known consumers to migrate (confirm none remain that still need `role`):
- `server/middleware/authMiddleware.js` — `requireHost` (already reads `is_host`; remove the `role` fallback).
- `server/controllers/authController.js` — `serializeProfile` (stop returning `role`), `login`/`loginWithPhone`/`verifyOtpLogin`/`googleCallback` role checks, `upsertProfile` (writes `role`), `findOrCreateProfileByPhone` (writes `role`), `becomeHost`.
- `server/controllers/vendorOnboardingController.js` — `createVendorAccount` inserts `role:'host'` → switch to `is_host:true`.
- Admin: `server/controllers/adminController.js` + any provider/user list filters keyed on `role`.
- `server/config/featureRegistry.js` scope values are unrelated (leave).
- Client: `client/src/utils/roleRoutes.js` `isHost` (drop the role fallback), `Navbar.jsx`, `Dashboard.jsx`, `Login.jsx`, `CustomerProfile.jsx`, `BeASloth.jsx`, `ReviewPage.jsx`, `components/booking/ReviewModal.jsx`, admin pages (`AdminUsers/AdminPlans/AdminBadges`).
- **RLS:** confirm via the Supabase dashboard / `pg_policies` whether any policy references `role`. Most sensitive tables are service-role-only (server bypasses RLS), so the dependency is expected to be app-layer — **verify, don't assume**:
  ```sql
  SELECT schemaname, tablename, policyname, qual, with_check
  FROM pg_policies WHERE qual ILIKE '%role%' OR with_check ILIKE '%role%';
  ```
- **`superadmin`:** the admin path is separate (`bas_admin` session). `role='superadmin'` currently rides the same column. Before dropping `role`, move admin detection to its own signal (e.g. a dedicated `is_admin`/staff table lookup) — DO NOT lose superadmin identification.

Output of Part A = a checklist. Phase 4 cannot proceed until every item is migrated to `is_host` (and superadmin re-homed).

---

## Part B — migrate consumers off `role` (incremental, TDD)

For each audited consumer, replace `role`-based logic with `is_host` (+ the re-homed admin signal), one small PR at a time, each behavior-preserving (the trigger keeps `role` correct meanwhile, so these can ship gradually). Update tests to assert `is_host` behavior. After all consumers are migrated and soaked, `role` is read by nothing.

Verification before Part C:
```bash
grep -rEn "\.role\b|'role'|\"role\"" server/ client/src --include=*.js --include=*.jsx | grep -vi test
# Expect: zero functional reads of profiles.role (only the column definition / migrations remain).
```

---

## Part C — drop `role` + the mirror trigger (the irreversible step)

Only after Parts A+B are complete, soaked, and a backup is confirmed. New migration (next free version, e.g. `v3.NN`):

```sql
-- vX Drop the role compatibility shim (unified identity — Phase 4).
-- Prerequisite: NOTHING reads profiles.role anymore (audit complete + soaked).
DROP TRIGGER IF EXISTS trg_sync_host_role ON profiles;
DROP FUNCTION IF EXISTS sync_host_role();
ALTER TABLE profiles DROP COLUMN IF EXISTS role;
```

Apply to **staging first**, run the full app against it, then prod. Keep the PITR window.

**Rollback (if a missed consumer surfaces):** re-add the column + trigger and backfill from `is_host`:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text;
UPDATE profiles SET role = CASE WHEN is_host THEN 'host' ELSE 'guest' END WHERE role IS NULL;
-- (superadmin rows: restore from the re-homed admin signal)
-- then re-create sync_host_role() + trg_sync_host_role from v3.34.
```

---

## Part D — optional "link accounts" flow (legacy duplicates)

Pre-existing humans may have **two rows** — a phone→guest account and an email→host account created before unification. These are NOT auto-merged (too risky). Optional opt-in flow, only if there's real demand:

1. Logged-in user requests "link my other account" and proves ownership of the second identifier (OTP to the other phone / verification link to the other email).
2. Choose a surviving `profiles.id` (keep the host row if one exists — it owns services/availability).
3. Re-point the loser's foreign keys to the survivor: `bookings.guest_id`, `bookings.host_id`, reviews, `username_history`, ledger refs, payouts, etc. (enumerate FKs to `profiles.id` first).
4. Set `is_host = true` on the survivor if either row hosted; merge `phone`/`email` onto it.
5. Delete (or soft-disable) the loser row + its auth user.

This is a data-surgery feature with its own spec/plan when/if pursued. Never run it as a bulk automated merge — only user-initiated, ownership-verified, one pair at a time.

---

## Summary

Phase 4 is the only remaining piece of the unified-identity refactor, and it is **optional cleanup**. The shipped model (0–3) already gives one account that books + hosts with email-or-phone login. If Phase 4 never happens, the `role` mirror simply lives on — correct, invisible, and harmless.
