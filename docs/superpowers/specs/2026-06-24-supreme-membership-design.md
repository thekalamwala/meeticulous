# Supreme Membership — Design Spec

- **Date:** 2026-06-24
- **Status:** Approved (brainstorm) → implementing
- **Branch:** `feat/supreme-membership`

## Goal

Add a fourth membership tier, **Supreme**, beyond Free/Creator/Professional. Supreme is:

1. **God-tier** — all plan features unlocked, unlimited limits (services / products / bookings), 0% commission. Replaces the holder's existing plan.
2. **Kill-switch-immune** — when an admin turns a feature kill-switch OFF platform-wide, Supreme holders still get the feature… **except** a hardcoded safety denylist (payments / auth / platform-freeze kills) that stays hard for everyone.
3. **Invisible** — never shown on the public pricing page, onboarding plan picker, or upgrade flow. Not purchasable.
4. **Admin-assigned only** — granted via the *existing* admin "Assign Plan to Host" flow (`POST /api/admin/plans/assign`). No new assignment mechanism.

## Locked decisions

| # | Decision |
|---|----------|
| Scope | Full god-tier (top plan; all features, unlimited caps, 0 commission; replaces existing plan) |
| Bypass | Bypass **all** kill-switches **except** a hardcoded `SAFETY_KEYS` denylist |
| Representation | **Approach A** — Supreme is a `subscription_plans` row + a generic `bypasses_kill_switches` plan capability column (not a magic `=== 'supreme'` string) |
| Hiding | Supreme row is `active = false`. That single property excludes it from the public pricing list (`publicPlans` filters `active !== false`) **and** from the 2–3 active-plans rule (`countActive` counts `active = true` only), while `getPlan('supreme')` still loads it (loads all plans regardless of `active`) so limits/commission resolve. No new `public` column needed. |
| Assignment | Reuse the existing `assignPlan` endpoint unchanged. The only client change is widening the admin assign dropdown so Supreme is selectable there (and nowhere else). Revoke = admin assigns a different plan via the same UI. |

## Why Approach A reuses the most

- `checkServiceLimit` / `checkProductLimit` / `checkBookingReceiveLimit` already short-circuit on `-1` (unlimited). Supreme's limits are all `-1` → **zero new limit code**.
- Payout/commission math already reads `commission_percentage` from the plan row. Supreme = `0` → works for free.
- `assignPlan` already sets `plan_expires_at = null` for free plans (Supreme `annual_price = 0`) → **never expires**, exactly what an admin comp wants.

The **only** genuinely new behaviour is the kill-switch bypass, applied at the two existing enforcement points.

## Data model — migration `server/migrations/v3.36_supreme_plan.sql`

