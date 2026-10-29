# Service Category Integrity + SEO Landing Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make profession→service pairing impossible to violate at the database level (composite FK, migration v3.60), and ship public SEO landing pages `/services` + `/services/:profession` whose cards link into a real (un-stubbed) Explore search.

**Architecture:** `services` rows store the `(primary_category, category)` pair with a composite FK to `service_categories(primary_category, slug)`. All writers stamp the pair via the shared lib. New public read endpoints are cached with the existing `responseCache`/`httpCache`. SEO pages are SPA routes fed by a new services-directory API and listed in a new sitemap child.

**Tech Stack:** Express 4 + Supabase (service_role writes), React 18 + Vite + react-router v6 + Tailwind, Jest (server), Vitest (client).

**Spec:** `docs/superpowers/specs/2026-07-02-service-category-redesign-design.md`

## Global Constraints

- Migrations run manually in Supabase SQL Editor on BOTH DBs — staging Tokyo `xwvciqkayammbvsidqig` FIRST, then prod Mumbai `ayjhlwyzszykqtnaktpb`. Keep code-side 42703 schema fallbacks until confirmed applied on both.
- Never rename existing APIs, routes, or DB columns. Code/DB keeps "vendor" naming; UI copy says "Host".
- UI: existing design tokens only, 4px borders, `rounded-xl` where already used, Plus Jakarta Sans headings, Poppins body. Reuse existing components.
- Client vitest does NOT load jest-dom — only `toBeInTheDocument/toBeDisabled/toBeEnabled/toBeEmptyDOMElement` matchers; otherwise use `.getAttribute()` / `.textContent`.
- Server tests live in `server/tests/` (unit + integration subfolders). Run `cd server && npm test`. Client: `cd client && npm test` and `npm run build`.
- Every new top-level client route: add first segment to `client/src/config/reservedSegments.js` (CI sync test enforces App.jsx ⊆ reservedSegments ⊆ server L1).
- Commit after every task. Branch: `feat/service-categories`.

## File Structure

| File | Responsibility |
|---|---|
| `server/migrations/v3.60_service_category_integrity.sql` | Create: cleanup + backfill + FKs + CHECK + index + SEO columns |
| `server/lib/serviceCategory.js` | Modify: resolver also returns `primary` |
| `server/controllers/serviceController.js` | Modify: stamp pair on create/update; pair-safe label lookup |
| `server/controllers/hostController.js` | Modify: stamp pair; de-categorise services on profession change |
| `server/controllers/serviceCategoryController.js` | Modify: description/icon fields, FK error mapping, caching + busts |
| `server/config/serviceCategorySeed.js` | Modify: entries accept `{name, description}`; curated descriptions ×10 professions |
| `server/scripts/seedServiceCategories.js` | Modify: gap-fill descriptions on existing rows |
| `server/controllers/servicesDirectoryController.js` | Create: public SEO payload endpoints |
| `server/routes/servicesDirectoryRoutes.js` | Create: public router |
| `server/server.js` | Modify: mount services-directory router |
| `server/controllers/exploreController.js` | Modify: real `listVendors` with `service` param |
| `server/services/sitemapService.js` | Modify: `fetchProfessions` + `professionEntries` |
| `server/controllers/sitemapController.js` | Modify: professions child + index entry |
| `server/routes/sitemapRoutes.js` | Modify: `/sitemap-professions.xml` route |
| `client/src/services/api.js` | Modify: directory fetchers |
| `client/src/config/reservedSegments.js` | Modify: add `services` |
| `client/src/App.jsx` | Modify: two public routes |
| `client/src/config/professionIcons.js` | Create: profession slug → lucide icon map |
| `client/src/components/services/ServiceCategoryCard.jsx` | Create: SEO card |
| `client/src/pages/services/ServicesDirectory.jsx` | Create: `/services` index page |
| `client/src/pages/services/ProfessionServices.jsx` | Create: `/services/:profession` landing page |
| `client/src/pages/Explore.jsx` | Modify: un-stub; `service` param + chips |
| `client/src/pages/admin/AdminServiceCategories.jsx` | Modify: description + icon inputs |
| `client/src/components/dashboard/CategoriesSection.jsx` | Modify: `services_cleared` toast |
| Tests | `server/tests/unit/serviceCategoryPair.test.js`, `server/tests/integration/servicesDirectory.int.test.js`, `server/tests/integration/exploreList.int.test.js`, extensions to `server/tests/integration/serviceCategory.test.js`, `client/src/tests/ProfessionServices.test.jsx`, `client/src/tests/ServiceCategoryCard.test.jsx` |
| Docs | `docs/database-schema.md`, `docs/feature-map.md`, `docs/current-work.md` |

---

### Task 1: Migration v3.60

**Files:**
- Create: `server/migrations/v3.60_service_category_integrity.sql`

**Interfaces:**
- Produces: `services.primary_category text` column; composite FK `fk_services_category (primary_category, category) → service_categories(primary_category, slug)`; `service_categories.description text`, `service_categories.icon text`. Later tasks assume these exact names.

- [ ] **Step 1: Write the migration file**

```sql
-- v3.60 — Service Category INTEGRITY (composite-FK model)
--
-- Makes cross-profession service pairings unrepresentable:
--   * service_categories.primary_category must be a real profession (FK → categories.slug)
--   * services stores the (primary_category, category) PAIR with a composite FK
--     → service_categories(primary_category, slug); ON UPDATE CASCADE repoints
--     services when an admin renames a slug; ON DELETE RESTRICT backstops the
--     app-side "in use" 409.
--   * CHECK closes the MATCH SIMPLE hole (composite FK ignores rows where any
--     column is NULL): category and primary_category are NULL together or set together.
-- Also adds SEO columns (description, icon) for the /services landing pages.
--
-- PRE-REQ: categories.slug is UNIQUE (v3.21) — FK target.
-- Run AFTER on both DBs: node server/scripts/seedServiceCategories.js (gap-fills descriptions)

BEGIN;

-- 0a) Remove unusable orphan buckets (profession typo rows) --------------------
DELETE FROM service_categories sc
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = sc.primary_category);

-- 0b) services.primary_category + backfill -------------------------------------
ALTER TABLE services ADD COLUMN IF NOT EXISTS primary_category text;

-- Stamp from the host's current profession where the pair is valid
UPDATE services s
SET primary_category = p.primary_category
FROM profiles p
WHERE s.host_id = p.id
  AND s.category IS NOT NULL
  AND s.primary_category IS NULL
  AND EXISTS (
    SELECT 1 FROM service_categories sc
    WHERE sc.primary_category = p.primary_category AND sc.slug = s.category
  );

-- Anything left categorised but unpaired is stale (host changed profession,
-- old v3.53-era value, deleted category) → clear, host re-picks on next edit.
UPDATE services SET category = NULL, primary_category = NULL
WHERE category IS NOT NULL AND primary_category IS NULL;

-- 1) Professions must be real ---------------------------------------------------
ALTER TABLE service_categories
  ADD CONSTRAINT fk_sc_primary FOREIGN KEY (primary_category)
  REFERENCES categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 2) The pair is the only representable link ------------------------------------
ALTER TABLE services
  ADD CONSTRAINT fk_services_category FOREIGN KEY (primary_category, category)
  REFERENCES service_categories(primary_category, slug)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE services ADD CONSTRAINT chk_category_pair
  CHECK ((category IS NULL) = (primary_category IS NULL));

CREATE INDEX IF NOT EXISTS idx_services_prof_cat
  ON services(primary_category, category) WHERE category IS NOT NULL;

-- 3) SEO fields ------------------------------------------------------------------
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS icon text;

COMMIT;
```

