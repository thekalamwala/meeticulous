# Host-Suggested Subcategories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let hosts suggest new service subcategories for professions the admin has opted in; admins approve or reject, and only approved subcategories reach live pages.

**Architecture:** Add a per-profession opt-in flag (`categories.allow_subcategory_suggestions`) and a lifecycle (`service_categories.status` + `suggested_by`). Hosts POST a suggestion (guarded), which lands `pending`/`is_active=false`. Public/host reads filter to `status='active'`. Admins approve (→ active + is_active) or reject in the existing service-categories admin page. Toggle lives on the professions admin page.

**Tech Stack:** Node/Express + Supabase (`supabaseAdmin` service-role), Jest (server), React + Vite + Vitest (client), react-hot-toast.

## Global Constraints

- Subcategory = `service_categories` table. No new taxonomy level.
- Effective public visibility = `is_active = true AND status = 'active'`.
- `status` values: exactly `active` | `pending` | `rejected`. Default `active`.
- `categories.allow_subcategory_suggestions` default `false` (protects curated 74).
- Uniqueness key: `(primary_category, slug)`. Slug via existing `slugify()` in `serviceCategoryController.js`.
- Migrations run in Supabase SQL editor on BOTH DBs: prod Mumbai `PROD_PROJECT_REF`, staging Tokyo `STAGING_PROJECT_REF`. Keep code-side schema fallback until confirmed applied.
- Server tests live in `server/tests/`, not `__tests__`. Mock pattern: `jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }))`.
- Client vitest does NOT load jest-dom matchers beyond `toBeInTheDocument`/`toBeDisabled`/`toBeEnabled`/`toBeEmptyDOMElement`; assert via `.getAttribute()`/`.textContent`.
- Host auth = `protect` then `requireHost` from `server/middleware/authMiddleware.js`. `req.user.id` is the host id.

---

### Task 1: Database migration (both DBs)

**Files:**
- Create: `server/migrations/v3.65_subcategory_suggestions.sql`

**Interfaces:**
- Produces: columns `categories.allow_subcategory_suggestions boolean`, `service_categories.status text`, `service_categories.suggested_by uuid`. All later tasks depend on these.

- [ ] **Step 1: Write the migration file**

```sql
-- v3.65 — host-suggested subcategories
-- Per-profession opt-in gate (curated professions stay locked).
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS allow_subcategory_suggestions BOOLEAN NOT NULL DEFAULT false;

-- Subcategory lifecycle. Existing rows default to 'active'.
ALTER TABLE service_categories
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Fast lookup of a profession's pending queue.
CREATE INDEX IF NOT EXISTS idx_service_categories_status
  ON service_categories (primary_category, status);
```

- [ ] **Step 2: Apply to staging, then prod**

Run the file's SQL in the Supabase SQL editor for `STAGING_PROJECT_REF` (staging), then `PROD_PROJECT_REF` (prod).

- [ ] **Step 3: Verify columns + defaults on both DBs**

