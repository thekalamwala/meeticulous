# Reserved Namespace Audit & System

**Date:** 2026-06-24 · **Branch:** `feat/reserved-slugs` · **Migration:** `v3.33_reserved_slugs.sql`

This document is the deliverable for the route-namespace protection audit. It records what was found, what was built, and what remains. The system makes the platform always own its URL namespace: a username/slug can be claimed only if it collides with no application route, no admin/premium reservation, after aggressive normalization.

---

## 1. Why this exists

Public host profiles render at the **root path** `/:profileSlug` (`client/src/App.jsx`). Every username therefore shares one namespace with every app route. Without protection, a user who claims `/pricing` blocks the business from ever launching a `/pricing` page. The fix: one authoritative reserved-namespace resolver, enforced at every slug write point, with a list that is derived from the route table (so it cannot drift) plus a runtime admin/premium layer.

---

## 2. Architecture (as built)

Three layers, unioned by one service; normalization applied before every check.

| Layer | Source | Authority for | Mutable at runtime |
|---|---|---|---|
| **L1 static** | `server/config/reservedNamespaces.js` | Routes + system + future namespaces | No (code, version-controlled) |
| **L2 dynamic** | `reserved_slugs` table | Admin / premium / business-prefix | Yes (admin UI) |
| **L3 taken** | `username_history` | Existing username uniqueness | (existing) |

- **Resolver:** `server/services/reservedSlugService.checkAvailability(raw, {selfUserId})` → `{ ok, reason, normalized }`, `reason ∈ format | reserved_route | reserved_admin | taken | ok`.
- **Normalizer:** `server/utils/slugNormalize.normalizeSlug` (NFKC → strip invisibles/controls → trim/collapse → lowercase → map separators → collapse hyphens). Run **before** the format gate and reserved check at every site.
- **Format gate:** `server/utils/slugFormat.formatError` — one regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length 3–30, replacing two divergent validators.
- **Backward-compat:** `server/utils/reservedUsernames.isReserved` now delegates to L1 (all prior importers keep working, gain the bigger list + unicode hardening).

### Drift-killer
`client/src/config/reservedSegments.js` is the route manifest. Two CI tests bind the system:
- **Client** `routeManifestSync.test.jsx`: every `<Route>` first-segment ∈ manifest. Adding `/pricing` to `App.jsx` without reserving it **fails CI**.
- **Server** `reservedSegmentsSync.test.js`: every manifest segment ∈ L1. Server enforcement can never miss a client route.

---

## 3. Full route inventory (Phase 1)

### Client routes (React Router) — first segments
`/` · `help` · `about` · `privacy` · `terms` · `refund` · `unsubscribe` · `support` · `explore` · `login` · `forgot-password` · `reset-password` · `signup` · `be-a-sloth` · `login-as-vendor` · `vendor` (`/vendor/signup`) · `vendor-register` (+ `/:slug/claim|about|category|whatsapp|plan|live`) · `auth` (`/auth/google/done`) · `lp` (`/lp/*`) · `hello-sloth` · `super-dashboard` · `admin` (`/admin/*`, ~60 sub-routes) · `dashboard` (`/dashboard/*`) · `user` (`/user/*`) · `review` (`/review/:bookingId`) · `my-bookings` · `profile` · `reviews` · `loyalty` · **`/:profileSlug`** (+ `/:profileSlug/badges|product/:id|booking/:slug|:serviceSlug`) · `*` (NotFound).

The single collision surface is **`/:profileSlug`** and its children. Everything above it must be reserved.

### Server routes
- API mounts (`/api/*`): `auth`, `admin-auth`, `onboarding`, `host`, `bookings`, `payment`, `services`, `vendor`, `reviews`, `feedback`, `products`, `upload`, `categories`, `explore`, `vendors`, `feature-flags`, `email`, `username`, `whatsapp`, `notifications`, `admin`, plus `appearance`, `plans`.
- Root (non-API): `/sitemap.xml`, `/sitemap-*.xml`, `/health`, `/`, `/robots.txt`.

---

## 4. Reserved namespace inventory (Phases 2 & 6)

L1 categories in `server/config/reservedNamespaces.js` (each normalized into one set):