- [ ] **Step 2: Sanity-check the SQL** — read it once against the live schema doc (`docs/database-schema.md` services + service_categories sections); confirm no column name typos. Do NOT run it yet (rollout task 16).

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.60_service_category_integrity.sql
git commit -m "feat(db): v3.60 service-category integrity — composite FK + SEO cols (not yet applied)"
```

---

### Task 2: Lib returns the pair

**Files:**
- Modify: `server/lib/serviceCategory.js`
- Test: `server/tests/unit/serviceCategoryPair.test.js` (create)

**Interfaces:**
- Produces: `resolveAndValidateCategory(supabaseAdmin, hostId, category, opts)` → `{ ok: true, value: string|null, primary: string|null }` (primary is non-null iff value is non-null) or `{ ok: false, status, message }`. Tasks 3–4 rely on `chk.value` + `chk.primary`.

- [ ] **Step 1: Write failing tests** — create `server/tests/unit/serviceCategoryPair.test.js`:

```js
const { resolveAndValidateCategory } = require('../../lib/serviceCategory');

// Minimal supabase stub: .from(t).select().eq()... resolving preset data.
const makeStub = ({ primary, slugs }) => ({
  from: (table) => ({
    select: () => ({
      eq: (col, val) => {
        if (table === 'profiles') {
          return { single: async () => ({ data: { primary_category: primary } }) };
        }
        // service_categories: two chained .eq()
        return { eq: () => Promise.resolve({ data: slugs.map((s) => ({ slug: s })) }) };
      },
    }),
  }),
});

test('valid category returns value AND primary', async () => {
  const stub = makeStub({ primary: 'photographer', slugs: ['wedding-photography'] });
  const r = await resolveAndValidateCategory(stub, 'h1', 'wedding-photography');
  expect(r.ok).toBe(true);
  expect(r.value).toBe('wedding-photography');
  expect(r.primary).toBe('photographer');
});

test('empty category returns null value and null primary', async () => {
  const stub = makeStub({ primary: 'photographer', slugs: ['wedding-photography'] });
  const r = await resolveAndValidateCategory(stub, 'h1', '');
  expect(r.ok).toBe(true);
  expect(r.value).toBeNull();
  expect(r.primary).toBeNull();
});

test('profession with no categories returns null pair even when category sent', async () => {
  const stub = makeStub({ primary: 'obscure-prof', slugs: [] });
  const r = await resolveAndValidateCategory(stub, 'h1', 'anything');
  expect(r.ok).toBe(true);
  expect(r.value).toBeNull();
  expect(r.primary).toBeNull();
});

