# Reserved Namespace System — Design Spec

**Date:** 2026-06-24
**Status:** Approved (design) → implementation
**Branch:** `feat/reserved-slugs`
**Scope decision:** Enforce + admin reservation + collision audit now. Premium = schema stub (architect, don't monetize).

---

## 1. Problem

Public host profiles are served at the **root path** `/:profileSlug` (`client/src/App.jsx`). Any username a host claims becomes a URL that shares the namespace with every application route. If a user claims `/pricing` today, the business can never launch a `/pricing` page tomorrow. The platform must always own its namespace.

A partial guard already exists (shipped, live):

- `server/utils/reservedUsernames.js` — a hardcoded 51-word `RESERVED` Set + `isReserved()` (lowercase+trim).
- `client/middleware.js` — a **separate** hand-maintained ~20-word `SKIP` set (Vercel edge 301 redirect).
- `username_history` table — global uniqueness authority (UNIQUE on `lower(username)`); `change_username` + `set_onboarding_username` RPCs.

### Gaps (audit findings)

1. **Two hand-maintained lists that already disagree** and drift from the route table. New routes (`/support`, `/sitemap*`, `/health`, `/feedback`, `/user`, `/review`) are not all covered → silently claimable.
2. **Two divergent format validators:** `usernameController` uses `^[a-z0-9]+(?:-[a-z0-9]+)*$` (3–30); `vendorOnboardingController.isValidSlug` uses `^[a-z0-9-]+$` (3–60, allows leading/trailing/double hyphens).
3. **Normalization is only `lowercase+trim`** — no Unicode NFKC, no invisible-character stripping, no separator collapsing. Confusable/zero-width bypasses are not handled at the comparison step.
4. **No prefix / business-namespace reservation.**
5. **No admin reservation mechanism, no premium concept.**
6. **Confirmed live bypass:** `authController.findOrCreateProfileByPhone` writes `user-${digits}` with **no reserved check** (observed in prod: `user-7904109359`, `user-919284399627`; staging: `user-8637758344`). RPCs also do not re-check (JS-layer only).

### Live collision audit (Phase 7, run 2026-06-24)

- **Prod (Mumbai `PROD_PROJECT_REF`):** 31 profiles, 27 hosts. **One hard collision: `demo`** (host, `source=onboarding`, claimed 2026-06-24) — `demo`/`/demo` is a classic reserved/future route. Plus 2 `user-<phone>` bypass artifacts.
- **Staging (Tokyo `STAGING_PROJECT_REF`):** 7 profiles, 3 hosts. Zero hard collisions. One `user-<phone>` artifact. `timewheel-team` is NOT a collision (exact slug ≠ reserved `team`).

Footprint is tiny → remediation is low-risk.

---

## 2. Principles

- **Platform always wins.** Routes + admin/premium reservations beat user claims.
- **One authoritative resolver**, consulted at every write point. No scattered arrays, no per-call-site logic.
- **Route protection guaranteed in version control** (cannot be deleted via a DB row).
- **Normalize before validate before reserve-check** — so `Admin`, `ＡＤＭＩＮ`, `ad‌min` (ZWNJ) all canonicalize to `admin` and hit the same `reserved_route` verdict.
- **Grandfather, never retro-break.** Enforcement applies to new claims/changes only. Existing `username_history` rows stay valid.
- **YAGNI:** build the premium *schema + admin grant/reclaim*, not a buy/sell flow.

---

## 3. Architecture — one resolver, three layers (Hybrid)

`server/services/reservedSlugService.js` is the single authority. `checkAvailability(raw, { selfUserId })` → `{ ok, reason, normalized, layer }`, where `reason ∈ { format, reserved_route, reserved_admin, reserved_premium, taken, ok }`.

It unions three layers:

| Layer | Source | Authority for | Mutable at runtime? |
|---|---|---|---|
| **L1 Static** | `server/config/reservedNamespaces.js` (categorized constants = routes + future namespaces) | Platform routes & system names | No (code, version-controlled) |
| **L2 Dynamic** | `reserved_slugs` DB table | Admin, premium, business-prefix | Yes (admin UI) |
| **L3 Taken** | `username_history` | Existing username uniqueness | (existing) |

### Drift-killer (the core of "future-proof")

- **L1 is the enforcement authority** for routes/system names. The server always covers every route because a **CI test** extracts the first path-segment of every `<Route>` in `client/src/App.jsx` and asserts each ∈ L1. Adding `/pricing` tomorrow **fails CI** until it's reserved.
- The client/edge does **not** import server code (Vercel builds from `client/` root only). Instead `client/src/config/reservedSegments.js` holds the route-segment manifest the edge needs; a CI test asserts client manifest ⊆ server L1 and that the manifest matches the actual router. The edge SKIP is only a latency optimization (resolve API fails open for non-usernames), so correctness never depends on it.

`server/utils/reservedUsernames.js` keeps its public exports (`isReserved`, `RESERVED`) for backward-compat but is **rewired to delegate to L1** — all three current importers and both existing unit tests keep passing, and gain the expanded list automatically.

---

## 4. Normalization pipeline (Phases 5 + 10)

`normalizeSlug(raw)` in `server/utils/slugNormalize.js`, shared by every check and every write:

1. `String(raw)`
2. Unicode **NFKC** normalize (folds fullwidth/compatibility forms: `ＡＤＭＩＮ` → `admin`, `ⓐdmin` → `admin`)
3. Strip invisible/format chars: zero-width (U+200B–200D), BOM (U+FEFF), soft hyphen (U+00AD), bidi marks (U+200E/F, U+202A–202E, U+2066–2069), and other Unicode `Cf` category
4. Trim + collapse internal whitespace
5. `toLowerCase()`
6. Map separators to `-`: space, `_`, `.`, en/em dash (`–`/`—`), middle dot (`·`)
7. Collapse repeated `-`, strip leading/trailing `-`

Then **one unified format gate** (`server/utils/slugFormat.js`): `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length **3–30**. This retires the permissive 60-char onboarding regex (no existing slug exceeds 30 or has malformed hyphens — verified in the audit).

**Homoglyph note:** because the canonical form is ASCII `[a-z0-9-]` only, any Cyrillic/Greek lookalike that survives NFKC fails the format gate → blocked (just as `format`, not `reserved_route`, but blocked either way). A full confusable-fold table is a documented residual (YAGNI: homoglyphs cannot be *stored*, only *attempted*). A `confusableFold()` no-op hook is left as the extension point.

**Ordering rule (prevents a real bug):** normalize is applied **before** both the format check and the reserved check, so confusable/zero-width variants of reserved words map onto the reserved word and return `reserved_route`, not a confusing `format` error.

---

## 5. Prefix / namespace semantics (Phase 6) — key judgment call

User slugs are **single path segments** (no `/`). `/admin-tips` does **not** collide with `/admin` or `/admin/x`. Therefore **exact match on the normalized slug fully protects routes.** Substring/prefix blocking would over-block legitimate names (`apiary`, `administer`, `services-by-jane`).

So:

- **Route/system protection = exact match.** (Sufficient and correct.)
- **`is_prefix` is an opt-in business tool** (default `false`) for L2 rows: reserve `acme` *and* `acme-*` for an enterprise customer. Prefix match = `norm === reserved || norm.startsWith(reserved + '-')`.

This nuance is deliberate and documented to avoid the classic over-blocking mistake.

---

## 6. Enforcement points (Phase 4 — every write path)

| # | Write point | File | Today | Change |
|---|---|---|---|---|
| 1 | Change username | `usernameController.changeUsername` (`PUT /api/host/username`) | `isReserved` ✓ | normalize + `checkAvailability` |
| 2 | Live check | `usernameController.checkUsername` (`GET /api/username/check/:slug`) | `validateFormat` | normalize + service |
| 3 | Onboarding claim | `vendorOnboardingController.claimSlug` + `slugAvailableForUser` | `isReserved` ✓, own `isValidSlug` | unify format (3–30 strict), use service |
| 4 | Auto-generator | `usernameGenerator.generateUnique` | skips reserved ✓ | unchanged (uses L1 via `isReserved`) |
| 5 | **Phone login (bypass fix)** | `authController.findOrCreateProfileByPhone` | **❌ no check** | validate `user-<digits>`; fall back to generator if reserved/taken |
| 6 | RPC defense-in-depth | `change_username` + `set_onboarding_username` (SQL) | ❌ no check | add `reserved_slugs` EXISTS guard (DB layer; **no list duplication in SQL**) |
| 7 | Service guard | `usernameService.setOnboardingUsername` / `changeUsername` | lowercase only | normalize + L1 reject before RPC (protects future callers) |
| 8 | Dev seed | `scripts/seedLoadTest.js` | ❌ (dev-only) | add check (low priority) |

**Out of scope (documented):** `adminController.updateUser` does **not** allow setting `username` and will not — admins reserve via the L2 table, not by writing a user's username.

---

## 7. Data model — `reserved_slugs` (migration `v3.33_reserved_slugs.sql`)

```sql
CREATE TABLE IF NOT EXISTS reserved_slugs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,                  -- canonical (normalized) form
  kind        text NOT NULL DEFAULT 'admin',  -- 'system' | 'admin' | 'premium' | 'prefix'
  reason      text,                           -- human note (brand, future product, partner)
  is_prefix   boolean NOT NULL DEFAULT false, -- also block slug-* (business namespace)
  premium     boolean NOT NULL DEFAULT false, -- reservable/sellable (Phase 9 stub)
  assignable  boolean NOT NULL DEFAULT false, -- premium: grantable to a user
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by  uuid,                           -- admin id
  created_at  timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz                     -- soft release (nullable)
);
CREATE UNIQUE INDEX reserved_slugs_slug_active ON reserved_slugs (lower(slug)) WHERE released_at IS NULL;
CREATE INDEX reserved_slugs_kind_idx ON reserved_slugs (kind) WHERE released_at IS NULL;
-- RLS: enabled, deny-all (service-role only) — parity with username_history.
-- Helper: is_reserved_slug(text) → bool, checks active rows (exact + prefix). Used by RPCs.
```

The L2 table holds **only** admin/premium/prefix rows. System/route names stay in code (L1) so they can never be deleted via a DB write. The service unions both.

---

## 8. Admin reservation (Phase 8)

Routes under `adminRoutes.js`, gated by `requireAdmin('settings.manage')` (reuse — no RBAC migration):

- `GET    /api/admin/reserved-slugs` — list (filter by kind)
- `POST   /api/admin/reserved-slugs` — create `{ slug, kind, reason, is_prefix, premium }`
- `DELETE /api/admin/reserved-slugs/:id` — soft-release (`released_at = now()`)
- `GET    /api/admin/reserved-slugs/check/:slug` — test a name across all layers; returns **which layer blocks it**

UI: `client/src/pages/admin/AdminReservedSlugs.jsx` at route `/admin/system/reserved` (existing admin shell). List + create form + "check a name" tool + read-only view of the L1 system list (so admins see what code already protects). Reservations take effect immediately (short TTL cache + bust-on-write, mirroring the sitemap-cache pattern).

---

## 9. Premium stub (Phase 9 — architect, don't monetize)

Schema fields already present (`premium`, `assignable`, `assigned_to`). Supported now: admin marks a slug `premium`, **grants** it to a profile (`assigned_to`), and **reclaims** it (unassign / release). No buy/sell/payment flow. Documented extension point: Razorpay order → on `payment.captured`, set `assigned_to`. Short reserved names (`a`, `i`, `u`, `s`, `go`, `me`, `app`, …) are seeded as `kind='premium'` to prevent landgrab.

---

## 10. Remediation policy (Phase 7) — findings only, no auto-delete

- **Enforce on write, grandfather existing.** No data is mutated by this change.
- **Prod `demo`:** report; recommend the founder rename it (admin or the host's own change flow) if `/demo` is wanted later. No code forces it.
- **`user-<phone>` artifacts:** harmless (guests have no marketed public profile). The bypass fix (#5) stops new ones. Optional backfill-regeneration is **not** required.
- Full report shipped as `docs/reserved-namespace-audit.md` (route inventory + reserved inventory + collision report + recommendations).

---

## 11. Testing (Phase 10 included)

- **Unit:** `normalizeSlug` security matrix (`Admin`, `ADMIN`, `aDmIn`, `ＡＤＭＩＮ`, `ad‌min` ZWNJ, `admin·` soft-hyphen, ` admin `, `admın` dotless-ı, `аdmin` Cyrillic, `null`/`undefined`, double-hyphen) → each blocked with the expected reason; format gate; prefix logic; `checkAvailability` per reason.
- **Integration:** each write endpoint rejects a reserved name (changeUsername, claimSlug, slug-available, phone-login path); admin reserved CRUD + check; RPC `is_reserved_slug` guard.
- **Client:** route-manifest sync test (extract `<Route path>` first-segments from `App.jsx`, assert ⊆ manifest and ⊆ server L1); edge SKIP ⊆ manifest.
- **Regression:** keep existing `reservedUsernames.test.js` + `usernameGenerator.test.js` green; full server (657) + client (~201) suites green.

---

## 12. Rollout

- Migration `v3.33_reserved_slugs.sql` + RPC hardening applied to **both DBs** post-merge via Supabase MCP (project norm), idempotent (`IF NOT EXISTS`).
- Seed a handful of L2 brand/premium rows (`meeticulous`, `official`, short names) — optional, most coverage is L1.
- Grandfather existing usernames (no writes).
- PR from `worktree-feat+reserved-slugs` → `main`; Render auto-deploys backend, Vercel auto-deploys client on merge.

---

## 13. Files (planned)

**New**
- `server/config/reservedNamespaces.js` (L1 canonical, categorized)
- `server/utils/slugNormalize.js` (`normalizeSlug`, `confusableFold` hook)
- `server/utils/slugFormat.js` (unified format gate)
- `server/services/reservedSlugService.js` (resolver: `checkAvailability`, L2 lookups, cache)
- `server/controllers/reservedSlugAdminController.js`
- `server/routes` additions for admin reserved-slugs
- `server/migrations/v3.33_reserved_slugs.sql`
- `client/src/config/reservedSegments.js` (route manifest)
- `client/src/pages/admin/AdminReservedSlugs.jsx`
- `server/tests/unit/slugNormalize.test.js`, `reservedSlugService.test.js`
- `server/tests/integration/reservedSlugs.test.js`
- `client/src/__tests__/routeManifestSync.test.*`
- `docs/reserved-namespace-audit.md` (deliverables)

**Modified**
- `server/utils/reservedUsernames.js` (delegate to L1)
- `server/controllers/usernameController.js`, `vendorOnboardingController.js`, `authController.js`
- `server/services/usernameService.js`
- `server/migrations/v3.17_username_history.sql` is NOT edited; new RPC guard ships in v3.33 (`CREATE OR REPLACE`)
- `server/routes/adminRoutes.js`
- `client/middleware.js` (import manifest), `client/src/App.jsx` (admin route)

---

## 14. Residual risks

- Full homoglyph/confusable table not shipped (mitigated by ASCII-locked storage). Hook left.
- `is_reserved_slug` SQL guard covers L2 only; L1 route enforcement remains application-layer (acceptable — RPCs are service-role-only and all callers pass through the JS gate; documented).
- Profanity/impersonation filtering is out of scope (separate concern; hook noted).
- L2 cache TTL means an admin reservation can take up to the TTL to propagate (bounded; bust-on-write covers the same-node case).