- **ROUTES** — every current first-segment above (incl. `sitemap`, `robots`, `health`, `manifest`, `favicon`).
- **INFRA** — `api`, `www`, `cdn`, `static`, `assets`, `public`, `media`, `files`, `img`, `images`, `download(s)`, `webhook(s)`, `oauth`, `sso`, `saml`, `callback`, `well-known`, `healthz`, `ping`, `status`, `metrics`, `debug`, `internal`, `system`, `root`.
- **FUTURE** (reserved today for tomorrow's launches) — `docs`, `blog(s)`, `pricing`, `plans`, `features`, `changelog`, `roadmap`, `security`, `legal`, `cookies`, `careers`, `jobs`, `press`, `newsroom`, `contact`, `faq`, `guides`, `tutorials`, `resources`, `learn`, `academy`, `courses`, `partners`, `affiliates`, `developers`, `api-docs`, `enterprise`, `teams`/`team`, `org(s)`/`organization(s)`, `workspace(s)`, `community`/`communities`, `marketplace`, `store`, `shop`, `market`.
- **ACCOUNT** — `account(s)`, `billing`, `invoice(s)`, `checkout`, `cart`, `verify`, `confirm`, `activate`, `welcome`, `onboarding`, `get-started`, `start`, `join`, `invite`, `refer(ral)`, booking/commerce nouns (`book`, `booking(s)`, `schedule`, `appointment(s)`, `slot(s)`, `availability`, `service(s)`, `product(s)`, `order(s)`, `payment(s)`, `subscribe`, `subscription(s)`, `upgrade`, `redeem`, `gift`, `promo`, `coupon`, `deals`, `offers`), plus `notifications`, `campaigns`, `badges`, `categories`, `feedback`.
- **BRAND / role / safety** — `meeticulous`, `meeticulous`, `sloth`, `official`, `verified`, `staff`, `moderator`/`mod`, `administrator`, `superadmin`, `no-reply`/`noreply`, `postmaster`, `abuse`, `hostmaster`, `mail`, `email`, `host(s)`, `users`, `vendors`, `home`, `index`, `me`, `guest`, `app(s)`, `web`, `go`.
- **SHORT** (premium landgrab guard) — `a i u s p c e r o x m`.
- **HAZARD** — `null`, `undefined`, `true`, `false`, `nan`, `none`, `nil`, `void`.

**Prefix semantics (Phase 6):** user slugs are single path segments, so `/admin-tips` never collides with `/admin`. Exact match fully protects routes; substring blocking would over-block (`apiary`, `administer`). Prefix reservation (`is_prefix`) is therefore an **opt-in L2 business tool** (reserve `acme` + `acme-*` for an enterprise customer), default off — not applied to routes.

---

## 5. Collision report (Phase 7) — live data, read-only

Run 2026-06-24 against both Supabase projects.

**Production (Mumbai `PROD_PROJECT_REF`)** — 31 profiles, 27 hosts:

| Slug | Role | Source | Finding | Recommendation |
|---|---|---|---|---|
| `demo` | host | onboarding | **Hard collision** — `demo`/`/demo` is a classic reserved/future route; claimed 2026-06-24 | Confirm it's a throwaway; rename via admin or the host's own change flow if `/demo` is wanted later. **Grandfathered** — no code forces a change. |
| `user-7904109359` | guest | auto | Phone-login bypass artifact (now fixed) | Harmless (guests have no marketed profile). Leave. |
| `user-919284399627` | guest | auto | Same | Leave. |

**Staging (Tokyo `STAGING_PROJECT_REF`)** — 7 profiles, 3 hosts: zero hard collisions. `user-8637758344` (same artifact). `timewheel-team` is NOT a collision (exact slug ≠ reserved `team`).

**Policy: enforce on write, grandfather existing.** No data is mutated by this change. Existing `username_history` rows stay valid; the resolver's idempotent self-claim means a user keeping a name that was reserved later still works.

---

## 6. Validation points audited (Phase 4)

| Write point | File | Before | After |
|---|---|---|---|
| Change username | `usernameController.changeUsername` | `isReserved` | normalize + unified format gate; RPC enforces L2/L3 |
| Live check | `usernameController.checkUsername` | format only | normalize + format + reserved |
| Onboarding claim | `vendorOnboardingController.claimSlug` / `slugAvailableForUser` | `isReserved` (loose) | `isReserved` now normalized (L1); RPC adds L2 |
| Auto-generator | `usernameGenerator.generateUnique` | skips reserved | unchanged (uses upgraded L1) |
| **Phone login** | `authController.findOrCreateProfileByPhone` | **no check (bypass)** | `user-<digits>` normalized + reserved-guarded |
| RPC layer | `change_username`, `set_onboarding_username` | no check | `is_reserved_slug()` L2 guard |
| Service layer | `usernameService.setOnboardingUsername` / `changeUsername` | lowercase only | normalize + L1 reject (defense-in-depth) |
| Edge SKIP | `client/middleware.js` | hand-maintained set | imports the route manifest |

Admin user-edit (`adminController.updateUser`) intentionally does not allow setting `username`; admins reserve via the L2 table instead.

---

## 7. Security concerns (Phase 10) — bypass matrix

`normalizeSlug` + the ASCII-only format gate close the standard evasions. Proven by `slugNormalize.test.js` + `reservedSlugBypass.test.js` (every variant of `admin` → 400, never reaches the RPC):

| Attack | Example | Outcome |
|---|---|---|
| Case | `Admin`, `ADMIN`, `aDmIn` | lowercased → `reserved_route` |
| NFKC fullwidth/circled | `ＡＤＭＩＮ`, `ⓐdmin` | folded → `reserved_route` |
| Zero-width / BOM / soft-hyphen / bidi | `ad‌min`, `﻿admin`, `admin­` | stripped (`\p{Cf}`) → `reserved_route` |
| Control chars (tab/newline/null) | `ad\tmin` | stripped (`\p{Cc}`), collapses toward the word |
| Padding | `  admin  ` | trimmed → `reserved_route` |
| Separator swap | `ad_min`, `ad.min` | mapped to `-` → `ad-min` (distinct, correctly NOT `admin`) |
| Homoglyph (Cyrillic/Greek/dotless) | `аdmin`, `admın` | survive NFKC as non-ASCII → fail format gate → blocked |
| Double-hyphen / edge hyphen | `a--dmin`, `-admin-` | collapsed/trimmed |

**Encoding note:** URL/double-encoding is an HTTP-layer concern; Express decodes once and the service normalizes the decoded value (a literal `%2561` fails the format gate). **Homoglyph residual:** a full confusables table is not shipped because ASCII-locked storage means homoglyphs can only be *attempted*, never *stored*; `confusableFold()` is left as the extension point.

---

## 8. Architecture decisions

1. **Hybrid, not pure-DB or pure-static.** Routes/system in code (can't be deleted by a DB write); admin/premium in a table (runtime). One resolver unions them.
2. **Controllers do sync L1+format; RPCs do L2+L3 atomically.** Keeps a DB round-trip off the hot path and keeps existing unit tests (which don't mock the DB) green. `reservedSlugService` (async, full) powers the admin check tool.
3. **Exact-match for routes; prefix is opt-in business-only.** Correct for single-segment slugs; avoids over-blocking.
4. **Grandfather existing usernames.** Enforce on write only; report collisions, never auto-delete.
5. **Onboarding keeps its 60-char first-claim rule;** username *changes* use strict 30. Minimizes disruption while both stay reserved-protected.
6. **Premium = schema + admin grant/reclaim, no monetization.** `reserved_slugs.{premium,assignable,assigned_to}` exist; the buy/sell flow is a documented Razorpay extension point.

---

## 9. Files (this change)

**New:** `server/config/reservedNamespaces.js`, `server/utils/slugNormalize.js`, `server/utils/slugFormat.js`, `server/services/reservedSlugService.js`, `server/controllers/reservedSlugAdminController.js`, `server/migrations/v3.33_reserved_slugs.sql`, `client/src/config/reservedSegments.js`, `client/src/pages/admin/AdminReservedSlugs.jsx`, plus 6 test files.
**Modified:** `server/utils/reservedUsernames.js`, `server/controllers/usernameController.js`, `server/controllers/authController.js`, `server/services/usernameService.js`, `server/routes/adminRoutes.js`, `client/middleware.js`, `client/src/App.jsx`, `client/src/services/api.js`.

---

## 10. Remaining risks & future scaling

- **Homoglyph table not shipped** — mitigated by ASCII-locked storage; wire `confusableFold()` if impersonation-by-lookalike becomes a real abuse vector.
- **L1 enforcement is application-layer in the RPCs** (the SQL guard covers L2 only) — acceptable because RPCs are service-role-only and every caller passes the JS gate; documented.
- **Profanity / impersonation filtering** is out of scope (a separate list could plug into `reservedSlugService` as an L1.5 layer).
- **L2 cache TTL (60s)** — an admin reservation propagates within the TTL across nodes; same-node writes bust immediately. For multi-node, consider a pub/sub bust or shorter TTL.
- **Scaling the list:** as products launch, add segments to `reservedNamespaces.js` (CI enforces route coverage). For thousands of partner/enterprise reservations, the L2 table + `is_prefix` already scales; add an index-backed search to the admin UI when the list grows large.
- **Premium monetization:** when ready, add a Razorpay order keyed to a `reserved_slugs` row; on `payment.captured`, set `assigned_to` and grant via the existing change flow.

---

## 11. Rollout

1. Apply `server/migrations/v3.33_reserved_slugs.sql` to **staging then production** (idempotent; `IF NOT EXISTS`).
2. Optionally seed brand/premium L2 rows (`meeticulous`, `sloth`, `official`, short names).
3. Merge → Render (backend) + Vercel (client) auto-deploy.
4. Verify: `reserved_slugs` exists, `is_reserved_slug('demo')` is `false` until a row is added, RPCs updated, server + client suites green.