test('invalid category still rejects', async () => {
  const stub = makeStub({ primary: 'photographer', slugs: ['wedding-photography'] });
  const r = await resolveAndValidateCategory(stub, 'h1', 'seo-audit');
  expect(r.ok).toBe(false);
  expect(r.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify failure** — `cd server && npx jest tests/unit/serviceCategoryPair.test.js -v`
Expected: FAIL — `r.primary` is `undefined`.

- [ ] **Step 3: Implement** — in `server/lib/serviceCategory.js`, replace the final `return` of `resolveAndValidateCategory` :

```js
  const result = validateServiceCategory({ category, validSlugs, required: !!opts.required });
  if (!result.ok) return result;
  // The pair travels together: a stored category always carries the profession
  // it was validated against (composite FK fk_services_category, v3.60).
  return { ...result, primary: result.value ? primary : null };
```

- [ ] **Step 4: Run tests** — same command. Expected: 4 PASS. Also run the existing suite touching this lib: `npx jest serviceCategory -v` — all PASS.

- [ ] **Step 5: Commit** — `git add -- server/lib/serviceCategory.js server/tests/unit/serviceCategoryPair.test.js && git commit -m "feat(categories): resolver returns (category, primary) pair"`

---

### Task 3: serviceController stamps the pair + pair-safe label lookup

**Files:**
- Modify: `server/controllers/serviceController.js` (create ~line 218-228, update ~line 284-292, label lookup ~line 532-538, SELECT_COLS ~line 108-111)

**Interfaces:**
- Consumes: `chk.value`, `chk.primary` from Task 2.
- Produces: services rows written with both `category` and `primary_category`.

- [ ] **Step 1: createService — after `p.category = chk.value;` add:**

```js
    p.primary_category = chk.primary;
```

- [ ] **Step 2: updateService — inside the `req.body.category !== undefined` branch, after `updates.category = chk.value;` add:**

```js
      updates.primary_category = chk.primary;
```

- [ ] **Step 3: 42703 fallback safety** — locate the legacy-retry in updateService (~line 191-196). `legacyCols` already excludes `category`; confirm it also does not contain `primary_category` (it won't — just verify, no change). In createService, find the equivalent legacy-retry (same `/Could not find the/i` pattern) and confirm the retry payload strips both `category` and `primary_category`. If the create path strips only `category`, extend the strip list:

```js
    delete safe.category;
    delete safe.primary_category; // pre-v3.60 schema
```

- [ ] **Step 4: SELECT_COLS** — add `primary_category` to the modern column list (~line 108-111), leaving `LEGACY_SELECT_COLS` untouched:

```js
  'category,primary_category,is_active,created_at,updated_at';
```

- [ ] **Step 5: Pair-safe label lookup** (~line 532-538) — the public service page resolves the category label by slug only, which is ambiguous across professions. Replace:

```js
  if (service && service.category) {
    const { data: cat } = await supabaseAdmin
      .from('service_categories').select('name').eq('slug', service.category).limit(1).maybeSingle();
    service.category_label = cat?.name || null;
  }
```

with:

```js
  if (service && service.category) {
    let q = supabaseAdmin.from('service_categories').select('name').eq('slug', service.category);
    // Pair lookup once v3.60 stamps the profession; slug-only pre-migration.
    if (service.primary_category) q = q.eq('primary_category', service.primary_category);
    const { data: cat } = await q.limit(1).maybeSingle();
    service.category_label = cat?.name || null;
  }
```

- [ ] **Step 6: Run server tests** — `cd server && npm test`
Expected: PASS (existing service tests unaffected; mocked writes tolerate the extra column).

- [ ] **Step 7: Commit** — `git commit -am "feat(services): stamp (category, primary_category) pair; pair-safe label lookup"`

---

### Task 4: hostController stamps the pair

**Files:**
- Modify: `server/controllers/hostController.js` (createService ~line 455-480, updateService ~line 555-570)

**Interfaces:** identical to Task 3 — both write paths must behave the same.

- [ ] **Step 1: createService** — the whitelist payload (~line 473) sets `category` from `chk.value`; add alongside it:

```js
      primary_category: chk.primary,
```

- [ ] **Step 2: updateService** — find the `resolveAndValidateCategory` call (~line 560) and, where `updates.category = chk.value` is assigned, add:

```js
      updates.primary_category = chk.primary;
```

- [ ] **Step 3: 42703 fallback** — if either host write path has a legacy retry (same `/Could not find the/i` regex), ensure the retry strips `primary_category` as well as `category` (mirror Task 3 Step 3).

- [ ] **Step 4: Run tests** — `cd server && npm test`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(host): service writes stamp the profession pair"`

---

### Task 5: Profession change de-categorises services

**Files:**
- Modify: `server/controllers/hostController.js` (updateCategories, lines ~410-452)
- Test: `server/tests/integration/serviceCategory.test.js` (extend — follow the file's existing supertest+mock style)

**Interfaces:**
- Produces: `PUT /api/host/categories` response gains `services_cleared: number` (0 when profession unchanged). Task 14 (client toast) consumes it.

- [ ] **Step 1: Write failing integration test** — in the existing file's style, add:

```js
test('changing primary_category clears categorised services and reports count', async () => {
  // arrange mocks: profiles.select → { primary_category: 'photographer' } (before)
  // profiles.update → { primary_category: 'doctor', categories: ['doctor'] }
  // services.update(...).eq('host_id',...).not('category','is',null).select('id')
  //   → { data: [{id:'s1'},{id:'s2'}] }
  const res = await request(app)
    .put('/api/host/categories')
    .set(authHeaders)
    .send({ primary_category: 'doctor', categories: ['doctor'] });
  expect(res.status).toBe(200);
  expect(res.body.services_cleared).toBe(2);
});

test('re-saving the same primary_category clears nothing', async () => {
  // before === after → services.update must NOT be called
  const res = await request(app)
    .put('/api/host/categories')
    .set(authHeaders)
    .send({ primary_category: 'photographer', categories: ['photographer'] });
  expect(res.status).toBe(200);
  expect(res.body.services_cleared).toBe(0);
});
```

(Adapt mock wiring to the file's existing helpers — read the top of the file first; the assertions above are the contract.)

- [ ] **Step 2: Run to verify failure** — `npx jest tests/integration/serviceCategory.test.js -v`. Expected: FAIL — `services_cleared` undefined.

- [ ] **Step 3: Implement** — in `updateCategories`, before the profiles `.update(...)` (~line 437), capture the prior value; after the update, clear when changed:

```js
    // Prior profession — a change invalidates every categorised service (their
    // category slugs belong to the OLD profession's list).
    const { data: before } = await supabaseAdmin
      .from('profiles').select('primary_category').eq('id', req.user.id).single();

    /* ...existing profiles.update()... */

    let services_cleared = 0;
    if ((before?.primary_category || null) !== (data.primary_category || null)) {
      let clr = await supabaseAdmin
        .from('services')
        .update({ category: null, primary_category: null, updated_at: new Date().toISOString() })
        .eq('host_id', req.user.id)
        .not('category', 'is', null)
        .select('id');
      if (clr.error && /Could not find the|column .* does not exist/i.test(clr.error.message)) {
        // pre-v3.60 schema: no primary_category column yet
        clr = await supabaseAdmin
          .from('services')
          .update({ category: null, updated_at: new Date().toISOString() })
          .eq('host_id', req.user.id)
          .not('category', 'is', null)
          .select('id');
      }
      if (clr.error) throw clr.error;
      services_cleared = (clr.data || []).length;
      if (services_cleared > 0) bustPublicReadCaches(); // public service pages embed category_label
    }
    res.json({ ...data, services_cleared });
```

Add the import at the top if absent: `const { bustPublicReadCaches } = require('../services/publicCacheBust');`

- [ ] **Step 4: Run tests** — same command, then full `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(host): profession change de-categorises services, returns services_cleared"`

---

### Task 6: serviceCategoryController — SEO fields, FK mapping, caching

**Files:**
- Modify: `server/controllers/serviceCategoryController.js`
- Test: `server/tests/integration/serviceCategory.test.js` (extend)

**Interfaces:**
- Produces: `listPublic` items gain `description`, `icon`; cache namespace `svccat:` (+ `svcdir:` bust hook for Task 8); create/update accept `description`, `icon`.

- [ ] **Step 1: Failing tests** (same integration file):

```js
test('public list includes description and icon', async () => {
  // mock service_categories select → [{ id, name, slug, primary_category,
  //   description: 'Capture your big day', icon: 'camera' }]
  const res = await request(app).get('/api/service-categories?primary=photographer');
  expect(res.status).toBe(200);
  expect(res.body.categories[0].description).toBe('Capture your big day');
  expect(res.body.categories[0].icon).toBe('camera');
  expect(res.headers['cache-control']).toMatch(/public, max-age=300/);
});

test('admin create maps FK violation to friendly 400', async () => {
  // mock insert → { error: { code: '23503', message: 'violates foreign key constraint "fk_sc_primary"' } }
  const res = await request(app)
    .post('/api/admin/service-categories')
    .set(adminHeaders)
    .send({ primary_category: 'not-a-real-profession', name: 'X' });
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/existing profession/i);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** in `serviceCategoryController.js`:

Imports at top:

```js
const responseCache = require('../services/responseCache');
const { setPublicCache } = require('../utils/httpCache');
const { bustSitemapCache } = require('../utils/sitemapCache');

const PUBLIC_CACHE_MS = Number(process.env.SERVICE_CATEGORY_CACHE_MS) || 300_000;

// Any category mutation invalidates the public picker payloads, the SEO
// directory payloads (Task 8), and the professions sitemap.
const bustCategoryCaches = () => {
  responseCache.bust('svccat:');
  responseCache.bust('svcdir:');
  bustSitemapCache();
};

const isFkViolation = (error) => error && error.code === '23503';
```

`listPublic` becomes cached + extended select:

```js
const listPublic = async (req, res) => {
  try {
    const primary = req.query.primary;
    if (!primary) return res.json({ categories: [] });

    const payload = await responseCache.getOrSet(`svccat:${primary}`, PUBLIC_CACHE_MS, async () => {
      let r = await supabaseAdmin
        .from('service_categories')
        .select('id, name, slug, primary_category, description, icon')
        .eq('primary_category', primary)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (r.error && /Could not find the|column .* does not exist/i.test(r.error.message)) {
        // pre-v3.60: no description/icon columns
        r = await supabaseAdmin
          .from('service_categories')
          .select('id, name, slug, primary_category')
          .eq('primary_category', primary)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true });
      }
      if (r.error) throw r.error;
      return { categories: r.data || [] };
    });

    setPublicCache(res, 300);
    res.json(payload);
  } catch (error) {
    safeError(res, error);
  }
};
```

`create`: accept the new fields in the insert object —

```js
        description: req.body.description ? String(req.body.description).trim() : null,
        icon:        req.body.icon        ? String(req.body.icon).trim()        : null,
```

and wrap the FK error before the generic throw:

```js
    if (isFkViolation(error)) {
      return res.status(400).json({ message: 'primary_category must be an existing profession' });
    }
```

(place inside the catch, before `safeError`.)

`update`: patch the new fields —

```js
    if (req.body.description !== undefined) updates.description = req.body.description ? String(req.body.description).trim() : null;
    if (req.body.icon !== undefined)        updates.icon        = req.body.icon ? String(req.body.icon).trim() : null;
```

At the end of every successful mutation (`create`, `update`, `remove`, `reorder`) call `bustCategoryCaches();` before sending the response.

- [ ] **Step 4: Run tests** — file, then full suite. NOTE: responseCache persists across tests in one process — call `require('../../services/responseCache').clear()` in the file's `beforeEach` to avoid cross-test hits.

- [ ] **Step 5: Commit** — `git commit -am "feat(categories): SEO fields + FK mapping + cached public list"`

---

### Task 7: Seed — descriptions

**Files:**
- Modify: `server/config/serviceCategorySeed.js`, `server/scripts/seedServiceCategories.js`

**Interfaces:**
- Produces: seed entries are `string | { name: string, description: string }`. Script gap-fills `description` on existing rows WHERE description IS NULL.

- [ ] **Step 1: Normalise entry shape in the script.** In `seedServiceCategories.js` replace the `names.forEach` block:

```js
    const entries = (SERVICE_CATEGORY_SEED[primary] || []).map((e) =>
      typeof e === 'string' ? { name: e, description: null } : e
    );

    const rows = [];
    const seen = new Set(have);
    entries.forEach(({ name, description }, i) => {
      let slug = slugify(name);
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      rows.push({ primary_category: primary, name, slug, display_order: i, is_active: true, description: description || null });
    });
```

- [ ] **Step 2: Gap-fill descriptions for rows that already exist.** After the insert block, still inside the profession loop:

```js
    // Existing rows: fill description ONLY where NULL (never clobber admin copy).
    for (const { name, description } of entries) {
      if (!description) continue;
      const slug = slugify(name);
      if (!have.has(slug)) continue; // just inserted with description above
      await supabaseAdmin
        .from('service_categories')
        .update({ description })
        .eq('primary_category', primary)
        .eq('slug', slug)
        .is('description', null);
    }
```

Wrap the whole run in a pre-v3.60 guard: if the FIRST insert/update fails with the missing-column regex (`/Could not find the|column .* does not exist/i` on `description`), log `"v3.60 not applied — seeding names only"` and fall back to rows without the `description` key.

- [ ] **Step 3: Author curated descriptions** in `serviceCategorySeed.js` for these 10 professions: `photographer`, `software-engineer`, `career-coach`, `nutritionist`, `psychologist`, `digital-marketer`, `graphic-designer`, `language-tutor`, `financial-advisor`, `ux-designer`. Convert each of their entries from `'Name'` to `{ name: 'Name', description: '...' }`.

Description rules (every entry): 110–160 chars, plain sentence, mentions the service and the outcome, no superlative spam, no exclamation marks. Pattern examples to match exactly in tone:

```js
  { name: 'Wedding Photography',   description: 'Hire a wedding photographer to capture your ceremony, candids and couple portraits — browse portfolios and book online.' },
  { name: 'Code Review',           description: 'Get an experienced engineer to review your code for bugs, structure and best practices before you ship.' },
  { name: 'Diet Plan Consultation', description: 'Work with a nutritionist on a personalised diet plan built around your goals, routine and food preferences.' },
```

(If `photographer` is not currently a key in the seed, add it with a standard service list — Wedding/Pre-Wedding/Maternity/Newborn/Product/Event/Fashion/Real-Estate/Drone Photography etc. — all with descriptions.)

- [ ] **Step 4: Syntax check** — `cd server && node -e "const {SERVICE_CATEGORY_SEED}=require('./config/serviceCategorySeed'); const n=Object.values(SERVICE_CATEGORY_SEED).flat().filter(e=>typeof e==='object'&&(!e.description||e.description.length<110||e.description.length>160)); console.log(n.length===0?'OK':n.map(e=>e.name));"`
Expected: `OK`.

- [ ] **Step 5: Commit** — `git commit -am "feat(seed): per-service SEO descriptions (10 professions) + gap-fill seeding"`

---

### Task 8: Services-directory API

**Files:**
- Create: `server/controllers/servicesDirectoryController.js`, `server/routes/servicesDirectoryRoutes.js`
- Modify: `server/server.js` (mount after line 146, next to the other service-category mounts)
- Test: `server/tests/integration/servicesDirectory.int.test.js` (create; mirror the mock/supertest bootstrap of `serviceCategory.test.js`)

**Interfaces:**
- Produces:
  - `GET /api/services-directory` → `{ groups: [{ group_label, professions: [{ slug, label, serviceCount }] }] }`
  - `GET /api/services-directory/:profession` → `{ profession: { slug, label, group_label }, services: [{ name, slug, description, icon }] }` — `description` never null (template fallback), 404 when profession unknown/inactive/empty.
- Cache namespace `svcdir:` (busted by Task 6's `bustCategoryCaches`).

- [ ] **Step 1: Failing tests:**

```js
test('GET /api/services-directory/:profession returns services with fallback descriptions', async () => {
  // mocks: categories → { slug:'photographer', label:'Photographer', group_label:'Creative', status:'active' }
  // service_categories → [{ name:'Wedding Photography', slug:'wedding-photography', description:null, icon:null }]
  const res = await request(app).get('/api/services-directory/photographer');
  expect(res.status).toBe(200);
  expect(res.body.profession.label).toBe('Photographer');
  expect(res.body.services[0].description).toBe(
    'Book trusted Photographer professionals for Wedding Photography on Book A Sloth.'
  );
  expect(res.headers['cache-control']).toMatch(/max-age=300/);
});

test('unknown profession → 404', async () => {
  // categories lookup → null
  const res = await request(app).get('/api/services-directory/nope');
  expect(res.status).toBe(404);
});

test('profession with zero active services → 404 (thin-content guard)', async () => {
  const res = await request(app).get('/api/services-directory/empty-prof');
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run to verify failure** (route not mounted → 404 but body/headers assertions fail).

- [ ] **Step 3: Controller:**

```js
/**
 * servicesDirectoryController.js — public read API behind the SEO landing pages
 * (/services and /services/:profession). Pure reads, response-cached; category
 * admin mutations bust the `svcdir:` namespace (serviceCategoryController).
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const responseCache = require('../services/responseCache');
const { setPublicCache } = require('../utils/httpCache');

const DIRECTORY_CACHE_MS = Number(process.env.SERVICES_DIRECTORY_CACHE_MS) || 300_000;

// SEO copy fallback when admin/seed hasn't written one. Computed at read time —
// never stored — so improving the template improves every un-curated card.
const fallbackDescription = (professionLabel, serviceName) =>
  `Book trusted ${professionLabel} professionals for ${serviceName} on Book A Sloth.`;

// GET /api/services-directory
const listProfessions = async (req, res) => {
  try {
    const payload = await responseCache.getOrSet('svcdir:index', DIRECTORY_CACHE_MS, async () => {
      const [{ data: profs, error: pErr }, { data: cats, error: cErr }] = await Promise.all([
        supabaseAdmin.from('categories')
          .select('slug, label, group_label, sort_order').eq('status', 'active')
          .order('sort_order', { ascending: true }),
        supabaseAdmin.from('service_categories')
          .select('primary_category').eq('is_active', true),
      ]);
      if (pErr) throw pErr;
      if (cErr) throw cErr;

      const counts = {};
      for (const c of cats || []) counts[c.primary_category] = (counts[c.primary_category] || 0) + 1;

      const groups = [];
      const byLabel = new Map();
      for (const p of profs || []) {
        if (!counts[p.slug]) continue; // no bookable services → no SEO page
        let g = byLabel.get(p.group_label);
        if (!g) { g = { group_label: p.group_label, professions: [] }; byLabel.set(p.group_label, g); groups.push(g); }
        g.professions.push({ slug: p.slug, label: p.label, serviceCount: counts[p.slug] });
      }
      return { groups };
    });
    setPublicCache(res, 300);
    res.json(payload);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/services-directory/:profession
const getProfession = async (req, res) => {
  try {
    const slug = String(req.params.profession || '').toLowerCase();
    const payload = await responseCache.getOrSet(`svcdir:${slug}`, DIRECTORY_CACHE_MS, async () => {
      const { data: prof, error: pErr } = await supabaseAdmin
        .from('categories').select('slug, label, group_label')
        .eq('slug', slug).eq('status', 'active').maybeSingle();
      if (pErr) throw pErr;
      if (!prof) return { notFound: true };

      let r = await supabaseAdmin
        .from('service_categories')
        .select('name, slug, description, icon')
        .eq('primary_category', slug).eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (r.error && /Could not find the|column .* does not exist/i.test(r.error.message)) {
        r = await supabaseAdmin
          .from('service_categories')
          .select('name, slug')
          .eq('primary_category', slug).eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true });
      }
      if (r.error) throw r.error;
      if (!r.data || r.data.length === 0) return { notFound: true };

      return {
        profession: prof,
        services: r.data.map((c) => ({
          name: c.name,
          slug: c.slug,
          description: c.description || fallbackDescription(prof.label, c.name),
          icon: c.icon || null,
        })),
      };
    });

    if (payload.notFound) return res.status(404).json({ message: 'Profession not found' });
    setPublicCache(res, 300);
    res.json(payload);
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { listProfessions, getProfession };
```

- [ ] **Step 4: Routes + mount:**

`server/routes/servicesDirectoryRoutes.js`:

```js
// Public, read-only — powers /services and /services/:profession SEO pages.
const express = require('express');
const sd = require('../controllers/servicesDirectoryController');

const router = express.Router();
router.get('/', sd.listProfessions);
router.get('/:profession', sd.getProfession);

module.exports = router;
```

`server/server.js` after line 146:

```js
app.use('/api/services-directory', require('./routes/servicesDirectoryRoutes'));
```

- [ ] **Step 5: Run tests** — file, then `npm test`. Expected: PASS (remember `responseCache.clear()` in `beforeEach`).

- [ ] **Step 6: Commit** — `git commit -m "feat(seo): services-directory API (index + per-profession payloads)" -- server/controllers/servicesDirectoryController.js server/routes/servicesDirectoryRoutes.js server/server.js server/tests/integration/servicesDirectory.int.test.js`

---

### Task 9: Real Explore listVendors with pair filter

**Files:**
- Modify: `server/controllers/exploreController.js` (`listVendors`, lines 15-45 only — leave every other handler untouched)
- Test: `server/tests/integration/exploreList.int.test.js` (create)

**Interfaces:**
- Produces: `GET /api/explore?category=<profession>&service=<slug>&q=&page=&limit=` → `{ vendors: [VendorCard shape], meta: { page, limit, total, hasMore }, filters }`. `service` is honored ONLY together with `category` (pair discipline — slug alone is ambiguous across professions); `service` without `category` → 400.

- [ ] **Step 1: Failing tests:**

```js
test('service filter without category → 400', async () => {
  const res = await request(app).get('/api/explore?service=wedding-photography');
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/requires.*category/i);
});

test('category+service returns mapped vendors', async () => {
  // mock profiles embedded query → one row:
  // { id:'h1', name:'Asha', username:'asha', tagline:'t', profile_image:'p.jpg',
  //   primary_category:'photographer',
  //   services:[{ price:999, rating:4.8, total_reviews:12, category:'wedding-photography',
  //               primary_category:'photographer', is_active:true }] }, count: 1
  const res = await request(app).get('/api/explore?category=photographer&service=wedding-photography');
  expect(res.status).toBe(200);
  expect(res.body.vendors).toHaveLength(1);
  expect(res.body.vendors[0]).toMatchObject({
    username: 'asha', category: 'photographer', minPrice: 999, reviewCount: 12,
  });
  expect(res.body.meta.total).toBe(1);
});
```

- [ ] **Step 2: Run to verify failure** (stub returns `vendors: []` / no 400).

- [ ] **Step 3: Implement `listVendors`:**

```js
const { supabaseAdmin } = require('../config/supabase');

const schemaMissing = (err) => err && /Could not find the|column .* does not exist/i.test(err.message || '');

// ── GET /api/explore ──────────────────────────────────────────
// Minimal real listing: verified hosts, profession (category) + service filters.
// `service` REQUIRES `category`: service slugs are only unique per profession
// (v3.60 pair model), so a slug-only filter could leak across professions.
async function listVendors(req, res) {
  try {
    const category = String(req.query.category || '').trim();
    const service  = String(req.query.service  || '').trim();
    const q        = String(req.query.q        || '').trim();
    const page     = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit    = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));

    if (service && !category) {
      return res.status(400).json({ message: 'service filter requires a category (profession)' });
    }

    const runQuery = (withPairCol) => {
      const svcCols = withPairCol
        ? 'price, rating, total_reviews, category, primary_category, is_active'
        : 'price, rating, total_reviews, category, is_active';
      let sel = supabaseAdmin
        .from('profiles')
        .select(`id, name, username, tagline, profile_image, primary_category, services!inner(${svcCols})`, { count: 'exact' })
        .eq('role', 'host')
        .eq('is_verified', true)
        .eq('is_banned', false)
        .not('username', 'is', null)
        .eq('services.is_active', true);
      if (category) sel = sel.eq('primary_category', category);
      if (service) {
        sel = sel.eq('services.category', service);
        if (withPairCol) sel = sel.eq('services.primary_category', category);
      }
      if (q) {
        const safe = q.replace(/[,()]/g, ' ');
        sel = sel.or(`name.ilike.%${safe}%,tagline.ilike.%${safe}%`);
      }
      return sel
        .order('updated_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
    };

    let r = await runQuery(true);
    if (schemaMissing(r.error)) r = await runQuery(false); // pre-v3.60
    if (r.error) throw r.error;

    const vendors = (r.data || []).map((p) => {
      const svcs = p.services || [];
      const rated = svcs.filter((s) => (s.total_reviews || 0) > 0);
      return {
        id: p.id,
        name: p.name,
        username: p.username,
        tagline: p.tagline || '',
        profileImage: p.profile_image || null,
        category: p.primary_category || '',
        avgRating: rated.length
          ? Number((rated.reduce((a, s) => a + Number(s.rating || 0), 0) / rated.length).toFixed(1))
          : null,
        reviewCount: svcs.reduce((a, s) => a + (s.total_reviews || 0), 0),
        minPrice: svcs.length ? Math.min(...svcs.map((s) => Number(s.price) || 0)) : null,
        currency: 'INR',
        isFeatured: false, isSponsored: false, isBoosted: false,
        isVerified: true, // listing already filters is_verified=true
      };
    });

    const total = r.count || 0;
    return res.json({
      vendors,
      meta: { page, limit, total, hasMore: page * limit < total },
      filters: { category, service, q },
    });
  } catch (err) {
    console.error('[explore.listVendors]', err);
    return res.status(500).json({ message: 'Failed to load hosts' });
  }
}
```

(Replace the `supabase` import usage for this handler with `supabaseAdmin` — public read through service_role mirrors the other public controllers; keep the existing `supabase` import for the untouched handlers.)

- [ ] **Step 4: Run tests** — file, then full suite. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(explore): real listVendors with profession+service pair filter"`

---

### Task 10: Professions sitemap child

**Files:**
- Modify: `server/services/sitemapService.js`, `server/controllers/sitemapController.js`, `server/routes/sitemapRoutes.js`

**Interfaces:**
- Produces: `/sitemap-professions.xml` (urlset: `/services` + one URL per profession with ≥1 active category); referenced from `/sitemap.xml` index.

- [ ] **Step 1: sitemapService** — add fetcher + mapper, export both:

```js
// Professions that own ≥1 active bookable-service category → /services/:slug pages.
const fetchProfessions = async () => {
  const { data, error } = await supabaseAdmin
    .from('service_categories')
    .select('primary_category, updated_at')
    .eq('is_active', true);
  if (error) throw error;
  const newest = new Map();
  for (const r of data || []) {
    const prev = newest.get(r.primary_category);
    if (!prev || (r.updated_at && r.updated_at > prev)) newest.set(r.primary_category, r.updated_at);
  }
  return [...newest.entries()].map(([slug, updated_at]) => ({ slug, updated_at }));
};

const professionEntries = (rows, siteUrl) => {
  const site = trimSlash(siteUrl);
  return [
    { loc: `${site}/services`, changefreq: 'weekly', priority: '0.6' },
    ...(rows || []).map((r) => ({
      loc: `${site}/services/${r.slug}`,
      lastmod: toLastmod(r.updated_at),
      changefreq: 'weekly',
      priority: '0.6',
    })),
  ];
};
```

Add `fetchProfessions, professionEntries` to `module.exports`.

- [ ] **Step 2: sitemapController** — extend `loadEntries` (add `fetchProfessions()` to the `Promise.all`, add `professions: professionEntries(professions, site)` to `value`), add index child + handler:

```js
  children.push({ loc: `${site}/sitemap-professions.xml`, lastmod: newestLastmod(entries.professions) });
```

```js
const sitemapProfessions = (req, res) => serveCached(req, res, (entries) => buildUrlset(entries.professions));
```

Export `sitemapProfessions`. Update the destructured import from sitemapService to include the two new names.

- [ ] **Step 3: sitemapRoutes** — read the file, add next to the existing children:

```js
router.get('/sitemap-professions.xml', sitemapProfessions);
```

- [ ] **Step 4: Run server tests** (`npm test`) — existing sitemap tests must still pass; if a sitemap test asserts the exact index children list, extend the expectation with the professions child.

- [ ] **Step 5: Commit** — `git commit -am "feat(seo): professions sitemap child"`

---

### Task 11: Client plumbing — api, reserved segment, routes

**Files:**
- Modify: `client/src/services/api.js`, `client/src/config/reservedSegments.js`, `client/src/App.jsx`

**Interfaces:**
- Produces: `getServicesDirectory()`, `getProfessionServices(slug)` fetchers; routes `/services` → `ServicesDirectory`, `/services/:profession` → `ProfessionServices` (pages created in Task 12 — create placeholder files in this task so the build stays green).

- [ ] **Step 1: api.js** — next to `listServiceCategories` (line ~204):

```js
export const getServicesDirectory   = ()     => API.get('/services-directory');
export const getProfessionServices  = (slug) => API.get(`/services-directory/${slug}`);
```

- [ ] **Step 2: reservedSegments.js** — add `'services'` to the array (line 12 group).

- [ ] **Step 3: App.jsx** — add lazy imports beside the other public pages (~line 44):

```jsx
const ServicesDirectory  = lazy(() => import('./pages/services/ServicesDirectory'));
const ProfessionServices = lazy(() => import('./pages/services/ProfessionServices'));
```

and the two routes next to the other public `<Route>` entries (exact placement: beside `/explore`):

```jsx
<Route path="/services" element={<ServicesDirectory />} />
<Route path="/services/:profession" element={<ProfessionServices />} />
```

- [ ] **Step 4: Placeholder pages** so the build compiles (replaced in Task 12):

`client/src/pages/services/ServicesDirectory.jsx` and `ProfessionServices.jsx`, each:

```jsx
export default function ServicesDirectory() { return null; }
```

- [ ] **Step 5: Build** — `cd client && npm run build`. Expected: success. Run `npm test` — the route-manifest sync test must pass with the new segment.

- [ ] **Step 6: Commit** — `git commit -am "feat(seo): /services routes + api fetchers + reserved segment"`

---

### Task 12: SEO pages + card component

**Files:**
- Create: `client/src/config/professionIcons.js`, `client/src/components/services/ServiceCategoryCard.jsx`
- Modify (replace placeholders): `client/src/pages/services/ServicesDirectory.jsx`, `client/src/pages/services/ProfessionServices.jsx`
- Test: `client/src/tests/ServiceCategoryCard.test.jsx`, `client/src/tests/ProfessionServices.test.jsx`

**Interfaces:**
- Consumes: Task 8 payload shapes, Task 11 fetchers.
- Produces: card CTA href format `/explore?category=<profession>&service=<slug>` (Task 13 consumes these params).

- [ ] **Step 1: Failing tests:**

`client/src/tests/ServiceCategoryCard.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceCategoryCard from '../components/services/ServiceCategoryCard';

const svc = { name: 'Wedding Photography', slug: 'wedding-photography', description: 'Capture your day.', icon: null };

test('renders name, description and CTA link with pair params', () => {
  render(<MemoryRouter><ServiceCategoryCard service={svc} profession="photographer" /></MemoryRouter>);
  expect(screen.getByText('Wedding Photography').tagName).toBe('H3');
  expect(screen.getByText('Capture your day.')).toBeInTheDocument();
  const cta = screen.getByRole('link', { name: /find professionals/i });
  expect(cta.getAttribute('href')).toBe('/explore?category=photographer&service=wedding-photography');
});
```

`client/src/tests/ProfessionServices.test.jsx` (mock api like `ServiceForm.test.jsx` does):

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  getProfessionServices: vi.fn(),
}));
import { getProfessionServices } from '../services/api';
import ProfessionServices from '../pages/services/ProfessionServices';

test('renders profession hero + one card per service', async () => {
  getProfessionServices.mockResolvedValue({ data: {
    profession: { slug: 'photographer', label: 'Photographer', group_label: 'Creative' },
    services: [
      { name: 'Wedding Photography', slug: 'wedding-photography', description: 'd1', icon: null },
      { name: 'Drone Photography',   slug: 'drone-photography',   description: 'd2', icon: null },
    ],
  }});
  render(
    <MemoryRouter initialEntries={['/services/photographer']}>
      <Routes><Route path="/services/:profession" element={<ProfessionServices />} /></Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Photographer/));
  expect(screen.getAllByRole('link', { name: /find professionals/i })).toHaveLength(2);
});
```

- [ ] **Step 2: Run to verify failure** — `cd client && npx vitest run src/tests/ServiceCategoryCard.test.jsx src/tests/ProfessionServices.test.jsx`.

- [ ] **Step 3: `professionIcons.js`:**

```js
// Profession slug → lucide icon. Per-service override comes from
// service_categories.icon (a key in SERVICE_ICONS); profession icon is the fallback.
import {
  Camera, Code, Briefcase, Salad, Brain, Megaphone, PenTool, Languages,
  Landmark, Figma, Sparkles, Video, Mic, Music, HeartPulse, GraduationCap,
} from 'lucide-react';

export const PROFESSION_ICONS = {
  photographer: Camera,
  videographer: Video,
  'software-engineer': Code,
  'ai-engineer': Code,
  'data-scientist': Code,
  'career-coach': Briefcase,
  'business-coach': Briefcase,
  'startup-advisor': Briefcase,
  nutritionist: Salad,
  psychologist: Brain,
  'digital-marketer': Megaphone,
  'social-media-manager': Megaphone,
  'graphic-designer': PenTool,
  'ux-designer': Figma,
  'language-tutor': Languages,
  'ielts-coach': GraduationCap,
  'financial-advisor': Landmark,
  'voice-artist': Mic,
  'music-producer': Music,
  'speech-therapist': HeartPulse,
};

export const SERVICE_ICONS = {
  camera: Camera, code: Code, briefcase: Briefcase, salad: Salad, brain: Brain,
  megaphone: Megaphone, pen: PenTool, languages: Languages, bank: Landmark,
  figma: Figma, video: Video, mic: Mic, music: Music, health: HeartPulse,
  graduation: GraduationCap,
};

export const iconFor = (profession, serviceIcon) =>
  (serviceIcon && SERVICE_ICONS[serviceIcon]) || PROFESSION_ICONS[profession] || Sparkles;
```

- [ ] **Step 4: `ServiceCategoryCard.jsx`** — copy the card shell classes (border, rounding, shadow, dark-mode) from `client/src/components/guest/VendorCard.jsx` so the two cards are visually siblings:

```jsx
// ServiceCategoryCard — one bookable service on a /services/:profession SEO page.
// Visual sibling of VendorCard (same border/rounding tokens).
import { Link } from 'react-router-dom';
import { iconFor } from '../../config/professionIcons';

export default function ServiceCategoryCard({ service, profession }) {
  const Icon = iconFor(profession, service.icon);
  return (
    <div className="flex flex-col gap-3 rounded-xl border-4 border-black bg-white p-5 dark:bg-gray-900 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <span className="rounded-xl border-4 border-black p-2 dark:border-gray-700">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="font-heading text-lg font-bold text-gray-900 dark:text-white">{service.name}</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{service.description}</p>
      <Link
        to={`/explore?category=${encodeURIComponent(profession)}&service=${encodeURIComponent(service.slug)}`}
        className="btn-primary mt-auto text-center"
      >
        Find Professionals
      </Link>
    </div>
  );
}
```

(Adjust `btn-primary` / `font-heading` to whatever utility classes VendorCard and the design-system CSS actually use — check `client/src/styles/`; do NOT invent new colors.)

- [ ] **Step 5: `ProfessionServices.jsx`:**

```jsx
// /services/:profession — SEO landing page: every bookable service for one profession.
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Seo from '../../components/common/Seo';
import { SITE_URL } from '../../utils/seo';
import ServiceCategoryCard from '../../components/services/ServiceCategoryCard';
import { getProfessionServices } from '../../services/api';

export default function ProfessionServices() {
  const { profession } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProfessionServices(profession)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err?.response?.status === 404) navigate('/404', { replace: true });
        else setData({ error: true });
      })
      .finally(() => setLoading(false));
  }, [profession, navigate]);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16">Loading…</div>;
  if (!data || data.error) return <div className="mx-auto max-w-6xl px-4 py-16">Could not load this page. Please retry.</div>;

  const { profession: prof, services } = data;
  const canonical = `${SITE_URL}/services/${prof.slug}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: services.map((s, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'Service', name: s.name, description: s.description,
                url: `${SITE_URL}/explore?category=${prof.slug}&service=${s.slug}` },
      })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Services', item: `${SITE_URL}/services` },
        { '@type': 'ListItem', position: 2, name: prof.label, item: canonical },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Seo
        title={`${prof.label} Services — Book Online | Book A Sloth`}
        description={`Browse ${services.length} bookable ${prof.label.toLowerCase()} services — ${services.slice(0, 3).map((s) => s.name).join(', ')} and more. Compare hosts and book online.`}
        canonical={canonical}
        jsonLd={jsonLd}
      />
      <nav className="mb-6 text-sm text-gray-500">
        <Link to="/services" className="hover:underline">Services</Link> / {prof.label}
      </nav>
      <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white md:text-4xl">
        {prof.label} services you can book today
      </h1>
      <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-300">
        Every service below is offered by verified {prof.label.toLowerCase()} hosts on Book A Sloth.
        Pick one to see professionals, prices and reviews.
      </p>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <ServiceCategoryCard key={s.slug} service={s} profession={prof.slug} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `ServicesDirectory.jsx`:**

```jsx
// /services — SEO index of all professions that have bookable services.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../../components/common/Seo';
import { SITE_URL } from '../../utils/seo';
import { getServicesDirectory } from '../../services/api';
import { iconFor } from '../../config/professionIcons';