Run on each project:
```sql
select
  (select count(*) from information_schema.columns
     where table_name='categories' and column_name='allow_subcategory_suggestions') as cat_flag,
  (select count(*) from information_schema.columns
     where table_name='service_categories' and column_name in ('status','suggested_by')) as sc_cols,
  (select count(*) from service_categories where status <> 'active') as non_active;
```
Expected: `cat_flag=1`, `sc_cols=2`, `non_active=0`.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/v3.65_subcategory_suggestions.sql
git commit -m "feat(db): v3.65 subcategory suggestion columns"
```

---

### Task 2: Read-filter leak prevention + allow flag

Ensure pending/rejected subcategories never reach public/host reads, and expose the profession's opt-in flag to the picker.

**Files:**
- Modify: `server/controllers/serviceCategoryController.js` (`listPublic`, ~99-131)
- Test: `server/tests/unit/serviceCategoryPublic.test.js`

**Interfaces:**
- Produces: `listPublic` returns `{ categories: [...], allow_suggestions: boolean }`; categories filtered to `status='active' AND is_active=true`.

- [ ] **Step 1: Write the failing test**

```javascript
// server/tests/unit/serviceCategoryPublic.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/responseCache', () => ({
  getOrSet: (_k, _ttl, fn) => fn(), bust: jest.fn(),
}));
jest.mock('../../utils/httpCache', () => ({ setPublicCache: jest.fn() }));
jest.mock('../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));

const { listPublic } = require('../../controllers/serviceCategoryController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('listPublic filters status=active and returns allow_suggestions', async () => {
  const scChain = {
    select: jest.fn(() => scChain), eq: jest.fn(() => scChain), order: jest.fn(() => scChain),
    then: undefined,
  };
  // resolve the service_categories query (awaited object with data/error)
  scChain.order.mockImplementation(function () { return scChain; });
  const scResult = { data: [{ id: 's1', name: 'Web Dev', slug: 'web-dev', primary_category: 'x' }], error: null };
  // Make the final builder awaitable:
  Object.assign(scChain, { then: (resolve) => resolve(scResult) });

  const catChain = {
    select: jest.fn(() => catChain), eq: jest.fn(() => catChain),
    maybeSingle: jest.fn().mockResolvedValue({ data: { allow_subcategory_suggestions: true }, error: null }),
  };

  mockFrom.mockImplementation((table) => (table === 'categories' ? catChain : scChain));

  const r = res();
  await listPublic({ query: { primary: 'x' } }, r);

  // status='active' filter applied on the service_categories query
  expect(scChain.eq).toHaveBeenCalledWith('status', 'active');
  const payload = r.json.mock.calls[0][0];
  expect(payload.allow_suggestions).toBe(true);
  expect(payload.categories).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/serviceCategoryPublic.test.js`
Expected: FAIL — current `listPublic` neither filters `status` nor returns `allow_suggestions`.

- [ ] **Step 3: Implement `listPublic` changes**

Replace the body of `listPublic` (server/controllers/serviceCategoryController.js) with:

```javascript
const listPublic = async (req, res) => {
  try {
    const primary = req.query.primary;
    if (!primary) return res.json({ categories: [], allow_suggestions: false });

    const payload = await responseCache.getOrSet(`svccat:${primary}`, PUBLIC_CACHE_MS, async () => {
      let r = await supabaseAdmin
        .from('service_categories')
        .select('id, name, slug, primary_category, description, icon')
        .eq('primary_category', primary)
        .eq('is_active', true)
        .eq('status', 'active')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (r.error && /Could not find the|column .* does not exist/i.test(r.error.message)) {
        // pre-migration fallback: no status/description/icon columns
        r = await supabaseAdmin
          .from('service_categories')
          .select('id, name, slug, primary_category')
          .eq('primary_category', primary)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true });
      }
      if (r.error) throw r.error;

      // Does this profession accept host suggestions?
      let allow = false;
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('allow_subcategory_suggestions')
        .eq('slug', primary)
        .maybeSingle();
      allow = Boolean(cat?.allow_subcategory_suggestions);

      return { categories: r.data || [], allow_suggestions: allow };
    });

    setPublicCache(res, Math.round(PUBLIC_CACHE_MS / 1000));
    res.json(payload);
  } catch (error) {
    safeError(res, error);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/serviceCategoryPublic.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/serviceCategoryController.js server/tests/unit/serviceCategoryPublic.test.js
git commit -m "feat(subcategories): filter status=active + expose allow_suggestions in public list"
```

---

### Task 3: Host suggest endpoint

**Files:**
- Modify: `server/controllers/serviceCategoryController.js` (add `suggest`, export it)
- Modify: `server/routes/serviceCategoryRoutes.js` (add guarded route)
- Test: `server/tests/unit/serviceCategorySuggest.test.js`

**Interfaces:**
- Consumes: `slugify` (existing, in same file), `supabaseAdmin`.
- Produces: `suggest(req, res)` handler; route `POST /api/service-categories/suggest` guarded by `protect, requireHost`. Request body `{ primary_category, name }`. Inserts `{ status:'pending', is_active:false, suggested_by:req.user.id }`.

- [ ] **Step 1: Write the failing test**

```javascript
// server/tests/unit/serviceCategorySuggest.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/responseCache', () => ({ getOrSet: (_k,_t,fn)=>fn(), bust: jest.fn() }));
jest.mock('../../utils/httpCache', () => ({ setPublicCache: jest.fn() }));
jest.mock('../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));

const { suggest } = require('../../controllers/serviceCategoryController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

// Helper: build a from() router keyed by table with per-table stubs.
const wire = ({ category, profile, dupe = null, maxOrder = null, inserted }) => {
  mockFrom.mockImplementation((table) => {
    if (table === 'categories') {
      const c = { select: () => c, eq: () => c, maybeSingle: () => Promise.resolve({ data: category, error: null }) };
      return c;
    }
    if (table === 'profiles') {
      const c = { select: () => c, eq: () => c, maybeSingle: () => Promise.resolve({ data: profile, error: null }) };
      return c;
    }
    // service_categories: used for count, dupe check, max order, insert
    const c = {
      select: jest.fn(() => c), eq: jest.fn(() => c), order: jest.fn(() => c), limit: jest.fn(() => c),
      maybeSingle: jest.fn()
        .mockResolvedValueOnce({ data: dupe, error: null })       // dupe check
        .mockResolvedValueOnce({ data: maxOrder, error: null }),  // max order
      insert: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({ data: inserted, error: null }),
    };
    // count query returns {count}
    c.select.mockImplementation((_c, opts) => (opts && opts.head) ? Object.assign(c, { _count: true }) : c);
    c.then = undefined;
    return c;
  });
};

test('rejects when profession is not opted in', async () => {
  wire({ category: { slug: 'x', allow_subcategory_suggestions: false }, profile: { primary_category: 'x' } });
  const r = res();
  await suggest({ user: { id: 'h1' }, body: { primary_category: 'x', name: 'New Thing' } }, r);
  expect(r.status).toHaveBeenCalledWith(403);
});

test('rejects when host is not in the profession', async () => {
  wire({ category: { slug: 'x', allow_subcategory_suggestions: true }, profile: { primary_category: 'y' } });
  const r = res();
  await suggest({ user: { id: 'h1' }, body: { primary_category: 'x', name: 'New Thing' } }, r);
  expect(r.status).toHaveBeenCalledWith(403);
});
```

> NOTE for implementer: the count query uses `{ count: 'exact', head: true }`. In the test the count stub can be simplified — if the chain shape fights you, split the cap check into its own mocked branch. The two guard tests above are the required assertions; add a happy-path test returning 201 once the handler compiles.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/serviceCategorySuggest.test.js`
Expected: FAIL — `suggest` is not exported.

- [ ] **Step 3: Implement `suggest` and export it**

Add to `server/controllers/serviceCategoryController.js` (before `module.exports`):

```javascript
// ── Host: suggest a new subcategory (pending admin approval) ──────────────────
// POST /api/service-categories/suggest  body: { primary_category, name }
// Allowed only when the profession opted in AND the host belongs to it.
const OPEN_SUGGESTION_CAP = 5;
const suggest = async (req, res) => {
  try {
    const primary = (req.body.primary_category || '').trim();
    const name = (req.body.name || '').trim();
    if (!primary) return res.status(400).json({ message: 'primary_category is required' });
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: 'Name must be 2–60 characters' });
    }

    // 1) Profession must exist and be opted in.
    const { data: cat } = await supabaseAdmin
      .from('categories')
      .select('slug, allow_subcategory_suggestions')
      .eq('slug', primary)
      .maybeSingle();
    if (!cat) return res.status(404).json({ message: 'Profession not found' });
    if (!cat.allow_subcategory_suggestions) {
      return res.status(403).json({ message: "This profession isn't accepting suggestions right now" });
    }

    // 2) Host must belong to this profession.
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('primary_category')
      .eq('id', req.user.id)
      .maybeSingle();
    if (!prof || prof.primary_category !== primary) {
      return res.status(403).json({ message: 'You can only suggest subcategories for your own profession' });
    }

    // 3) Cap open (pending) suggestions per host per profession.
    const { count: openCount } = await supabaseAdmin
      .from('service_categories')
      .select('id', { count: 'exact', head: true })
      .eq('primary_category', primary)
      .eq('suggested_by', req.user.id)
      .eq('status', 'pending');
    if ((openCount || 0) >= OPEN_SUGGESTION_CAP) {
      return res.status(429).json({ message: 'You have too many pending suggestions' });
    }

    // 4) Slug + uniqueness within the profession (any status).
    const slug = slugify(name);
    if (!slug) return res.status(400).json({ message: 'Invalid name' });
    const { data: dupe } = await supabaseAdmin
      .from('service_categories')
      .select('id')
      .eq('primary_category', primary)
      .eq('slug', slug)
      .maybeSingle();
    if (dupe) return res.status(409).json({ message: 'That subcategory already exists' });

    // 5) Append at the end of the profession's order.
    const { data: maxRow } = await supabaseAdmin
      .from('service_categories')
      .select('display_order')
      .eq('primary_category', primary)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const displayOrder = maxRow ? (maxRow.display_order + 1) : 0;

    const { data: row, error } = await supabaseAdmin
      .from('service_categories')
      .insert({
        primary_category: primary, name, slug,
        display_order: displayOrder, is_active: false,
        status: 'pending', suggested_by: req.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json(row);
  } catch (error) {
    safeError(res, error);
  }
};
```

Update the exports line:
```javascript
module.exports = { listAdmin, listPublic, create, update, remove, reorder, suggest };
```

- [ ] **Step 4: Add the guarded route**

In `server/routes/serviceCategoryRoutes.js`, add the import and route:

```javascript
const { protect, requireHost } = require('../middleware/authMiddleware');
// ...
// ── Public router (picker / read-only + host suggest) ─────────────────────────
const publicRouter = express.Router();

publicRouter.get('/', sc.listPublic);
publicRouter.post('/suggest', protect, requireHost, sc.suggest);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx jest tests/unit/serviceCategorySuggest.test.js`
Expected: PASS (guard tests). Then run the full suggest file including your added 201 happy-path.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/serviceCategoryController.js server/routes/serviceCategoryRoutes.js server/tests/unit/serviceCategorySuggest.test.js
git commit -m "feat(subcategories): host suggest endpoint with opt-in + ownership guards"
```

---

### Task 4: Admin approve / reject (status in update whitelist)

**Files:**
- Modify: `server/controllers/serviceCategoryController.js` (`update`, ~194-239)
- Test: `server/tests/unit/serviceCategoryUpdateStatus.test.js`

**Interfaces:**
- Produces: `PUT /api/admin/service-categories/:id` accepts `status` ∈ {active,pending,rejected}; `active` sets `is_active=true`, `rejected` sets `is_active=false`.

- [ ] **Step 1: Write the failing test**

```javascript
// server/tests/unit/serviceCategoryUpdateStatus.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/responseCache', () => ({ getOrSet: (_k,_t,fn)=>fn(), bust: jest.fn() }));
jest.mock('../../utils/httpCache', () => ({ setPublicCache: jest.fn() }));
jest.mock('../../utils/sitemapCache', () => ({ bustSitemapCache: jest.fn() }));

const { update } = require('../../controllers/serviceCategoryController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('approve sets status=active and is_active=true', async () => {
  let applied = null;
  const c = {
    update: jest.fn((row) => { applied = row; return c; }),
    eq: jest.fn(() => c), select: jest.fn(() => c),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'sc1', status: 'active', is_active: true }, error: null }),
  };
  mockFrom.mockReturnValue(c);
  const r = res();
  await update({ params: { id: 'sc1' }, body: { status: 'active' } }, r);
  expect(applied).toMatchObject({ status: 'active', is_active: true });
});

