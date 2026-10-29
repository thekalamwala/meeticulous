# Service Category Redesign — Context-Aware Integrity + SEO Landing Pages

**Date:** 2026-07-02
**Branch:** `feat/service-categories`
**Status:** Approved design, pre-implementation

## Problem

1. **Cross-category leakage risk.** The v3.53 profession-scoped taxonomy is enforced only by
   one app-level validation function. The database cannot prevent wrong profession/service
   pairings, admin typos, slug-rename orphans, or stale categories after a host changes
   profession.
2. **No SEO surface for professions.** No public pages exist that showcase a profession's
   bookable services (`/services/photographer` etc.), and the Explore search that such pages
   would link into is a stub.

## Audit findings (current architecture flaws)

| # | Flaw | Consequence |
|---|------|-------------|
| F1 | `service_categories.primary_category` is free text, no FK to `categories.slug` | Admin typo creates orphan profession bucket |
| F2 | `services.category` is a bare text slug, no FK to `service_categories` | Slug rename orphans services; delete guard is app-side only |
| F3 | Slug unique only per profession; `services` row doesn't record its profession | Slug alone is ambiguous across professions; any slug-only filter can leak cross-profession |
| F4 | Host profession change never touches existing services | Services keep old profession's category slugs silently |
| F5 | Validation lives only in app code (2 write paths) | Any new write path can bypass |
| F6 | Public category endpoint uncached | Won't absorb SEO-page traffic |

The host picker frontend (`ServiceForm.jsx`) is already correctly scoped by
`profiles.primary_category`; the flaws are schema/API-level.

## Decision: Approach A — composite-FK denormalization

`services` stores the `(primary_category, category)` pair; a composite FK to
`service_categories(primary_category, slug)` makes cross-profession pairings
**unrepresentable in the database**. Chosen over UUID-FK normalization (join-heavy, more
churn, profession match still app-side) and app-only hardening (violates the DB-guarantee
requirement).

## Schema — migration `v3.60_service_category_integrity.sql`

Run manually in Supabase SQL Editor on BOTH DBs (staging Tokyo `xwvciqkayammbvsidqig`
first, then prod Mumbai `ayjhlwyzszykqtnaktpb`).

```sql
BEGIN;

-- 0) Cleanup before constraints:
--    a) delete service_categories rows whose primary_category is not a real
--       categories.slug (unusable orphans; report counts)
--    b) backfill services.primary_category from the host's profiles.primary_category
--       WHERE the (primary, category) pair exists in service_categories;
--       otherwise NULL the stale category (same policy as v3.53)

-- 1) Professions must be real
ALTER TABLE service_categories
  ADD CONSTRAINT fk_sc_primary FOREIGN KEY (primary_category)
  REFERENCES categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 2) services records its profession; composite FK enforces valid pairs
ALTER TABLE services ADD COLUMN primary_category text;
ALTER TABLE services
  ADD CONSTRAINT fk_services_category FOREIGN KEY (primary_category, category)
  REFERENCES service_categories(primary_category, slug)
  ON UPDATE CASCADE ON DELETE RESTRICT;
-- composite FK is MATCH SIMPLE (skips rows with any NULL) — close the hole:
ALTER TABLE services ADD CONSTRAINT chk_category_pair
  CHECK ((category IS NULL) = (primary_category IS NULL));

CREATE INDEX idx_services_prof_cat ON services(primary_category, category)
  WHERE category IS NOT NULL;

-- 3) SEO fields
ALTER TABLE service_categories
  ADD COLUMN description text,
  ADD COLUMN icon text;

COMMIT;
```

Effects: F1–F3 dead at DB level. Slug renames cascade into `services.category`
(`ON UPDATE CASCADE`); deleting an in-use category is blocked by RESTRICT (admin keeps
the friendly 409 pre-check as UX, DB is the backstop).

## Backend validation & write paths

- `server/lib/serviceCategory.js` — `resolveAndValidateCategory()` returns
  `{ ok, value, primary }`. Both service writers (`serviceController`, `hostController`)
  persist the pair (`category` + `primary_category`). No other call-site changes.
- **Profession change** (`PUT /api/host/categories` in `hostController`): when
  `primary_category` actually changes, run
  `UPDATE services SET category = NULL, primary_category = NULL WHERE host_id = ? AND
  primary_category IS DISTINCT FROM <new>`. Response includes `services_cleared` count;
  dashboard toasts "N services need a new category". Services stay live, uncategorised.
- Writers keep the 42703 missing-column fallback (per CLAUDE.md migration workflow) until
  v3.60 is confirmed applied on both DBs.

## API

| Endpoint | Change |
|---|---|
| `GET /api/service-categories?primary=` | Same shape + `description`, `icon`; wrapped in `responseCache` (TTL 300s) + `httpCache` Cache-Control; admin mutations bust by prefix |
| `GET /api/services-directory/:profession` (new, public) | SEO payload: profession `{slug,label,group_label}` + active services `[{name, slug, description (or template fallback), icon}]`. 404 when profession inactive or has zero active categories. Cached as above |
| `GET /api/explore` | Implement real `listVendors`: verified+active hosts; filters `category` (profession), **new `service` param**, `q`; paginated; VendorCard shape. Service filter uses `EXISTS (services WHERE primary_category = ? AND category = ? AND active)` |