export default function ServicesDirectory() {
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    getServicesDirectory().then((res) => setGroups(res.data.groups)).catch(() => setGroups([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Seo
        title="Browse Services by Profession | Book A Sloth"
        description="Find bookable services from photographers, coaches, designers, tutors and more — compare professionals and book online."
        canonical={`${SITE_URL}/services`}
      />
      <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white md:text-4xl">
        What do you want to get done?
      </h1>
      {groups === null ? (
        <div className="py-16">Loading…</div>
      ) : (
        groups.map((g) => (
          <section key={g.group_label} className="mt-10">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">{g.group_label}</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {g.professions.map((p) => {
                const Icon = iconFor(p.slug, null);
                return (
                  <Link key={p.slug} to={`/services/${p.slug}`}
                        className="flex items-center gap-3 rounded-xl border-4 border-black bg-white p-4 hover:-translate-y-0.5 transition dark:bg-gray-900 dark:border-gray-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-gray-900 dark:text-white">{p.label}</span>
                      <span className="block text-xs text-gray-500">{p.serviceCount} services</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run tests + build** — `npx vitest run src/tests/ServiceCategoryCard.test.jsx src/tests/ProfessionServices.test.jsx`, then full `npm test` and `npm run build`. Expected: PASS.

- [ ] **Step 8: Commit** — `git commit -am "feat(seo): /services directory + /services/:profession landing pages"`

---

### Task 13: Explore un-stub + service filter

**Files:**
- Modify: `client/src/pages/Explore.jsx`

**Interfaces:**
- Consumes: `/api/explore` real response (Task 9) via existing `getExploreVendors`; URL params `category`, `service`, `q` (Task 12 links).

- [ ] **Step 1: Flip the flag** — line 33: `const COMING_SOON = false;`

- [ ] **Step 2: Real data** — in `ExploreFull`:
  - Add state: `const [service, setService] = useState(searchParams.get('service') || '');`
  - URL sync effect: include `if (service) params.service = service;` and add `service` to the dependency array.
  - Replace the mock-filtering body of `loadVendors` with the real call:

```jsx
  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExploreVendors({ q: query, category, service, sort, page, limit: PAGE_SIZE });
      setVendors(res.data.vendors);
      setTotalVendors(res.data.meta.total);
    } catch {
      setVendors([]);
      setTotalVendors(0);
    } finally {
      setLoading(false);
    }
  }, [query, category, service, sort, page]);
```

  - Initial state for `categories/featured/vendors/collections`: start from `[]` instead of the `MOCK_*` constants; keep the `MOCK_*` definitions in place (other sections still reference their shapes) but nothing renders from them by default. Featured/collections sections must render only when their arrays are non-empty (add `featured.length > 0 &&` / `collections.length > 0 &&` guards if not already conditional).
  - Load real categories: in a mount effect, `getExploreCategories().then(res => setCategories(res.data.categories)).catch(() => {})`.

- [ ] **Step 3: Service filter chip** — near the category filter UI, when `service` is set render a removable chip:

```jsx
  {service && (
    <button onClick={() => { setService(''); setPage(1); }}
            className="inline-flex items-center gap-1 rounded-xl border-4 border-black px-3 py-1 text-sm dark:border-gray-700">
      {service.replace(/-/g, ' ')} <X className="h-3 w-3" aria-hidden="true" />
    </button>
  )}
```

Also reset `service` inside `handleCategory` when the category changes (`setService('')`) — a service slug from another profession must never survive a profession switch (client-side mirror of the API's pair rule).

- [ ] **Step 4: Verify in browser** — `preview_start` client dev server; open `/explore?category=photographer&service=wedding-photography`; confirm no console errors, chip visible, empty-state renders when API returns zero. Screenshot.

- [ ] **Step 5: Client tests + build** — `npm test && npm run build`. If an existing Explore test asserts the coming-soon rendering, update it to the new behavior.

- [ ] **Step 6: Commit** — `git commit -am "feat(explore): go live with real listing + service filter chip"`

---

### Task 14: Admin fields + host toast

**Files:**
- Modify: `client/src/pages/admin/AdminServiceCategories.jsx`, `client/src/components/dashboard/CategoriesSection.jsx`

- [ ] **Step 1: AdminServiceCategories** — read the file first. In its create form and row-edit form, add two inputs bound to the same state pattern the `name` field uses:
  - `description` — `<textarea rows={2} maxLength={200}>`, label "SEO description (shown on /services pages; empty = auto template)".
  - `icon` — text input, label "Icon key (optional, e.g. camera)".
  Send both through the existing `adminCreateServiceCategory` / `adminUpdateServiceCategory` calls (API client passes body verbatim — no change needed there).

- [ ] **Step 2: CategoriesSection toast** — at the save handler (line ~52), the response now carries `services_cleared`. Extend the existing success feedback:

```jsx
      const { data } = await hostUpdateCategories({ primary_category: primary, categories: selected });
      if (data.services_cleared > 0) {
        // reuse the component's existing success/message mechanism
        setMsg(`Profession updated. ${data.services_cleared} of your services need a new category — edit them to pick one.`);
      }
```

(Adapt `setMsg` to the component's actual message state; read the file before editing.)

- [ ] **Step 3: Client tests + build** — `npm test && npm run build`. Fix `ProfileCategories.test.jsx` mock if it asserts the exact response shape (add `services_cleared: 0`).

- [ ] **Step 4: Commit** — `git commit -am "feat(admin+host): category SEO fields; de-categorised toast"`

---

### Task 15: Docs

**Files:**
- Modify: `docs/database-schema.md` (services + service_categories sections: new columns, both FKs, CHECK, index, v3.60 in migration list), `docs/feature-map.md` (Service Categories + SEO pages rows → new files), `docs/current-work.md` (entry: this feature, migration status "v3.60 PENDING both DBs" until Task 16 flips it).

- [ ] **Step 1: Make the three edits.** Match each doc's existing table/format conventions exactly.
- [ ] **Step 2: Commit** — `git commit -am "docs: v3.60 schema, feature map + current work for service-category redesign"`

---

### Task 16: Verification + rollout gate

**Files:** none new.

- [ ] **Step 1: Full suites** — `cd server && npm test` then `cd client && npm test && npm run build`. All green (report any pre-existing failures separately).
- [ ] **Step 2: STOP — user gate.** (Corrected rollout order: server deploys BEFORE the migration. Old server code writes `category` without `primary_category`; applying v3.60 against it would make the new CHECK `chk_category_pair` 500 every categorised service write -- 23514 is not matched by any legacy-retry regex.) Migration + seed touch live DBs. Order: **(1)** merge + deploy the SERVER first (code is forward-compatible via 42703 fallbacks). **(2)** Present to the user: apply `v3.60_service_category_integrity.sql` in Supabase SQL Editor on **staging Tokyo first**, sanity-check (`SELECT count(*) FROM services WHERE category IS NOT NULL AND primary_category IS NULL;` → must be 0; spot-check a photographer's picker), then **prod Mumbai** -- run once per DB top-to-bottom (the whole file is one transaction: safe to retry a FAILED run from the top, never re-run after COMMIT). **(3)** Run `node server/scripts/seedServiceCategories.js` against each DB. **(4)** Deploy the client (may also ride the server deploy -- SEO pages/Explore degrade gracefully pre-migration). Do not run the DB steps without explicit user confirmation.
- [ ] **Step 3: After confirmation** — update `docs/current-work.md` + `CLAUDE.md` migration status to "v3.60 applied both DBs (date)".
- [ ] **Step 4: Final commit + PR** — use superpowers:finishing-a-development-branch.

---

## Self-Review Notes

- Spec coverage: F1–F6 → Tasks 1–6; profession change → Task 5; seed/descriptions → Task 7; directory API → Task 8; minimal search → Tasks 9+13; sitemap → Task 10; pages/cards/icons → Tasks 11–12; admin + toast → Task 14; docs → Task 15; rollout → Task 16.
- Type consistency: `chk.primary` (Tasks 2→3→4); `services_cleared` (Tasks 5→14); cache namespaces `svccat:`/`svcdir:` (Tasks 6→8); CTA URL `/explore?category=&service=` (Tasks 9→12→13); payload field names `description`/`icon` everywhere.
- Deliberate pointers (not placeholders): mock-wiring style in existing test files, VendorCard CSS classes, CategoriesSection message state — each names the exact file to copy from.
