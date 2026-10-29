# Service Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every service a `category` (a slug drawn from the host's own registered categories), captured in both service-creation paths (onboarding + dashboard) and shown as a badge.

**Architecture:** Add a nullable `category` slug column to `services`. A shared pure validator (`server/lib/serviceCategory.js`, mirroring the existing `categoryRules.js`) enforces that a service's category is one of the host's `profiles.categories`; it is called from **both** service-creation backends — `serviceController` (`/services`, dashboard) and `hostController` (`/host/services`, onboarding). The client adds a small `ServiceCategoryPicker` (auto-assigns when the host has one category, single-select chips when 2–3), wired into `ServiceForm` and `FirstServiceStep`, both sourcing the host's categories from the existing `GET /host/categories`. The public service page resolves the slug→label server-side; the dashboard resolves it client-side.

**Tech Stack:** Node/Express, Supabase (PostgREST), Jest + Supertest (server), React + Vite, Vitest + React Testing Library (client).

**Reference spec:** `docs/superpowers/specs/2026-06-20-service-categories-design.md`

---

## Context already verified (do not re-investigate)

- `services` table has **no** `category` column ([server/config/schema.sql:45](../../../server/config/schema.sql)).
- Host categories (post PR #107) live in `profiles.categories` (JSONB slug array, primary-first) + `profiles.primary_category`. Plan caps: free 0 / creator 1 / pro 3.
- `GET /host/categories` → `{ primary_category, categories }` ([hostController.js:280](../../../server/controllers/hostController.js)). Client helper: `hostGetCategories()` ([api.js:187](../../../client/src/services/api.js)). `getCategories()` → full active list with `{slug,label,group_label}` ([api.js:181](../../../client/src/services/api.js)).
- **Two** service-create backends, both write the `services` table:
  - `/services` POST/PUT → `serviceController.createService`/`updateService` ([serviceController.js:191,250](../../../server/controllers/serviceController.js)); dashboard `ServiceForm` uses `svcCreate`/`svcUpdate`.
  - `/host/services` POST/PUT → `hostController.createService`/`updateService` ([hostController.js:341,379](../../../server/controllers/hostController.js)); onboarding `FirstServiceStep` uses `createService`.
  - Both derive `host_id = req.user.id` and are behind `protect` (so onboarding step 9 is authenticated).
- `serviceController` reads use `V2_SELECT_COLS` with a broad `schemaMissing` fallback ([serviceController.js:90,107](../../../server/controllers/serviceController.js)). Public service page path: `svcGetPublicByProfile` → `getPublicServiceByProfileAndSlug` → `fetchPublicServiceSeo` (uses `V2_SELECT_COLS`) ([serviceController.js:408,110](../../../server/controllers/serviceController.js)).
- `hostController.insertServiceSafe`/`updateServiceSafe` ([hostController.js:42,68](../../../server/controllers/hostController.js)) only strip `grace_period_minutes`/`thumbnail_url` on a schema-cache miss — a missing `category` column would **not** be caught (landmine). Must broaden.
- `getHostProfile` already resolves a slug→label server-side (`primary_category_label`, [hostController.js:163](../../../server/controllers/hostController.js)) — mirror this for the service category label.
- Test patterns: server integration uses `jest.mock('../../middleware/authMiddleware', ...)` + `makeSbMock` + `supabaseAdmin.from.mockReturnValueOnce(...)` ([server/tests/integration/vendor.test.js:1-41](../../../server/tests/integration/vendor.test.js), [helpers.js](../../../server/tests/integration/helpers.js)). Client uses Vitest + RTL with `vi.mock('../services/api', ...)` ([client/src/tests/CategoryStep.test.jsx](../../../client/src/tests/CategoryStep.test.jsx), [categoryUtils.test.js](../../../client/src/tests/categoryUtils.test.js)).

## File map

**Create**
- `server/migrations/v3.22_service_category.sql` — schema change.
- `server/lib/serviceCategory.js` — pure validator + async load-and-validate.
- `server/tests/serviceCategory.test.js` — unit tests for the pure validator.
- `server/tests/integration/serviceCategory.int.test.js` — both create paths, valid + invalid.
- `client/src/components/services/ServiceCategoryPicker.jsx` — the picker.
- `client/src/tests/ServiceCategoryPicker.test.jsx` — picker tests.

**Modify**
- `server/controllers/serviceController.js` — `V2_SELECT_COLS` + validate in create/update + public label.
- `server/controllers/hostController.js` — validate in create/update + broaden safe-fallback.
- `client/src/utils/categoryUtils.js` — add `categoryLabel`.
- `client/src/tests/categoryUtils.test.js` — test `categoryLabel`.
- `client/src/pages/services/ServiceForm.jsx` — fetch host categories, render picker, send `category`.
- `client/src/pages/onboarding/FirstServiceStep.jsx` — same.
- `client/src/pages/Services.jsx` — category badge in the service row.
- `client/src/pages/ServiceDetail.jsx` — category badge from `category_label`.
- `docs/current-work.md` — note the change.

---

## Task 1: Database migration v3.22

**Files:**
- Create: `server/migrations/v3.22_service_category.sql`

- [ ] **Step 1: Write the migration**

```sql
-- v3.22 — Service category
-- Each service carries one category slug, drawn from the host's own
-- profiles.categories. Nullable so existing rows stay valid (no backfill).
BEGIN;

ALTER TABLE services ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS services_category_idx ON services(category);

COMMIT;
```

- [ ] **Step 2: Apply to BOTH Supabase projects**

Use the Supabase MCP. First `list_projects` to get the two refs (per project memory the dashboard names are inverted: Mumbai = real prod, Tokyo = staging). Run `apply_migration` with name `v3_22_service_category` and the SQL above on **each** project.

- [ ] **Step 3: Verify the column exists on both**

Run via MCP `execute_sql` on each project:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'services' AND column_name = 'category';
```
Expected: one row (`category`) on both.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/v3.22_service_category.sql
git commit -m "feat(db): v3.22 — add services.category column + index"
```

---

## Task 2: Pure category validator library

**Files:**
- Create: `server/lib/serviceCategory.js`
- Test: `server/tests/serviceCategory.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/tests/serviceCategory.test.js
const { validateServiceCategory } = require('../lib/serviceCategory');

describe('validateServiceCategory', () => {
  const host = ['career-coach', 'life-coach'];

  test('accepts a category the host owns', () => {
    expect(validateServiceCategory({ category: 'career-coach', hostCategories: host }))
      .toEqual({ ok: true, value: 'career-coach' });
  });

  test('rejects a category the host does not own', () => {
    const r = validateServiceCategory({ category: 'dentist', hostCategories: host });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('required + host has categories + none given → 400', () => {
    const r = validateServiceCategory({ category: '', hostCategories: host, required: true });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  test('not required + none given → ok with null (unchanged)', () => {
    expect(validateServiceCategory({ category: undefined, hostCategories: host }))
      .toEqual({ ok: true, value: null });
  });

  test('host has no categories on record → drops value, ok null', () => {
    expect(validateServiceCategory({ category: 'anything', hostCategories: [], required: true }))
      .toEqual({ ok: true, value: null });
  });

  test('trims whitespace before matching', () => {
    expect(validateServiceCategory({ category: '  life-coach ', hostCategories: host }))
      .toEqual({ ok: true, value: 'life-coach' });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd server && npx jest tests/serviceCategory.test.js`
Expected: FAIL — `Cannot find module '../lib/serviceCategory'`.

- [ ] **Step 3: Implement the library**

```javascript
// server/lib/serviceCategory.js
// A service must sit inside one of the host's own categories (profiles.categories).
// See docs/superpowers/specs/2026-06-20-service-categories-design.md.

// Pure decision. required=true → a category MUST be chosen when the host has any
// (create). required=false → only validate membership when one is provided
// (update, where an absent category means "leave unchanged").
function validateServiceCategory({ category, hostCategories, required = false }) {
  const host = Array.isArray(hostCategories) ? hostCategories.filter(Boolean) : [];
  const value = typeof category === 'string' ? category.trim() : '';

  if (!value) {
    if (required && host.length) {
      return { ok: false, status: 400, message: 'A service category is required' };
    }
    return { ok: true, value: null };
  }
  // No categories on record → nothing to validate against; drop it silently.
  if (!host.length) return { ok: true, value: null };
  if (!host.includes(value)) {
    return { ok: false, status: 400, message: `"${value}" is not one of your categories` };
  }
  return { ok: true, value };
}

// Load the host's categories, then validate. supabaseAdmin is injected so the
// pure logic above stays unit-testable without a DB.
async function resolveAndValidateCategory(supabaseAdmin, hostId, category, opts = {}) {
  let hostCategories = [];
  const { data } = await supabaseAdmin
    .from('profiles').select('categories, primary_category').eq('id', hostId).single();
  if (data) {
    if (Array.isArray(data.categories) && data.categories.length) hostCategories = data.categories;
    else if (data.primary_category) hostCategories = [data.primary_category];
  }
  return validateServiceCategory({ category, hostCategories, required: !!opts.required });
}

module.exports = { validateServiceCategory, resolveAndValidateCategory };
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd server && npx jest tests/serviceCategory.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/serviceCategory.js server/tests/serviceCategory.test.js
git commit -m "feat(categories): pure service-category validator + load helper"
```

---

## Task 3: Wire serviceController (`/services` — dashboard path)

**Files:**
- Modify: `server/controllers/serviceController.js`
- Test: `server/tests/integration/serviceCategory.int.test.js` (created here)

- [ ] **Step 1: Write the failing integration test**

```javascript
// server/tests/integration/serviceCategory.int.test.js
jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, _res, next) => { req.user = { id: 'vendor-uuid' }; next(); },
}));
jest.mock('../../middleware/planMiddleware', () => ({
  attachPlan:        (_r, _s, n) => n(),
  checkServiceLimit: (_r, _s, n) => n(),
}));
jest.mock('../../middleware/featureMiddleware', () => ({
  requireFeature: () => (_r, _s, n) => n(),
}));

const request  = require('supertest');
const express  = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const serviceRoutes = require('../../routes/serviceRoutes');

const app = express();
app.use(express.json());
app.use('/api/services', serviceRoutes);

// chainable stub whose terminal (single/maybeSingle) resolves `resolved`
const chain = (resolved) => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  neq:    jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue(resolved),
  maybeSingle: jest.fn().mockResolvedValue(resolved),
});

afterEach(() => jest.clearAllMocks());

describe('POST /api/services — category validation', () => {
  test('201 — persists a category the host owns', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: { categories: ['career-coach'], primary_category: 'career-coach' }, error: null })) // profiles load
      .mockReturnValueOnce(chain({ data: null, error: null })) // uniqueSlug check (slug free)
      .mockReturnValueOnce(chain({ data: { id: 'svc-9', category: 'career-coach' }, error: null })); // insert
    const res = await request(app).post('/api/services')
      .send({ title: 'Resume Review', category: 'career-coach', price: 500, duration: 30 });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('career-coach');
  });

  test('400 — category the host does not own', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: { categories: ['career-coach'], primary_category: 'career-coach' }, error: null }));
    const res = await request(app).post('/api/services')
      .send({ title: 'Tattoo', category: 'tattoo-artist', price: 500, duration: 30 });
    expect(res.status).toBe(400);
  });
});
```

> Note: if `requireFeature` lives in a different module than `../../middleware/featureMiddleware`, grep `serviceRoutes.js` for its import path and fix the `jest.mock` target. (serviceRoutes guards `protect` only on some routes — confirm and mock whatever middleware POST `/services` uses.)

- [ ] **Step 2: Run it, verify it fails**

Run: `cd server && npx jest tests/integration/serviceCategory.int.test.js`
Expected: FAIL — the 201 test gets `category: undefined` (not yet persisted) and/or the 400 test returns 201.

- [ ] **Step 3: Add `category` to the select columns**

In `server/controllers/serviceController.js`, append `category` to `V2_SELECT_COLS` (line ~90):

```javascript
const V2_SELECT_COLS =
  'id,host_id,title,slug,short_description,long_description,description,' +
  'meeting_mode,type,price,duration,currency,grace_period_minutes,thumbnail_url,' +
  'included_items,excluded_items,faqs,important_note,rating,total_reviews,total_bookings,' +
  'category,is_active,created_at,updated_at';
```

- [ ] **Step 4: Require the helper and validate in create + update**

At the top of `serviceController.js`, add the import next to the other requires:
```javascript
const { resolveAndValidateCategory } = require('../lib/serviceCategory');
```

In `createService` (after the title check, before `slugify`):
```javascript
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    // Service must sit inside one of the host's categories.
    const chk = await resolveAndValidateCategory(supabaseAdmin, req.user.id, req.body.category, { required: true });
    if (!chk.ok) return res.status(chk.status).json({ message: chk.message });

    const baseSlug = slugify(title);
    const slug = await uniqueSlug(baseSlug, req.user.id);

    const p = buildPayload(req.body);
    p.category = chk.value;
    p.host_id  = req.user.id;
```
(Leave the rest of `createService` unchanged. Do **not** add `category` to `buildPayload` — keeping it out means the only way it reaches the DB is through the validated `chk.value`.)

In `updateService` (after `const updates = buildPayload(req.body);`):
```javascript
    const updates = buildPayload(req.body);
    if (req.body.category !== undefined) {
      const chk = await resolveAndValidateCategory(supabaseAdmin, req.user.id, req.body.category, { required: false });
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      updates.category = chk.value;
    }
    updates.updated_at = new Date().toISOString();
```

- [ ] **Step 5: Resolve the slug→label on the public read**

In `getPublicServiceByProfileAndSlug` (~line 420), after the service is fetched and before it is returned, add a best-effort label lookup. Locate the line that does `const r = await fetchPublicServiceSeo({ hostId: vendor.id, slug: serviceSlug });` and the subsequent 404 guard, then insert before the success `res.json(...)`:

```javascript
    const service = r.data;
    if (service && service.category) {
      const { data: cat } = await supabaseAdmin
        .from('categories').select('label').eq('slug', service.category).maybeSingle();
      service.category_label = cat?.label || null;
    }
```
Ensure the object passed to `res.json` is this `service` (it already is `r.data` — assign through the `service` variable).

- [ ] **Step 6: Run the test, verify it passes**

Run: `cd server && npx jest tests/integration/serviceCategory.int.test.js`
Expected: PASS (both tests).

- [ ] **Step 7: Commit**

```bash
git add server/controllers/serviceController.js server/tests/integration/serviceCategory.int.test.js
git commit -m "feat(services): validate + persist category on /services; public category_label"
```

---

## Task 4: Wire hostController (`/host/services` — onboarding path)

**Files:**
- Modify: `server/controllers/hostController.js`
- Test: `server/tests/integration/serviceCategory.int.test.js` (extend)

- [ ] **Step 1: Add failing tests for the host path**

Append to `server/tests/integration/serviceCategory.int.test.js`. Add `hostRoutes` to the app at the top (under the existing `app.use`):
```javascript
const hostRoutes = require('../../routes/hostRoutes');
app.use('/api/host', hostRoutes);
```
Then add:
```javascript
describe('POST /api/host/services — category validation', () => {
  test('201 — persists a category the host owns', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: { categories: ['life-coach'], primary_category: 'life-coach' }, error: null })) // profiles load
      .mockReturnValueOnce(chain({ data: { id: 'svc-h', category: 'life-coach' }, error: null })); // insert
    const res = await request(app).post('/api/host/services')
      .send({ title: 'Life Session', category: 'life-coach', price: 0, duration: 45 });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('life-coach');
  });

  test('400 — category the host does not own', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: { categories: ['life-coach'], primary_category: 'life-coach' }, error: null }));
    const res = await request(app).post('/api/host/services')
      .send({ title: 'Nope', category: 'dentist', price: 0, duration: 45 });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, verify the new tests fail**

Run: `cd server && npx jest tests/integration/serviceCategory.int.test.js`
Expected: FAIL on the two `/host/services` tests.

- [ ] **Step 3: Require the helper**

At the top of `hostController.js` (it already requires `validateCategorySelection`), add:
```javascript
const { resolveAndValidateCategory } = require('../lib/serviceCategory');
```

- [ ] **Step 4: Validate + persist in createService**

In `hostController.createService` (line ~341), add validation before building `payload`, and add `category` to the payload:
```javascript
const createService = async (req, res) => {
  try {
    // Service must sit inside one of the host's categories.
    const chk = await resolveAndValidateCategory(supabaseAdmin, req.user.id, req.body.category, { required: true });
    if (!chk.ok) return res.status(chk.status).json({ message: chk.message });

    const {
      title, description, type, meeting_mode, duration, price, currency,
      thumbnail_url, grace_period_minutes,
    } = req.body;
    const payload = {
      host_id: req.user.id,
      title,
      description: description || "",
      type: type || "one_on_one",
      meeting_mode: meeting_mode || "online",
      duration: parseInt(duration) || 30,
      price: parseFloat(price) || 0,
      currency: currency || "INR",
      grace_period_minutes: parseInt(grace_period_minutes) || 10,
      category: chk.value,
    };
    if (thumbnail_url !== undefined) payload.thumbnail_url = thumbnail_url;

    const { data, error } = await insertServiceSafe(payload);
    if (error) return safeError(res, error);
    bustSitemapCache();
    res.status(201).json(data);
  } catch (error) {
    safeError(res, error);
  }
};
```

- [ ] **Step 5: Validate + persist in updateService**

In `hostController.updateService` (line ~379), after the existing destructure/`updates` build, add (before `updateServiceSafe`):
```javascript
    if (req.body.category !== undefined) {
      const chk = await resolveAndValidateCategory(supabaseAdmin, req.user.id, req.body.category, { required: false });
      if (!chk.ok) return res.status(chk.status).json({ message: chk.message });
      updates.category = chk.value;
    }
```

- [ ] **Step 6: Broaden the safe-fallback so a missing `category` column is tolerated**

In both `insertServiceSafe` (line ~42) and `updateServiceSafe` (line ~68), update the regex and the delete-list so a pre-migration DB degrades instead of hard-erroring. Change each occurrence of:
```javascript
    /Could not find the '(grace_period_minutes|thumbnail_url)' column|column.*does not exist/i.test(
```
to:
```javascript
    /Could not find the '(grace_period_minutes|thumbnail_url|category)' column|column.*does not exist/i.test(
```
and in `insertServiceSafe` add `delete payloadCopy.category;` next to the existing deletes; in `updateServiceSafe` add `delete updatesCopy.category;` next to the existing deletes.

- [ ] **Step 7: Run, verify all pass**

Run: `cd server && npx jest tests/integration/serviceCategory.int.test.js`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add server/controllers/hostController.js server/tests/integration/serviceCategory.int.test.js
git commit -m "feat(host): validate + persist category on /host/services; tolerate pre-migration"
```

---

## Task 5: `categoryLabel` client util

**Files:**
- Modify: `client/src/utils/categoryUtils.js`
- Test: `client/src/tests/categoryUtils.test.js`

- [ ] **Step 1: Add a failing test**

Append to `client/src/tests/categoryUtils.test.js`:
```javascript
import { categoryLabel } from '../utils/categoryUtils';

describe('categoryLabel', () => {
  const list = [{ slug: 'career-coach', label: 'Career Coach' }];
  it('returns the label from the list when present', () => {
    expect(categoryLabel('career-coach', list)).toBe('Career Coach');
  });
  it('prettifies the slug when not in the list', () => {
    expect(categoryLabel('life-coach', list)).toBe('Life Coach');
  });
  it('returns empty string for a falsy slug', () => {
    expect(categoryLabel('', list)).toBe('');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd client && npx vitest run src/tests/categoryUtils.test.js`
Expected: FAIL — `categoryLabel` is not exported.

- [ ] **Step 3: Implement**

Append to `client/src/utils/categoryUtils.js`:
```javascript
// Resolve a category slug to a human label using the active list, falling back
// to a prettified slug ('career-coach' → 'Career Coach').
export function categoryLabel(slug, list) {
  if (!slug) return '';
  const hit = (list || []).find((c) => c.slug === slug);
  if (hit) return hit.label;
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `cd client && npx vitest run src/tests/categoryUtils.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/categoryUtils.js client/src/tests/categoryUtils.test.js
git commit -m "feat(categories): categoryLabel slug→label util"
```

---

## Task 6: `ServiceCategoryPicker` component

**Files:**
- Create: `client/src/components/services/ServiceCategoryPicker.jsx`
- Test: `client/src/tests/ServiceCategoryPicker.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/tests/ServiceCategoryPicker.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ServiceCategoryPicker from '../components/services/ServiceCategoryPicker';

const TWO = [
  { slug: 'career-coach', label: 'Career Coach' },
  { slug: 'life-coach', label: 'Life Coach' },
];

test('single category renders a read-only chip (no buttons)', () => {
  render(<ServiceCategoryPicker categories={[{ slug: 'career-coach', label: 'Career Coach' }]} value="career-coach" onChange={() => {}} />);
  expect(screen.getByText('Career Coach')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('multiple categories are selectable and fire onChange', () => {
  const onChange = vi.fn();
  render(<ServiceCategoryPicker categories={TWO} value="career-coach" onChange={onChange} />);
  fireEvent.click(screen.getByText('Life Coach'));
  expect(onChange).toHaveBeenCalledWith('life-coach');
});

test('renders nothing when the host has no categories', () => {
  const { container } = render(<ServiceCategoryPicker categories={[]} value="" onChange={() => {}} />);
  expect(container.firstChild).toBeNull();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd client && npx vitest run src/tests/ServiceCategoryPicker.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```jsx
// client/src/components/services/ServiceCategoryPicker.jsx
// One category per service, drawn from the host's own categories.
// 1 category  → auto-assigned, shown as a read-only chip.
// 2+ (Pro)    → required single-select chips.
export default function ServiceCategoryPicker({ categories = [], value, onChange }) {
  if (!categories.length) return null;

  if (categories.length === 1) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</label>
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border border-primary bg-primary/5 text-primary">
          {categories[0].label}
        </span>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Category <span className="text-red-500">*</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => onChange(c.slug)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
              value === c.slug
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `cd client && npx vitest run src/tests/ServiceCategoryPicker.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/services/ServiceCategoryPicker.jsx client/src/tests/ServiceCategoryPicker.test.jsx
git commit -m "feat(services): ServiceCategoryPicker component"
```

---

## Task 7: Wire the dashboard ServiceForm

**Files:**
- Modify: `client/src/pages/services/ServiceForm.jsx`

- [ ] **Step 1: Add imports**

At the top of `ServiceForm.jsx`, extend the api import and add the new ones:
```javascript
import { svcCreate, svcUpdate, uploadImage, hostGetCategories, getCategories } from '../../services/api';
import ServiceCategoryPicker from '../../components/services/ServiceCategoryPicker';
import { categoryLabel } from '../../utils/categoryUtils';
```

- [ ] **Step 2: Seed `category` into form state**

In `empty()` add `category: ''`. In the `initialData` branch of the `useState` initializer add `category: initialData.category || ''`.

- [ ] **Step 3: Fetch the host's categories and default the value**

Inside `ServiceForm`, after `const [saving, setSaving] = useState(false);`, add:
```javascript
  const [hostCats, setHostCats] = useState([]); // [{ slug, label }]

  useEffect(() => {
    let alive = true;
    Promise.all([hostGetCategories(), getCategories()])
      .then(([h, c]) => {
        if (!alive) return;
        const list = c.data || [];
        const slugs = h.data?.categories?.length
          ? h.data.categories
          : (h.data?.primary_category ? [h.data.primary_category] : []);
        const items = slugs.map((s) => ({ slug: s, label: categoryLabel(s, list) }));
        setHostCats(items);
        setForm((f) => f.category
          ? f
          : { ...f, category: initialData?.category || h.data?.primary_category || items[0]?.slug || '' });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
```
(`useEffect` is already imported in this file.)

- [ ] **Step 4: Render the picker**

In the Basic Information card's left column, after the Price block (`</div>` that closes Price, before the left column closing `</div>`), add:
```jsx
            {/* Category — drawn from the host's own categories */}
            <ServiceCategoryPicker
              categories={hostCats}
              value={form.category}
              onChange={(slug) => set('category', slug)}
            />
```

- [ ] **Step 5: Send `category` in the payload**

In `handleSubmit`, add `category` to the `payload` object:
```javascript
        category:          form.category || null,
```

- [ ] **Step 6: Verify (build + lint pass, manual preview)**

Run: `cd client && npx vitest run` (existing suite green) then `cd client && npm run build` (compiles).
Then with the dev server (preview tools): open the dashboard "Add Service" form as a host with 1 category → category shows as a read-only chip; as a Pro host with 2–3 → chips are selectable. Confirm save succeeds and the value round-trips on edit.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/services/ServiceForm.jsx
git commit -m "feat(services): category picker in dashboard ServiceForm"
```

---

## Task 8: Wire the onboarding FirstServiceStep

**Files:**
- Modify: `client/src/pages/onboarding/FirstServiceStep.jsx`

- [ ] **Step 1: Add imports + state**

Extend the api import and add the picker + util:
```javascript
import { createService, updateOnboardingStep, hostGetCategories, getCategories } from '../../services/api';
import ServiceCategoryPicker from '../../components/services/ServiceCategoryPicker';
import { categoryLabel } from '../../utils/categoryUtils';
```
Add `useEffect` to the React import (currently `import { useState } from 'react';`):
```javascript
import { useState, useEffect } from 'react';
```
Add state near the other `useState` calls:
```javascript
  const [category, setCategory] = useState('');
  const [hostCats, setHostCats] = useState([]);
```

- [ ] **Step 2: Fetch host categories, default to primary**

After the state declarations, add:
```javascript
  useEffect(() => {
    let alive = true;
    Promise.all([hostGetCategories(), getCategories()])
      .then(([h, c]) => {
        if (!alive) return;
        const list = c.data || [];
        const slugs = h.data?.categories?.length
          ? h.data.categories
          : (h.data?.primary_category ? [h.data.primary_category] : []);
        const items = slugs.map((s) => ({ slug: s, label: categoryLabel(s, list) }));
        setHostCats(items);
        setCategory(h.data?.primary_category || items[0]?.slug || '');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
```

- [ ] **Step 3: Require a pick when the host has 2+ categories**

In `handleSubmit`, after the existing price check, add:
```javascript
    if (hostCats.length > 1 && !category) {
      toast.error('Please choose a category');
      return;
    }
```
And include `category` in the `createService` call object:
```javascript
      await createService({
        title,
        short_description: description,
        service_type: type,
        duration: parseInt(duration),
        price: parseFloat(price),
        slug: serviceSlug,
        category: category || null,
      });
```

- [ ] **Step 4: Render the picker**

Inside the `<form>`, after the Type/Duration grid block and before the Price block, add:
```jsx
            <ServiceCategoryPicker
              categories={hostCats}
              value={category}
              onChange={setCategory}
            />
```

- [ ] **Step 5: Verify (build + preview)**

Run: `cd client && npm run build`.
Preview: walk onboarding to step 9 as a single-category host → category auto-shown; submit creates the service with the category. (A Pro multi-category onboarding is rare but the chips should appear and block submit until chosen.)

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/onboarding/FirstServiceStep.jsx
git commit -m "feat(onboarding): category picker in FirstServiceStep"
```

---

## Task 9: Category badges (dashboard list + public page)

**Files:**
- Modify: `client/src/pages/Services.jsx`
- Modify: `client/src/pages/ServiceDetail.jsx`

- [ ] **Step 1: Dashboard list — fetch categories + render a badge**

In `client/src/pages/Services.jsx`:
- Add to the api import: `getCategories` and the util import `import { categoryLabel } from '../utils/categoryUtils';`.
- Add state `const [catList, setCatList] = useState([]);` and, in the existing data-loading `useEffect` (or a new one), `getCategories().then(({ data }) => setCatList(data || [])).catch(() => {});`.
- In the service-name cell (after the title `<p>`), add a small badge:
```jsx
      {s.category && (
        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
          {categoryLabel(s.category, catList)}
        </span>
      )}
```

- [ ] **Step 2: Public page — render a badge from the server-resolved label**

In `client/src/pages/ServiceDetail.jsx`, update the existing `creatorCategory` derivation (line ~650) to prefer the new server-resolved label:
```javascript
  const creatorCategory = service.category_label || service.category
    || vendor?.profession || vendor?.tagline || '';
```
Then, in the meta row of the hero `<section>` (the `flex flex-wrap items-center gap-x-3 gap-y-2 ...` block, ~line 758, where the "ADD CATEGORY BADGE HERE" comment sits), add:
```jsx
            {service.category_label && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-900/5 text-gray-700">
                {service.category_label}
              </span>
            )}
```
(Confirm whether `creatorCategory` is already rendered elsewhere; if it is and now shows a real category, that's fine — keep this hero badge for prominence and remove any now-duplicate display.)

- [ ] **Step 3: Verify (build + preview)**

Run: `cd client && npm run build`.
Preview: dashboard services list shows a category chip per service; a public service page (`/<profile>/<service-slug>`) shows the category badge in the hero. Use `preview_screenshot` to capture both.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Services.jsx client/src/pages/ServiceDetail.jsx
git commit -m "feat(services): category badges on dashboard list + public page"
```

---

## Task 10: Full verification + docs

**Files:**
- Modify: `docs/current-work.md`

- [ ] **Step 1: Run the full server suite**

Run: `cd server && npm test`
Expected: all pass (includes the new `serviceCategory.test.js` + `serviceCategory.int.test.js`).

- [ ] **Step 2: Run the full client suite + build**

Run: `cd client && npx vitest run` then `cd client && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 3: Update docs**

Add a dated entry to `docs/current-work.md` summarizing: `services.category` (v3.22) added; validated against the host's `profiles.categories` in both `/services` and `/host/services`; `ServiceCategoryPicker` in dashboard + onboarding; badges on list + public page. Note deferred items (Explore filter, sharper `admin_category_stats`).

- [ ] **Step 4: Commit**

```bash
git add docs/current-work.md
git commit -m "docs: record service-categories feature"
```

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to choose merge/PR. Before merging, re-confirm the v3.22 migration is applied to both Supabase projects (Task 1, Step 3).

---

## Self-review notes

- **Spec coverage:** data model (Task 1), backend validation both paths (Tasks 3–4), picker (Task 6) wired in onboarding + dashboard (Tasks 7–8), display (Task 9), default-to-primary + auto-assign-single (Tasks 6–8), pre-migration tolerance (Task 4 step 6 + serviceController's existing fallback). Grid polish intentionally excluded (superseded by #107).
- **Type/name consistency:** `validateServiceCategory` / `resolveAndValidateCategory` (Task 2) used verbatim in Tasks 3–4; `categoryLabel` (Task 5) used in Tasks 7–9; `ServiceCategoryPicker` props `{categories,value,onChange}` consistent across Tasks 6–8; `category` slug column consistent everywhere.
- **Known confirm-at-implementation points:** the `requireFeature` middleware module path for the integration mock (Task 3 step 1 note); whether `creatorCategory` is already rendered in `ServiceDetail` (Task 9 step 2).