> Migration number: origin/main already carries `v3.34_host_capability` and
> `v3.35_unified_login_flag` (the unified-identity line, PRs #156/#157), so this
> lands as **v3.36**. The unified-identity work added `profiles.is_host` but does
> not touch plans or kill-switches, so it's orthogonal to Supreme.

1. **Add capability column** to `subscription_plans`:
   `bypasses_kill_switches BOOLEAN NOT NULL DEFAULT false`.
2. **Seed the `supreme` row** (idempotent `ON CONFLICT (slug)`): `active = false`, all `limits = -1`, `commission_percentage = 0`, every `features` flag `true`, `annual_price/monthly_price = 0`, high `sort_order`, `bypasses_kill_switches = true`.
3. **Relax the `profiles.plan` CHECK** — currently `plan IN ('explorer','creator','professional')` ([v1.2.sql:8](../../../server/migrations/v1.2.sql), [v1.6_catchup.sql:21](../../../server/migrations/v1.6_catchup.sql)). New set: `('explorer','starter','creator','professional','supreme')` (also folds in the latent `'starter'` gap). The constraint is dropped by **discovering its real name** via a `DO` block (it was created inline, auto-named, so the name is not guaranteed) before re-adding.

## Server enforcement

### `server/config/featureRegistry.js`
Export `SAFETY_KEYS` — the hardcoded never-bypassable denylist:
```
['razorpay_payment', 'product_purchase', 'guest_login', 'guest_signup',
 'guest_otp', 'guest_booking', 'reschedule_fee']
```
Financial + auth + platform-freeze kills. (Most are customer-scope → the caller is the guest anyway, so they're moot to a Supreme host; listing them is belt-and-suspenders.)

### `server/middleware/requireFeature.js`
Only the **off-path** changes — zero added cost on the normal on-path:
```js
const enabled = await isFeatureEnabled(key);
if (enabled) return next();                       // common path, untouched
if (req.user?.id && !SAFETY_KEYS.includes(key)
    && await callerBypassesFlags(req)) return next();   // Supreme punch-through
return res.status(503)...                          // everyone else blocked
```
`callerBypassesFlags(req)`: reuse `req.vendorPlanData.bypasses_kill_switches` if `attachPlan` already ran on the route; else one cached lookup of `profiles.plan` → `planService.getPlan(resolveVendorPlan(...))` → `.bypasses_kill_switches`. Memoize the result on `req` so repeated gates in one request don't re-query. Fail-closed: any error → no bypass.

### `server/controllers/authController.js` — `serializeProfile`
Becomes **async** and adds two fields to the single payload shape returned by login/register/getMe/updateMe:
- `bypasses_flags` — `(await planService.getPlan(resolveVendorPlan(profile))).bypasses_kill_switches === true`
- `safety_keys` — the `SAFETY_KEYS` constant (so the client gate matches the server with zero drift)

All call sites get `await`. This reads the plan's capability column generically (no slug hardwiring) and avoids a separate endpoint.

## Client enforcement

### `client/src/context/FeatureContext.jsx`
`useFeature(key)` is redefined to combine the flag map with the caller's bypass capability. The consumer component sits inside both `FeatureProvider` and `AuthProvider` (provider *nesting* order is irrelevant for a consumer hook), so the hook reads both contexts:
```js
const base = isOn(key);                       // flag map, fail-open
if (base) return true;
if (user?.bypasses_flags && !(user?.safety_keys || []).includes(key)) return true;
return false;
```
`FeatureGate` is unchanged — it consumes `useFeature` and inherits the bypass. Any direct `useFeatures().isOn(key)` call sites are audited and migrated to `useFeature` where bypass should apply.

### `client/src/context/AuthContext.jsx`
Already stores the whole `/auth/me` user object → `bypasses_flags` + `safety_keys` ride along automatically. Verify no field whitelist strips them.

### `client/src/pages/admin/AdminPlans.jsx`
One-line widen of the assign dropdown filter ([AdminPlans.jsx:212](../../../client/src/pages/admin/AdminPlans.jsx)) from `plans.filter((p) => p.active)` to `plans.filter((p) => p.active || p.bypasses_kill_switches)` so Supreme is selectable in the assign control only. The plan-management table still lists it (admin `listPlans` returns all). A small "hidden / admin-only" hint on the Supreme row is a nice-to-have.

## Edge cases & non-goals

- **Bypass keys off the *caller's* plan.** A Supreme host punches through *their own* (vendor) feature gates. Customer-scope flags are invoked by guests (no plan) → no bypass → a Supreme host does **not** stay bookable during a platform-wide `guest_booking` freeze. Explicit, safer non-goal.
- **Granting Supreme to a paying subscriber**: `assignPlan` does not auto-cancel their Razorpay subscription. Operational note for admins; out of scope to auto-handle.
- **Audit**: assignment stamps `plan_updated_at` (existing). A dedicated "who granted Supreme" audit trail is **not** added, to stay faithful to "assign like right now." Flagged as a recommended security follow-up.
- **Fallback safety**: if the migration hasn't applied, `getPlan` returns the FALLBACK plan (no `bypasses_kill_switches`) → no bypass, starter limits. Degraded but safe.

## Testing

- **Unit — `requireFeature`**: Supreme bypasses an OFF non-safety flag ✓; OFF safety flag stays 503 even for Supreme ✓; non-Supreme gets 503 ✓; anonymous gets 503 ✓; ON flag never queries plan ✓.
- **Unit — `planService`**: `getPlan('supreme')` returns `bypasses_kill_switches: true`, limits `-1`, commission `0`.
- **Unit — `serializeProfile`**: emits `bypasses_flags` + `safety_keys`; non-Supreme → `false`.
- **Unit — client `useFeature`**: OFF flag + bypasser + non-safety → on; OFF flag + bypasser + safety key → off; non-bypasser → off.
- **Integration**: `assignPlan` accepts `plan_slug: 'supreme'`, sets `plan_expires_at = null`.

## Deploy

1. Apply `v3.36_supreme_plan.sql` via Supabase MCP to **both** DBs (Mumbai prod + Tokyo staging). **Gated on explicit go-ahead** — touches live prod.
2. `planService.clearCache()` + `featureFlags.clearCache()` are called on the relevant admin writes; a server restart also clears them.
3. Ship code (server + client). Code is safe to deploy before/after the migration thanks to the fallback.

## File-by-file change list

| File | Change |
|------|--------|
| `server/migrations/v3.36_supreme_plan.sql` | **new** — column + supreme row + CHECK relax |
| `server/config/featureRegistry.js` | export `SAFETY_KEYS` |
| `server/middleware/requireFeature.js` | off-path bypass + `callerBypassesFlags` helper |
| `server/controllers/authController.js` | `serializeProfile` async + `bypasses_flags`/`safety_keys`; `await` at call sites |
| `client/src/context/FeatureContext.jsx` | `useFeature` combines flag map + bypass capability |
| `client/src/pages/admin/AdminPlans.jsx` | widen assign dropdown filter to include Supreme |
| `server/tests/...`, `client/src/tests/...` | unit + integration coverage above |