Description template fallback (computed at read time, never stored):
`"Book trusted {profession label} professionals for {service name} on Book A Sloth"`.

## Admin management

- `serviceCategoryController.create`: friendly 400 on FK violation (profession dropdown in
  UI is fed from `categories` regardless).
- `update` slug rename: now safe while in use — cascade repoints services.
- New editable fields: `description`, `icon`.
- `CategoriesSection.jsx`: inputs for the two new fields; everything else unchanged.

## Seed

- `server/config/serviceCategorySeed.js` entries become `string | { name, description }`
  (backward compatible). Curated descriptions for an initial set of 10 professions
  (photographer, software-engineer, career-coach, nutritionist, psychologist,
  digital-marketer, graphic-designer, language-tutor, financial-advisor, ux-designer);
  the rest rely on the template fallback.
- `scripts/seedServiceCategories.js`: upsert fills `description` only where NULL
  (idempotent; never overwrites admin edits).
- Icons: curated profession-level icon map on the client; `service_categories.icon`
  overrides per service when set.

## Host service picker

No behavioral change (already profession-scoped). Consumes new payload fields. Dashboard
toast after profession change (from `services_cleared`).

## SEO landing pages

**Routes (public, App.jsx):**
- `/services` — directory index; professions grouped by `group_label`; crawl hub.
- `/services/:profession` — landing page; API 404 → branded ErrorPage.
- `services` is already reserved server-side (`reservedNamespaces.js`); add to client
  `reservedSegments.js` (invariant: App.jsx ⊆ reservedSegments ⊆ L1).
- `/services/:profession/:service` intentionally left free for Phase 2 nested pages.

**Page composition:**
- Hero: profession label H1 + template subline.
- Grid of `ServiceCategoryCard` (new component, follows `VendorCard` tokens — 4px borders,
  Plus Jakarta Sans headings, existing palette): icon, name, description, CTA
  **"Find Professionals"** → `/explore?category={profession}&service={slug}`.
- `<Seo>`: title, meta description, canonical, JSON-LD `ItemList` of `Service` +
  `BreadcrumbList`.
- SPA-rendered like existing indexable pages; no SSR.

## Minimal search (Explore un-stub)

- `Explore.jsx`: remove the `COMING_SOON` gate — the page renders real results. Read the
  new `service` query param; show active-filter chips. Sort/price facets remain deferred.
- This is the minimal viable CTA destination, not the full Explore build.

## Sitemap

- New child `sitemap-professions.xml` in the `sitemapController` index: `/services` +
  every profession with ≥1 active service category. Uses `sitemapCache`; busted on admin
  category mutations.

## Caching summary

`responseCache` (Redis when `REDIS_URL` set, else in-process, fail-open) + Cache-Control
headers on: service-categories list, services-directory payload. Sitemap via existing
`sitemapCache`. Admin category mutations bust both.

## Testing

- **Server (jest):** pair-stamping in lib; profession-change nulling + count; admin FK
  error mapping; rename-cascade integration; landing endpoint 200/404/template-fallback;
  explore filters including the cross-profession same-slug case (must not leak).
- **Client (vitest):** picker unchanged behavior; landing page cards + CTA hrefs
  (via `.getAttribute()` — jest-dom matcher gap); Explore param handling.
- Migration rehearsed on staging with backfill-count verification before prod.

## Rollout

(Corrected 2026-07-03: server deploys BEFORE the migration -- the order originally
listed here was wrong. Old server code writes `category` without `primary_category`,
so applying v3.60 first would make the new CHECK `chk_category_pair` 500 every
categorised service write; 23514 is not matched by any legacy-retry regex.)

1. Merge + deploy server (code is forward-compatible via 42703 fallbacks).
2. v3.60 on staging Tokyo → verify → prod Mumbai. Run once per DB top-to-bottom;
   the whole file is one transaction -- safe to retry a FAILED run from the top,
   never re-run after COMMIT.
3. Run `node server/scripts/seedServiceCategories.js` against each DB (gap-fill only).
4. Deploy client (may also ride step 1 -- SEO pages/Explore degrade gracefully
   pre-migration).
5. Update `docs/database-schema.md`, `docs/feature-map.md`, `docs/current-work.md`,
   changelog.

## Scalability

Hundreds of professions × tens of thousands of services: all hot reads are indexed
`(primary_category, category)` lookups behind a response cache; sitemap paginates;
seed is idempotent; no per-request joins added.

## Edge cases covered

- Host with no `primary_category` → empty picker, category stays NULL (allowed).
- Profession with no service categories → empty picker; **no** SEO page (thin-content
  guard), excluded from sitemap.
- Admin slug rename while in use → cascade, no orphans.
- Admin delete while in use → 409 (UX) + DB RESTRICT (backstop).
- Host changes profession → services de-categorised with visible count, re-pick on edit.
- Same slug under two professions (e.g. `1:1-mentorship`) → all filters take the pair;
  leak impossible.
- Deploy window before migration applied → writers' 42703 fallback keeps service
  create/edit working.