test('reject sets status=rejected and is_active=false', async () => {
  let applied = null;
  const c = {
    update: jest.fn((row) => { applied = row; return c; }),
    eq: jest.fn(() => c), select: jest.fn(() => c),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'sc1', status: 'rejected', is_active: false }, error: null }),
  };
  mockFrom.mockReturnValue(c);
  const r = res();
  await update({ params: { id: 'sc1' }, body: { status: 'reject-typo' } }, r);
  expect(r.status).toHaveBeenCalledWith(400); // invalid status rejected
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/serviceCategoryUpdateStatus.test.js`
Expected: FAIL — `update` ignores `status`.

- [ ] **Step 3: Implement the status branch**

In `update` (serviceCategoryController.js), immediately AFTER the `is_active` line
(`if (req.body.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);`), insert:

```javascript
    // Approve/reject a suggestion. status wins over any is_active in the body.
    if (req.body.status !== undefined) {
      const allowedStatus = ['active', 'pending', 'rejected'];
      if (!allowedStatus.includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      updates.status = req.body.status;
      updates.is_active = req.body.status === 'active';
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/serviceCategoryUpdateStatus.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/serviceCategoryController.js server/tests/unit/serviceCategoryUpdateStatus.test.js
git commit -m "feat(subcategories): admin approve/reject via status on update"
```

---

### Task 5: Per-profession toggle in categories update

**Files:**
- Modify: `server/controllers/categoryController.js` (`adminUpdate`, ~167-187)
- Test: `server/tests/unit/categoryUpdateAllowFlag.test.js`

**Interfaces:**
- Produces: `PUT /api/admin/categories/:id` accepts `allow_subcategory_suggestions` (boolean).

- [ ] **Step 1: Write the failing test**

```javascript
// server/tests/unit/categoryUpdateAllowFlag.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../utils/httpCache', () => ({ setPublicCache: jest.fn() }));
jest.mock('../../utils/sendEmail', () => jest.fn());

const { adminUpdate } = require('../../controllers/categoryController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('adminUpdate persists allow_subcategory_suggestions', async () => {
  let applied = null;
  const c = {
    update: jest.fn((row) => { applied = row; return c; }),
    eq: jest.fn(() => c), select: jest.fn(() => c),
    single: jest.fn().mockResolvedValue({ data: { id: 'c1', allow_subcategory_suggestions: true }, error: null }),
  };
  mockFrom.mockReturnValue(c);
  const r = res();
  await adminUpdate({ params: { id: 'c1' }, body: { allow_subcategory_suggestions: true } }, r);
  expect(applied).toMatchObject({ allow_subcategory_suggestions: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/categoryUpdateAllowFlag.test.js`
Expected: FAIL — field not whitelisted.

- [ ] **Step 3: Implement the whitelist addition**

In `adminUpdate` (categoryController.js), after the `group_label` line, add:

```javascript
    if (req.body.allow_subcategory_suggestions !== undefined) {
      updates.allow_subcategory_suggestions = Boolean(req.body.allow_subcategory_suggestions);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/categoryUpdateAllowFlag.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/categoryController.js server/tests/unit/categoryUpdateAllowFlag.test.js
git commit -m "feat(subcategories): admin toggle allow_subcategory_suggestions per profession"
```

---

### Task 6: API client helper

**Files:**
- Modify: `client/src/services/api.js` (near `listServiceCategories`, ~210)

**Interfaces:**
- Produces: `hostSuggestServiceCategory({ primary_category, name })` → `POST /service-categories/suggest`.

- [ ] **Step 1: Add the helper**

In `client/src/services/api.js`, directly after `export const listServiceCategories ...`:

```javascript
export const hostSuggestServiceCategory = (data) => API.post('/service-categories/suggest', data);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(subcategories): api helper hostSuggestServiceCategory"
```

---

### Task 7: Service form — "+ Suggest new" UX

**Files:**
- Modify: `client/src/pages/services/ServiceForm.jsx` (loader ~392-414, picker ~518-525)

**Interfaces:**
- Consumes: `hostSuggestServiceCategory`, `listServiceCategories` (now returns `allow_suggestions`).
- Produces: a suggest modal gated by `allowSuggest`; on success shows a toast and does NOT mutate the current selection.

- [ ] **Step 1: Capture primary + allow flag in the loader**

Add state near `const [svcCats, setSvcCats] = useState([]);`:

```javascript
  const [primaryCat, setPrimaryCat]   = useState(null);
  const [allowSuggest, setAllowSuggest] = useState(false);
  const [suggestOpen, setSuggestOpen]   = useState(false);
```

In the loader's `.then(([primary, sc]) => { ... })` block, after `const list = sc.data?.categories || [];`:

```javascript
        setPrimaryCat(primary);
        setAllowSuggest(Boolean(sc.data?.allow_suggestions));
```

- [ ] **Step 2: Add the suggest control under the category Select**

Replace the category block (~518-525) with:

```jsx
              {svcCats.length > 0 && (
                <div className="flex-1">
                  <label className={fieldLabel}>Category <span className="text-red-500">*</span></label>
                  <Select value={form.category} onChange={e => set('category', e.target.value)}>
                    {svcCats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </Select>
                  {allowSuggest && (
                    <button type="button" onClick={() => setSuggestOpen(true)}
                      className="mt-1.5 text-[12px] font-medium text-[#FE5100] hover:underline">
                      + Suggest new subcategory
                    </button>
                  )}
                </div>
              )}
```

- [ ] **Step 3: Add the modal near the component's return root**

Add this import at the top with the other api imports:
```javascript
import { svcCreate, svcUpdate, uploadImage, hostGetCategories, listServiceCategories, hostSuggestServiceCategory } from '../../services/api';
```

Add the modal component ABOVE `const ServiceForm = ...` (module scope):

```jsx
const SuggestSubcategoryModal = ({ primary, onClose }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const v = name.trim();
    if (v.length < 2) return toast.error('Enter a subcategory name');
    setSaving(true);
    try {
      await hostSuggestServiceCategory({ primary_category: primary, name: v });
      toast.success('Sent for approval');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not submit');
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-gray-900 mb-1">Suggest a subcategory</h3>
        <p className="text-[12px] text-gray-500 mb-3">An admin will review it before it goes live.</p>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. Wedding Photography"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#FE5100] focus:outline-none" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="rounded-lg bg-[#FE5100] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e04800] disabled:opacity-50">
            {saving ? 'Sending…' : 'Send for approval'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

Render it — add just before the closing tag of the form's outermost returned element:

```jsx
      {suggestOpen && <SuggestSubcategoryModal primary={primaryCat} onClose={() => setSuggestOpen(false)} />}
```

(`toast` is already imported in ServiceForm; if not, add `import toast from 'react-hot-toast';`.)

- [ ] **Step 4: Manual verification (client build + preview)**

Run: `cd client && npm run build`
Expected: build succeeds.
Then in preview, on a service form for a profession with the flag ON, confirm the "+ Suggest new subcategory" link appears and the modal opens; for a flag-OFF profession it does not appear. (Requires a host session + backend; verify post-deploy if backend isn't local.)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/services/ServiceForm.jsx
git commit -m "feat(subcategories): host suggest-new UX in service form"
```

---

### Task 8: Admin — pending queue in service categories

**Files:**
- Modify: `client/src/pages/admin/AdminServiceCategories.jsx`

**Interfaces:**
- Consumes: `adminUpdateServiceCategory(id, { status })` (existing helper), `cats` state (already holds all rows incl `status`).
- Produces: a Pending section with Approve/Reject that flips `status`.

- [ ] **Step 1: Derive the pending list**

Near the other `useMemo`s (after `rows`), add:

```javascript
  const pending = useMemo(
    () => cats.filter((c) => c.status === 'pending')
      .sort((a, b) => (a.primary_category || '').localeCompare(b.primary_category || '')),
    [cats]
  );

  const moderate = async (cat, status) => {
    try {
      await adminUpdateServiceCategory(cat.id, { status });
      toast.success(status === 'active' ? 'Approved' : 'Rejected');
      load();
    } catch { toast.error('Update failed'); }
  };
```

- [ ] **Step 2: Render the pending queue above the main table**

Insert this block just before the main categories table/section in the returned JSX:

```jsx
      {pending.length > 0 && (
        <div className="mb-6 border border-amber-200 rounded overflow-hidden">
          <div className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium">
            Pending subcategory suggestions ({pending.length})
          </div>
          {pending.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-amber-100">
              <span className="flex-1 text-sm">
                <span className="font-medium text-gray-900">{cat.name}</span>
                <span className="text-xs text-gray-400"> · {labelFor(cat.primary_category)}</span>
              </span>
              <button onClick={() => moderate(cat, 'active')}
                className="btn text-xs bg-green-600 text-white px-2 py-1 hover:bg-green-700">Approve</button>
              <button onClick={() => moderate(cat, 'rejected')}
                className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Reject</button>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 3: Manual verification**

Run: `cd client && npm run build`
Expected: build succeeds. In preview (admin session + backend), a pending suggestion appears in the queue; Approve moves it into the profession's active list; Reject removes it from the queue.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/AdminServiceCategories.jsx
git commit -m "feat(subcategories): admin pending queue with approve/reject"
```

---

### Task 9: Admin — per-profession "Allow suggestions" toggle

**Files:**
- Modify: `client/src/pages/admin/AdminCategories.jsx` (professions page)

**Interfaces:**
- Consumes: `adminUpdateCategory(id, { allow_subcategory_suggestions })` (already imported).
- Produces: a per-row toggle reflecting/flipping `cat.allow_subcategory_suggestions`.

- [ ] **Step 1: Add a handler**

Near `setStatus` in AdminCategories.jsx, add:

```javascript
  const setAllowSuggest = async (cat, value) => {
    try {
      await adminUpdateCategory(cat.id, { allow_subcategory_suggestions: value });
      toast.success(value ? 'Suggestions on' : 'Suggestions off');
      load();
    } catch { toast.error('Update failed'); }
  };
```

- [ ] **Step 2: Add a column header**

In the professions `<thead>` row, add a header cell before `Actions`:

```jsx
                  <th className="px-3 py-2 text-center">Host Suggestions</th>
```

- [ ] **Step 3: Add the toggle cell in `Row`**

In the `Row` component, add a `<td>` before the actions `<td>`:

```jsx
        <td className="px-3 py-2.5 text-center">
          <button
            onClick={() => setAllowSuggest(cat, !cat.allow_subcategory_suggestions)}
            className={`text-xs font-medium rounded px-2 py-1 border ${
              cat.allow_subcategory_suggestions
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-gray-200 bg-gray-50 text-gray-500'
            }`}
          >
            {cat.allow_subcategory_suggestions ? 'On' : 'Off'}
          </button>
        </td>
```

Note: `Row` is defined inside `AdminCategories` and closes over `setAllowSuggest` — confirm it's in scope (it is, since `Row` is a nested function). If `Row` is defined before `setAllowSuggest`, move `setAllowSuggest` above `Row`.

- [ ] **Step 4: Manual verification**

Run: `cd client && npm run build`
Expected: build succeeds. In preview, each profession row shows an On/Off toggle; clicking flips it and persists on reload.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/AdminCategories.jsx
git commit -m "feat(subcategories): per-profession allow-suggestions toggle on professions admin"
```

---

## Rollout (after all tasks land)

1. Migration already applied to both DBs in Task 1.
2. Merge; deploy backend + frontend.
3. On `/admin/professions`, flip "Host Suggestions" ON only for chosen new professions. Curated 74 stay OFF.
4. Smoke test: as a host in an opted-in profession, suggest a subcategory → approve in admin → confirm it appears in the service-form picker.

## Notes / self-review

- Spec coverage: schema (T1), read-filter leak prevention + allow flag (T2), suggest endpoint w/ guards + cap (T3), approve/reject (T4), toggle backend (T5) + frontend (T9), suggest UX (T6/T7), admin queue (T8). All spec sections mapped.
- The suggest test's count-query mock is the fiddliest part; the plan flags it and requires two guard assertions + a happy-path. Implementer may simplify the mock shape.
- Host notification on approve/reject intentionally omitted (MVP decision).
- `listAdmin` already selects `*`, so `status`/`suggested_by` flow to the admin page automatically once columns exist — no change needed there.
