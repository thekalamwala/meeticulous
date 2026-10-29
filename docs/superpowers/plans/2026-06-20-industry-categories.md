# Industry Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a curated, admin-managed industry-category taxonomy (60 professions, phased 20/20/20) with a single-select onboarding "Primary Category," plan-gated category management in profile settings, and a redesigned admin table (on/off dropdown + analytics + delete-guard).

**Architecture:** One SQL migration (`v3.21`) reshapes the existing `categories` table (adds `group_label`, extends `status` with `disabled`, replaces the 11-row seed with 60 rows = 20 `active`/40 `disabled`), adds `profiles.primary_category`, adds a `categories` limit to every `subscription_plans` row, and creates an `admin_category_stats()` RPC for per-category counts. Server logic stays DB-driven: caps read from `subscription_plans.limits.categories` via `planService`. A pure validator (`server/lib/categoryRules.js`) is shared by the plan-capped host endpoint and the uncapped admin-override endpoint. Client gets a single-select onboarding step, a plan-gated "Categories" section in profile settings, and a rebuilt admin table.

**Tech Stack:** Node/Express + Supabase (service-role), React 18 + Vite + Tailwind, Jest (server), Vitest + Testing Library (client).

---

## Conventions (read once)

- **Plan slugs:** `starter` (free; legacy `explorer` aliases to it), `creator`, `professional`. Never hardcode caps in handlers — read `subscription_plans.limits.categories` through `planService`.
- **Category cap semantics (`limits.categories`):** `0` = locked (host cannot self-manage; onboarding primary stays, admin-only changes). `N≥1` = host may self-manage up to N total categories. `-1` = unlimited (not used by seed; admin override passes `-1`).
- **Primary invariant:** if `profiles.primary_category` is set, it is also an element of `profiles.categories`. Exactly one primary.
- **Status values:** `active` (ON/green), `disabled` (OFF/red), `pending` (vendor suggestion), `rejected`.
- **Tests:** server = `cd server && npx jest <file>`; client = `cd client && npx vitest run <file>`. Full suites: `cd server && npm test`, `cd client && npm test`. The codebase tests **pure functions and components** (no live-DB controller mocks) — follow that: TDD the pure logic + UI, verify DB-touching endpoints by running the app (Task 13).
- **Migration apply:** SQL files are applied manually (Supabase SQL Editor) or via the Supabase MCP `apply_migration`. Task 1 writes the file; applying it is part of Task 1's verification.

---

## File Structure

**Created**
- `server/migrations/v3.21_industry_categories.sql` — schema reshape + 60-row seed + plan limit + stats RPC.
- `server/lib/categoryRules.js` — pure `validateCategorySelection()` shared by host + admin endpoints.
- `client/src/utils/categoryUtils.js` — `getCategoryRules(plan)` + `groupCategories(list)` (client-side UX mirror; server is authoritative).
- Test files: `server/__tests__/categoryRules.test.js`, `server/__tests__/planLimits.categories.test.js`, `client/src/tests/categoryUtils.test.js`, `client/src/tests/AdminCategories.test.jsx`, `client/src/tests/CategoryStep.test.jsx`, `client/src/tests/ProfileCategories.test.jsx`.

**Modified**
- `server/services/planService.js` — add `categories` to `FALLBACK_PLANS` limits (≈ lines 21/25/29).
- `server/controllers/categoryController.js` — `listActive` (+group_label), `adminList` (merge stats), `adminCreate`/`adminUpdate` (+group_label, allow `disabled`), `adminDelete` (registered-host guard).
- `server/controllers/hostController.js` — add `getMyCategories` + `updateCategories`.
- `server/controllers/adminController.js` — add `adminSetUserCategories`.
- `server/controllers/vendorOnboardingController.js` — step 4 writes `primary_category` (≈ line 305).
- `server/routes/hostRoutes.js` — `GET`/`PUT /categories`.
- `server/routes/adminRoutes.js` — `PATCH /users/:id/categories`.
- `client/src/services/api.js` — `hostGetCategories`, `hostUpdateCategories`, `adminSetUserCategories`.
- `client/src/pages/onboarding/CategoryStep.jsx` — single-select + grouped + "Primary" label.
- `client/src/pages/ProfileSetup.jsx` — new plan-gated "Categories" section.
- `client/src/pages/admin/AdminCategories.jsx` — full table redesign.
- `client/src/pages/admin/AdminUsers.jsx` — admin "Set category" quick-action.
- `client/src/pages/HostProfile.jsx` — render primary-category chip (light).

---

## Task 1: Migration `v3.21` — schema, 60-row seed, plan limit, stats RPC

**Files:**
- Create: `server/migrations/v3.21_industry_categories.sql`

- [ ] **Step 1: Write the migration SQL**

Create `server/migrations/v3.21_industry_categories.sql`:

```sql
-- v3.21 — Industry categories taxonomy (phased 20/20/20)
-- - Adds group_label; extends status enum with 'disabled' (OFF/red)
-- - Replaces the 11-row v1.9 seed with the curated 60 (20 active / 40 disabled)
-- - Adds profiles.primary_category (the designated Primary)
-- - Clears host category arrays that referenced the old slugs (replace-entirely)
-- - Adds a per-plan `categories` limit (0=locked, N=self-manage cap)
-- - Adds admin_category_stats() for the admin table analytics

BEGIN;

-- 1) categories: group_label + extended status enum --------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_label text;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_status_check;
ALTER TABLE categories ADD CONSTRAINT categories_status_check
  CHECK (status IN ('active', 'disabled', 'pending', 'rejected'));

-- 2) Replace the seed entirely ----------------------------------------------
DELETE FROM categories;

INSERT INTO categories (slug, label, group_label, sort_order, status) VALUES
  -- Day 1 — active (20)
  ('software-engineer',        'Software Engineer',        'Technology & Product',  10,  'active'),
  ('product-manager',          'Product Manager',          'Technology & Product',  20,  'active'),
  ('ux-designer',              'UX Designer',              'Technology & Product',  30,  'active'),
  ('data-scientist',           'Data Scientist',           'Technology & Product',  40,  'active'),
  ('ai-engineer',              'AI Engineer',              'Technology & Product',  50,  'active'),
  ('career-coach',             'Career Coach',             'Coaching & Consulting', 60,  'active'),
  ('life-coach',               'Life Coach',               'Coaching & Consulting', 70,  'active'),
  ('executive-coach',          'Executive Coach',          'Coaching & Consulting', 80,  'active'),
  ('leadership-coach',         'Leadership Coach',         'Coaching & Consulting', 90,  'active'),
  ('business-coach',           'Business Coach',           'Coaching & Consulting', 100, 'active'),
  ('psychologist',             'Psychologist',             'Health & Wellness',     110, 'active'),
  ('nutritionist',             'Nutritionist',             'Health & Wellness',     120, 'active'),
  ('speech-therapist',         'Speech Therapist',         'Health & Wellness',     130, 'active'),
  ('language-tutor',           'Language Tutor',           'Education',             140, 'active'),
  ('ielts-coach',              'IELTS Coach',              'Education',             150, 'active'),
  ('study-abroad-consultant',  'Study Abroad Consultant',  'Education',             160, 'active'),
  ('financial-advisor',        'Financial Advisor',        'Business Services',     170, 'active'),
  ('startup-advisor',          'Startup Advisor',          'Business Services',     180, 'active'),
  ('business-consultant',      'Business Consultant',      'Business Services',     190, 'active'),
  ('hr-consultant',            'HR Consultant',            'Business Services',     200, 'active'),
  -- Day 30 — disabled (20)
  ('content-creator',          'Content Creator',          'Marketing & Creative',  210, 'disabled'),
  ('content-writer',           'Content Writer',           'Marketing & Creative',  220, 'disabled'),
  ('digital-marketer',         'Digital Marketer',         'Marketing & Creative',  230, 'disabled'),
  ('social-media-manager',     'Social Media Manager',     'Marketing & Creative',  240, 'disabled'),
  ('brand-consultant',         'Brand Consultant',         'Marketing & Creative',  250, 'disabled'),
  ('graphic-designer',         'Graphic Designer',         'Marketing & Creative',  260, 'disabled'),
  ('voice-artist',             'Voice Artist',             'Marketing & Creative',  270, 'disabled'),
  ('music-producer',           'Music Producer',           'Marketing & Creative',  280, 'disabled'),
  ('astrologer',               'Astrologer',               'Spiritual & Wellness',  290, 'disabled'),
  ('tarot-reader',             'Tarot Reader',             'Spiritual & Wellness',  300, 'disabled'),
  ('reiki-practitioner',       'Reiki Practitioner',       'Spiritual & Wellness',  310, 'disabled'),
  ('architect',                'Architect',                'Design & Advisory',     320, 'disabled'),
  ('interior-designer',        'Interior Designer',        'Design & Advisory',     330, 'disabled'),
  ('fashion-stylist',          'Fashion Stylist',          'Design & Advisory',     340, 'disabled'),
  ('music-teacher',            'Music Teacher',            'Teaching & Skills',     350, 'disabled'),
  ('dance-teacher',            'Dance Teacher',            'Teaching & Skills',     360, 'disabled'),
  ('art-teacher',              'Art Teacher',              'Teaching & Skills',     370, 'disabled'),
  ('coding-instructor',        'Coding Instructor',        'Teaching & Skills',     380, 'disabled'),
  ('public-speaking-coach',    'Public Speaking Coach',    'Teaching & Skills',     390, 'disabled'),
  ('communication-coach',      'Communication Coach',      'Teaching & Skills',     400, 'disabled'),
  -- Day 60 — disabled (20, offline hosts)
  ('makeup-artist',            'Makeup Artist',            'Offline Hosts',         410, 'disabled'),
  ('hair-stylist',             'Hair Stylist',             'Offline Hosts',         420, 'disabled'),
  ('nail-artist',              'Nail Artist',              'Offline Hosts',         430, 'disabled'),
  ('tattoo-artist',            'Tattoo Artist',            'Offline Hosts',         440, 'disabled'),
  ('photographer',             'Photographer',             'Offline Hosts',         450, 'disabled'),
  ('videographer',             'Videographer',             'Offline Hosts',         460, 'disabled'),
  ('physiotherapist',          'Physiotherapist',          'Offline Hosts',         470, 'disabled'),
  ('dentist',                  'Dentist',                  'Offline Hosts',         480, 'disabled'),
  ('dermatologist',            'Dermatologist',            'Offline Hosts',         490, 'disabled'),
  ('doctor',                   'Doctor',                   'Offline Hosts',         500, 'disabled'),
  ('yoga-trainer',             'Yoga Trainer',             'Offline Hosts',         510, 'disabled'),
  ('fitness-coach',            'Fitness Coach',            'Offline Hosts',         520, 'disabled'),
  ('dance-studio',             'Dance Studio',             'Offline Hosts',         530, 'disabled'),
  ('music-academy',            'Music Academy',            'Offline Hosts',         540, 'disabled'),
  ('coworking-space-owner',    'Coworking Space Owner',    'Offline Hosts',         550, 'disabled'),
  ('event-planner',            'Event Planner',            'Offline Hosts',         560, 'disabled'),
  ('wedding-planner',          'Wedding Planner',          'Offline Hosts',         570, 'disabled'),
  ('spa-owner',                'Spa Owner',                'Offline Hosts',         580, 'disabled'),
  ('salon-owner',              'Salon Owner',              'Offline Hosts',         590, 'disabled'),
  ('recording-studio-owner',   'Recording Studio Owner',   'Offline Hosts',         600, 'disabled');

-- 3) profiles.primary_category (new column → NULL for all existing rows) ------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_category text;

-- 4) Clear orphaned category arrays referencing the old v1.9 slugs ------------
UPDATE profiles SET categories = '[]'::jsonb
WHERE categories ?| array[
  'coaching','consulting','tutoring','wellness','music',
  'photography','design','writing','tech','beauty','other'
];

-- 5) Per-plan category cap (0=locked, 1=creator swap, 3=professional) ---------
UPDATE subscription_plans
SET limits = coalesce(limits, '{}'::jsonb) || jsonb_build_object(
  'categories',
  CASE slug WHEN 'creator' THEN 1 WHEN 'professional' THEN 3 ELSE 0 END
);

-- 6) Analytics RPC: registered hosts + active services per category ----------
CREATE OR REPLACE FUNCTION admin_category_stats()
RETURNS TABLE (slug text, registered_hosts bigint, active_services bigint)
LANGUAGE sql STABLE AS $$
  SELECT c.slug,
    (SELECT count(*) FROM profiles p WHERE p.categories ? c.slug) AS registered_hosts,
    (SELECT count(*) FROM services s
       JOIN profiles p2 ON s.host_id = p2.id
       WHERE s.is_active = true AND p2.categories ? c.slug) AS active_services
  FROM categories c;
$$;

COMMIT;
```

- [ ] **Step 2: Apply the migration** to the live DB the app uses (Supabase SQL Editor, or Supabase MCP `apply_migration` with name `v3_21_industry_categories` and the SQL above). If multiple environments exist, apply to each in turn.

- [ ] **Step 3: Verify it applied** — run this in the SQL editor (or MCP `execute_sql`):

```sql
SELECT status, count(*) FROM categories GROUP BY status ORDER BY status;
-- expect: active = 20, disabled = 40
SELECT slug, limits->>'categories' AS cat_limit FROM subscription_plans ORDER BY sort_order;
-- expect: starter 0, creator 1, professional 3
SELECT * FROM admin_category_stats() LIMIT 1;     -- runs without error
SELECT column_name FROM information_schema.columns
  WHERE table_name='profiles' AND column_name='primary_category';  -- 1 row
```

- [ ] **Step 4: Commit**

```bash
git add server/migrations/v3.21_industry_categories.sql
git commit -m "feat(db): v3.21 industry categories — 60-row taxonomy, primary_category, plan cap, stats RPC"
```

---

## Task 2: Add `categories` cap to plan fallbacks

**Files:**
- Create: `server/__tests__/planLimits.categories.test.js`
- Modify: `server/services/planService.js:21,25,29`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/planLimits.categories.test.js`:

```javascript
const { FALLBACK_PLANS } = require('../services/planService');

describe('plan category caps (fallback)', () => {
  it('starter is locked (0)', () => {
    expect(FALLBACK_PLANS.starter.limits.categories).toBe(0);
  });
  it('creator allows 1', () => {
    expect(FALLBACK_PLANS.creator.limits.categories).toBe(1);
  });
  it('professional allows 3', () => {
    expect(FALLBACK_PLANS.professional.limits.categories).toBe(3);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd server && npx jest __tests__/planLimits.categories.test.js`
Expected: FAIL — `categories` is `undefined`.

- [ ] **Step 3: Add the limit to each fallback plan**

In `server/services/planService.js`, add `categories` to each `limits` object:
- Line 21 (`starter` limits): add `, categories: 0` before the closing `}`.
- Line 25 (`creator` limits): add `, categories: 1`.
- Line 29 (`professional` limits): add `, categories: 3`.

Example — starter line becomes:

```javascript
    limits: { services: 10, bookings_per_year: 1000, digital_products: 3, calendar_integrations: 1, profile_theme_colors: 3, reminder_flows: 0, followup_flows: 0, categories: 0 },
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd server && npx jest __tests__/planLimits.categories.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/planService.js server/__tests__/planLimits.categories.test.js
git commit -m "feat(plans): categories cap in fallback plan limits (starter 0 / creator 1 / pro 3)"
```

---

## Task 3: Pure category-selection validator

**Files:**
- Create: `server/lib/categoryRules.js`
- Create: `server/__tests__/categoryRules.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/categoryRules.test.js`:

```javascript
const { validateCategorySelection } = require('../lib/categoryRules');

const ACTIVE = ['life-coach', 'business-coach', 'career-coach', 'ai-engineer'];

describe('validateCategorySelection', () => {
  it('accepts a single valid primary', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach'], activeSlugs: ACTIVE, max: 1 });
    expect(r.ok).toBe(true);
    expect(r.primary_category).toBe('life-coach');
    expect(r.categories).toEqual(['life-coach']);
  });

  it('forces primary into the categories array', () => {
    const r = validateCategorySelection({ primary_category: 'ai-engineer', categories: [], activeSlugs: ACTIVE, max: 1 });
    expect(r.ok).toBe(true);
    expect(r.categories).toEqual(['ai-engineer']);
  });

  it('rejects when no primary is given', () => {
    const r = validateCategorySelection({ primary_category: null, categories: [], activeSlugs: ACTIVE, max: 1 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('rejects an inactive/unknown slug', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach', 'doctor'], activeSlugs: ACTIVE, max: 3 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('rejects exceeding the plan cap', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach', 'business-coach'], activeSlugs: ACTIVE, max: 1 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it('allows up to the cap and dedupes', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach', 'life-coach', 'business-coach', 'career-coach'], activeSlugs: ACTIVE, max: 3 });
    expect(r.ok).toBe(true);
    expect(r.categories).toEqual(['life-coach', 'business-coach', 'career-coach']);
  });

  it('treats max=-1 as unlimited (admin override)', () => {
    const r = validateCategorySelection({ primary_category: 'life-coach', categories: ['life-coach', 'business-coach', 'career-coach', 'ai-engineer'], activeSlugs: ACTIVE, max: -1 });
    expect(r.ok).toBe(true);
    expect(r.categories.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd server && npx jest __tests__/categoryRules.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validator**

Create `server/lib/categoryRules.js`:

```javascript
// Pure validation for a host's category selection.
// Shared by the plan-capped host endpoint and the uncapped admin override.
// max: positive integer cap, or -1 for unlimited.
function validateCategorySelection({ primary_category, categories, activeSlugs, max }) {
  const active = new Set(activeSlugs || []);
  let cats = Array.isArray(categories) ? categories.filter(Boolean) : [];
  cats = [...new Set(cats)]; // dedupe, preserve order

  const primary = primary_category || cats[0] || null;
  if (!primary) {
    return { ok: false, status: 400, message: 'A primary category is required' };
  }
  // Primary must lead the array and be present exactly once.
  cats = [primary, ...cats.filter((c) => c !== primary)];

  if (!active.has(primary)) {
    return { ok: false, status: 400, message: 'Primary category is not available' };
  }
  for (const c of cats) {
    if (!active.has(c)) {
      return { ok: false, status: 400, message: `Category "${c}" is not available` };
    }
  }
  if (max !== -1 && cats.length > max) {
    return {
      ok: false,
      status: 403,
      message: max <= 0
        ? 'Your plan does not allow changing categories. Contact admin.'
        : `Your plan allows up to ${max} categor${max === 1 ? 'y' : 'ies'}.`,
    };
  }
  return { ok: true, primary_category: primary, categories: cats };
}

module.exports = { validateCategorySelection };
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd server && npx jest __tests__/categoryRules.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/categoryRules.js server/__tests__/categoryRules.test.js
git commit -m "feat(categories): pure validateCategorySelection (primary invariant + cap)"
```

---

## Task 4: Category controller — group_label, stats merge, delete-guard

**Files:**
- Modify: `server/controllers/categoryController.js`

No new unit test (these handlers touch `supabaseAdmin`; verified in Task 13). Changes are surgical.

- [ ] **Step 1: `listActive` returns `group_label`**

In `server/controllers/categoryController.js`, change the select in `listActive` (line 41) from:

```javascript
      .select('id, slug, label')
```
to:
```javascript
      .select('id, slug, label, group_label')
```

- [ ] **Step 2: `adminList` merges per-category counts**

Replace the body of `adminList` (lines 95–110) with:

```javascript
const adminList = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabaseAdmin
      .from('categories')
      .select('*')
      .order('status', { ascending: true })
      .order('sort_order', { ascending: true });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;

    // Merge analytics counts (registered hosts + active services) by slug.
    let statsBySlug = {};
    try {
      const { data: stats } = await supabaseAdmin.rpc('admin_category_stats');
      (stats || []).forEach((s) => {
        statsBySlug[s.slug] = {
          registered_hosts: Number(s.registered_hosts) || 0,
          active_services: Number(s.active_services) || 0,
        };
      });
    } catch (_) { /* RPC missing → counts default to 0 (schema-fallback pattern) */ }

    const rows = (data || []).map((c) => ({
      ...c,
      registered_hosts: statsBySlug[c.slug]?.registered_hosts ?? 0,
      active_services: statsBySlug[c.slug]?.active_services ?? 0,
    }));
    res.json(rows);
  } catch (error) {
    safeError(res, error);
  }
};
```

- [ ] **Step 3: `adminCreate` accepts `group_label` and `disabled`**

In `adminCreate` (lines 113–139), change the insert object (lines 119–126) to include `group_label` and validate status:

```javascript
    const allowed = ['active', 'disabled', 'pending', 'rejected'];
    const status = allowed.includes(req.body.status) ? req.body.status : 'active';

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        slug,
        label,
        group_label: req.body.group_label || null,
        status,
        sort_order: req.body.sort_order ?? 100,
      })
      .select()
      .single();
```

- [ ] **Step 4: `adminUpdate` accepts `group_label`**

In `adminUpdate` (lines 142–161), after the existing `slug` line (line 148) add:

```javascript
    if (req.body.group_label !== undefined) updates.group_label = req.body.group_label || null;
```

- [ ] **Step 5: `adminDelete` blocks deletion when hosts are registered**

Replace the body of `adminDelete` (lines 164–175) with:

```javascript
const adminDelete = async (req, res) => {
  try {
    // Look up the slug, then block delete if any host is registered in it.
    const { data: cat } = await supabaseAdmin
      .from('categories').select('slug').eq('id', req.params.id).maybeSingle();

    if (cat?.slug) {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .contains('categories', [cat.slug]);
      if ((count || 0) > 0) {
        return res.status(409).json({
          message: `${count} host${count === 1 ? '' : 's'} registered in this category. Set it to Off instead of deleting.`,
        });
      }
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Category deleted' });
  } catch (error) {
    safeError(res, error);
  }
};
```

- [ ] **Step 6: Run the existing server suite to ensure nothing broke**

Run: `cd server && npm test`
Expected: PASS (existing tests green; no new failures).

- [ ] **Step 7: Commit**

```bash
git add server/controllers/categoryController.js
git commit -m "feat(categories): group_label, analytics merge, delete-guard for registered categories"
```

---

## Task 5: Host endpoints — get + plan-capped update of own categories

**Files:**
- Modify: `server/controllers/hostController.js`
- Modify: `server/routes/hostRoutes.js:9,14`

- [ ] **Step 1: Add the two handlers to `hostController.js`**

At the top of `server/controllers/hostController.js`, ensure these requires exist (add any that are missing near the other requires):

```javascript
const planService = require('../services/planService');
const { validateCategorySelection } = require('../lib/categoryRules');
```

Add these two functions (place them near `updateProfile`):

```javascript
// GET /api/host/categories — current host's primary + categories
const getMyCategories = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('primary_category, categories')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json({
      primary_category: data?.primary_category || null,
      categories: Array.isArray(data?.categories) ? data.categories : [],
    });
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/host/categories — plan-capped update; body { primary_category, categories }
const updateCategories = async (req, res) => {
  try {
    const plan = req.vendorPlan || 'starter';
    const max = await planService.getLimit(plan, 'categories'); // 0=locked, N, -1
    if (!max || max <= 0) {
      return res.status(403).json({
        message: 'Your plan does not allow changing your category. Contact admin to make a change.',
        upgrade_required: true,
        current_plan: plan,
      });
    }

    const { data: activeRows, error: actErr } = await supabaseAdmin
      .from('categories').select('slug').eq('status', 'active');
    if (actErr) throw actErr;
    const activeSlugs = (activeRows || []).map((r) => r.slug);

    const result = validateCategorySelection({
      primary_category: req.body.primary_category,
      categories: req.body.categories,
      activeSlugs,
      max,
    });
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        primary_category: result.primary_category,
        categories: result.categories,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select('primary_category, categories')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};
```

In the `module.exports` of `hostController.js`, add `getMyCategories` and `updateCategories` to the exported object.

> Note: `supabaseAdmin` and `safeError` are already imported in this controller (used by `updateProfile`). If `safeError`'s import name differs, reuse whatever `updateProfile` already uses for error responses.

- [ ] **Step 2: Wire the routes**

In `server/routes/hostRoutes.js`, add `getMyCategories, updateCategories` to the destructured import from `../controllers/hostController` (line 3–6). Then add these routes immediately after the `/profile` route (line 14):

```javascript
router.get('/categories', protect, getMyCategories);
router.put('/categories', protect, attachPlan, updateCategories);
```

(`attachPlan` is already imported on line 9.)

- [ ] **Step 3: Verify the server boots and existing tests pass**

Run: `cd server && npm test`
Expected: PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add server/controllers/hostController.js server/routes/hostRoutes.js
git commit -m "feat(host): GET/PUT /host/categories with plan-capped primary-category management"
```

---

## Task 6: Admin override — set any host's category (uncapped)

**Files:**
- Modify: `server/controllers/adminController.js`
- Modify: `server/routes/adminRoutes.js:11-16,38`

- [ ] **Step 1: Add `adminSetUserCategories` to `adminController.js`**

At the top of `server/controllers/adminController.js`, add (near existing requires):

```javascript
const { validateCategorySelection } = require('../lib/categoryRules');
```

Add this function (near `updateUser`):

```javascript
// PATCH /api/admin/users/:id/categories — admin override, no plan cap.
const adminSetUserCategories = async (req, res) => {
  try {
    const { data: activeRows, error: actErr } = await supabaseAdmin
      .from('categories').select('slug').eq('status', 'active');
    if (actErr) return safeError(res, actErr);
    const activeSlugs = (activeRows || []).map((r) => r.slug);

    const result = validateCategorySelection({
      primary_category: req.body.primary_category,
      categories: req.body.categories,
      activeSlugs,
      max: -1, // admin bypasses plan caps
    });
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        primary_category: result.primary_category,
        categories: result.categories,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, primary_category, categories')
      .single();
    if (error) return safeError(res, error);

    await audit(req, { action: 'user.set_categories', resource_type: 'profile', resource_id: req.params.id,
      after: { primary_category: result.primary_category, categories: result.categories } });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};
```

> Note: `audit`, `supabaseAdmin`, and `safeError` are already used in `updateUser` (Task gathering quoted them) — reuse the same references. Add `adminSetUserCategories` to the `module.exports`.

- [ ] **Step 2: Wire the route**

In `server/routes/adminRoutes.js`, add `adminSetUserCategories` to the destructured import from `../controllers/adminController` (lines 11–16). Then add after the `users/:id` routes (line 38):

```javascript
router.patch('/users/:id/categories', requireAdmin('users.edit'), adminSetUserCategories);
```

- [ ] **Step 3: Verify**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/adminController.js server/routes/adminRoutes.js
git commit -m "feat(admin): PATCH /admin/users/:id/categories override (uncapped)"
```

---

## Task 7: Onboarding step 4 writes `primary_category`

**Files:**
- Modify: `server/controllers/vendorOnboardingController.js:305`

- [ ] **Step 1: Write the primary on step 4**

In `server/controllers/vendorOnboardingController.js`, inside `updateOnboardingStep`, replace the `stepNumber === 4` block (line 305):

```javascript
  } else if (stepNumber === 4) {
    updates.categories = data.categories || [];
  }
```
with:
```javascript
  } else if (stepNumber === 4) {
    const cats = Array.isArray(data.categories) ? data.categories.filter(Boolean) : [];
    const primary = data.primary_category || cats[0] || null;
    updates.primary_category = primary;
    updates.categories = primary ? [primary] : []; // onboarding = single primary
  }
```

- [ ] **Step 2: Verify**

Run: `cd server && npx jest __tests__/vendorOnboarding.test.js`
Expected: PASS (existing onboarding tests unaffected — they cover slug/resume logic, not step-4 columns).

- [ ] **Step 3: Commit**

```bash
git add server/controllers/vendorOnboardingController.js
git commit -m "feat(onboarding): step 4 persists primary_category (single primary)"
```

---

## Task 8: Client API + category utils

**Files:**
- Modify: `client/src/services/api.js:181-186`
- Create: `client/src/utils/categoryUtils.js`
- Create: `client/src/tests/categoryUtils.test.js`

- [ ] **Step 1: Add API functions**

In `client/src/services/api.js`, after line 186 (`adminDeleteCategory`), add:

```javascript
export const hostGetCategories      = ()         => API.get('/host/categories');
export const hostUpdateCategories   = (payload)  => API.put('/host/categories', payload);
export const adminSetUserCategories = (id, data) => API.patch(`/admin/users/${id}/categories`, data);
```

- [ ] **Step 2: Write the failing util test**

Create `client/src/tests/categoryUtils.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { getCategoryRules, groupCategories } from '../utils/categoryUtils';

describe('getCategoryRules', () => {
  it('locks free/starter/explorer', () => {
    expect(getCategoryRules('starter')).toEqual({ locked: true, max: 1 });
    expect(getCategoryRules('explorer')).toEqual({ locked: true, max: 1 });
    expect(getCategoryRules(undefined)).toEqual({ locked: true, max: 1 });
  });
  it('creator can manage 1', () => {
    expect(getCategoryRules('creator')).toEqual({ locked: false, max: 1 });
  });
  it('professional can manage 3', () => {
    expect(getCategoryRules('professional')).toEqual({ locked: false, max: 3 });
  });
});

describe('groupCategories', () => {
  it('groups by group_label preserving first-seen order', () => {
    const list = [
      { slug: 'a', label: 'A', group_label: 'G1' },
      { slug: 'b', label: 'B', group_label: 'G2' },
      { slug: 'c', label: 'C', group_label: 'G1' },
    ];
    const groups = groupCategories(list);
    expect(groups.map((g) => g.group)).toEqual(['G1', 'G2']);
    expect(groups[0].items.map((i) => i.slug)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 3: Run it, verify it fails**

Run: `cd client && npx vitest run src/tests/categoryUtils.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the utils**

Create `client/src/utils/categoryUtils.js`:

```javascript
// Client-side mirror of the server's category plan rules (UX only — the server
// at PUT /host/categories is authoritative). Plan slugs: starter/creator/professional.
export function getCategoryRules(plan) {
  const p = (plan || '').toLowerCase();
  if (p === 'creator') return { locked: false, max: 1 };
  if (p === 'professional') return { locked: false, max: 3 };
  return { locked: true, max: 1 }; // starter / explorer / unknown = free, locked
}

// [{ group, items: [...] }] grouped by group_label, preserving first-seen order.
export function groupCategories(list) {
  const order = [];
  const byGroup = new Map();
  (list || []).forEach((c) => {
    const g = c.group_label || 'Other';
    if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); }
    byGroup.get(g).push(c);
  });
  return order.map((g) => ({ group: g, items: byGroup.get(g) }));
}
```

- [ ] **Step 5: Run it, verify it passes**

Run: `cd client && npx vitest run src/tests/categoryUtils.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/services/api.js client/src/utils/categoryUtils.js client/src/tests/categoryUtils.test.js
git commit -m "feat(client): category API helpers + getCategoryRules/groupCategories utils"
```

---

## Task 9: Onboarding — single-select Primary Category

**Files:**
- Modify: `client/src/pages/onboarding/CategoryStep.jsx`
- Create: `client/src/tests/CategoryStep.test.jsx`

- [ ] **Step 1: Write the failing component test**

Create `client/src/tests/CategoryStep.test.jsx`:

```javascript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getCategories: vi.fn(),
  suggestCategory: vi.fn(),
  updateOnboardingStep: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({ slug: 'jane' }) };
});

import { getCategories, updateOnboardingStep } from '../services/api';
import CategoryStep from '../pages/onboarding/CategoryStep';

const CATS = [
  { slug: 'life-coach', label: 'Life Coach', group_label: 'Coaching & Consulting' },
  { slug: 'ai-engineer', label: 'AI Engineer', group_label: 'Technology & Product' },
];

beforeEach(() => {
  getCategories.mockResolvedValue({ data: CATS });
  updateOnboardingStep.mockResolvedValue({ data: {} });
});

test('shows the Primary Category heading', async () => {
  render(<MemoryRouter><CategoryStep /></MemoryRouter>);
  expect(await screen.findByText(/Pick Your Primary Service Category/i)).toBeTruthy();
});

test('is single-select and saves primary_category + single-item array', async () => {
  render(<MemoryRouter><CategoryStep /></MemoryRouter>);
  fireEvent.click(await screen.findByText('Life Coach'));
  fireEvent.click(screen.getByText('AI Engineer')); // selecting another replaces
  fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));
  await waitFor(() => expect(updateOnboardingStep).toHaveBeenCalled());
  const payload = updateOnboardingStep.mock.calls[0][0];
  expect(payload.step).toBe(4);
  expect(payload.data.primary_category).toBe('ai-engineer');
  expect(payload.data.categories).toEqual(['ai-engineer']);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd client && npx vitest run src/tests/CategoryStep.test.jsx`
Expected: FAIL — current page renders "Choose your professions" and is multi-select.

- [ ] **Step 3: Rewrite `CategoryStep.jsx` for single-select**

Replace `client/src/pages/onboarding/CategoryStep.jsx` with:

```javascript
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Check, Plus, Loader2 } from 'lucide-react';
import { getCategories, suggestCategory, updateOnboardingStep } from '../../services/api';
import { groupCategories } from '../../utils/categoryUtils';
import ProgressBar from './ProgressBar';

// Fallback if the API is unreachable — keeps onboarding usable offline.
const FALLBACK = [
  { slug: 'life-coach', label: 'Life Coach', group_label: 'Coaching & Consulting' },
  { slug: 'career-coach', label: 'Career Coach', group_label: 'Coaching & Consulting' },
  { slug: 'software-engineer', label: 'Software Engineer', group_label: 'Technology & Product' },
  { slug: 'psychologist', label: 'Psychologist', group_label: 'Health & Wellness' },
  { slug: 'language-tutor', label: 'Language Tutor', group_label: 'Education' },
  { slug: 'financial-advisor', label: 'Financial Advisor', group_label: 'Business Services' },
];

const CategoryStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null); // single slug
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [fetching, setFetching] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories()
      .then(({ data }) => setCategories(data?.length ? data : FALLBACK))
      .catch(() => setCategories(FALLBACK))
      .finally(() => setFetching(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.label.toLowerCase().includes(q));
  }, [categories, query]);

  const groups = useMemo(() => groupCategories(filtered), [filtered]);

  const handleAddCustom = async () => {
    const label = customName.trim();
    if (label.length < 2) { toast.error('Enter a category name (min 2 characters)'); return; }
    setAdding(true);
    try {
      const { data } = await suggestCategory(label);
      setCategories((prev) => (prev.some((c) => c.slug === data.slug) ? prev : [...prev, data]));
      setCustomName('');
      setQuery('');
      toast.success(data.status === 'pending' ? 'Sent for admin approval.' : 'Category added');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not add category');
    } finally {
      setAdding(false);
    }
  };

  const handleNext = () => {
    if (!selected) { toast.error('Please pick your primary category'); return; }
    setSaving(true);
    updateOnboardingStep({ slug, step: 4, data: { primary_category: selected, categories: [selected] } })
      .catch((error) => toast.error(error.response?.data?.message || 'Could not save category'));
    navigate(`/vendor-register/${slug}/booking-type`);
  };

  return (
    <>
      <ProgressBar current={4} total={11} />
      <div className="app-container flex min-h-[calc(100vh-72px)] items-center justify-center py-8 sm:py-12">
        <div className="page-card w-full max-w-2xl p-5 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Pick Your Primary Service Category</h1>
          <p className="text-gray-500 text-sm mb-5">
            Choose the main service you offer. This drives your profile and how guests find you.
          </p>

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={2.5} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              className="fb-input pl-9"
            />
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} />
            </div>
          ) : (
            <div className="space-y-5 mb-5">
              {groups.map((g) => (
                <div key={g.group}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{g.group}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {g.items.map((cat) => (
                      <button
                        key={cat.slug}
                        onClick={() => setSelected(cat.slug)}
                        className={`flex items-center gap-2 p-3 rounded border-2 transition text-sm font-medium text-left ${
                          selected === cat.slug
                            ? 'border-primary bg-primary-light text-primary'
                            : 'border-gray-200 hover:border-primary text-gray-700'
                        }`}
                      >
                        {selected === cat.slug && <Check className="w-4 h-4 shrink-0" strokeWidth={3} />}
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No category matches "{query}". Add it below.</p>
              )}
            </div>
          )}

          <div className="mb-6 rounded border border-dashed border-gray-300 p-3">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Can't find yours? Suggest a category (admin approval required)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                placeholder="e.g., Voice Coaching"
                className="fb-input flex-1"
              />
              <button
                onClick={handleAddCustom}
                disabled={adding}
                className="btn flex items-center gap-1.5 bg-gray-900 text-white px-3 text-sm font-medium hover:bg-black disabled:opacity-50 transition shrink-0"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={3} />}
                Add
              </button>
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={saving || !selected}
            className="btn w-full bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </>
  );
};

export default CategoryStep;
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd client && npx vitest run src/tests/CategoryStep.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/onboarding/CategoryStep.jsx client/src/tests/CategoryStep.test.jsx
git commit -m "feat(onboarding): single-select Primary Category step, grouped by industry"
```

---

## Task 10: Profile settings — plan-gated Categories section

**Files:**
- Modify: `client/src/pages/ProfileSetup.jsx`
- Create: `client/src/tests/ProfileCategories.test.jsx`

This task adds a self-contained section component so it can be unit-tested in isolation, then mounts it as a new tab in `ProfileSetup`.

- [ ] **Step 1: Write the failing test**

Create `client/src/tests/ProfileCategories.test.jsx`:

```javascript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  getCategories: vi.fn(),
  hostGetCategories: vi.fn(),
  hostUpdateCategories: vi.fn(),
}));

import { getCategories, hostGetCategories, hostUpdateCategories } from '../services/api';
import CategoriesSection from '../components/dashboard/CategoriesSection';

const ACTIVE = [
  { slug: 'life-coach', label: 'Life Coach', group_label: 'Coaching & Consulting' },
  { slug: 'business-coach', label: 'Business Coach', group_label: 'Coaching & Consulting' },
  { slug: 'ai-engineer', label: 'AI Engineer', group_label: 'Technology & Product' },
];

beforeEach(() => {
  getCategories.mockResolvedValue({ data: ACTIVE });
  hostGetCategories.mockResolvedValue({ data: { primary_category: 'life-coach', categories: ['life-coach'] } });
  hostUpdateCategories.mockResolvedValue({ data: { primary_category: 'life-coach', categories: ['life-coach'] } });
});

test('free plan is locked with a contact-admin note', async () => {
  render(<CategoriesSection plan="starter" onSaved={() => {}} />);
  expect(await screen.findByText(/Life Coach/)).toBeTruthy();
  expect(screen.getByText(/contact admin/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /save categories/i })).toBeNull();
});

test('professional plan can save up to 3 categories', async () => {
  render(<CategoriesSection plan="professional" onSaved={() => {}} />);
  fireEvent.click(await screen.findByText('Business Coach')); // add a 2nd
  fireEvent.click(screen.getByRole('button', { name: /save categories/i }));
  await waitFor(() => expect(hostUpdateCategories).toHaveBeenCalled());
  const payload = hostUpdateCategories.mock.calls[0][0];
  expect(payload.primary_category).toBe('life-coach');
  expect(payload.categories).toContain('business-coach');
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd client && npx vitest run src/tests/ProfileCategories.test.jsx`
Expected: FAIL — `components/dashboard/CategoriesSection` does not exist.

- [ ] **Step 3: Create the section component**

Create `client/src/components/dashboard/CategoriesSection.jsx`:

```javascript
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Check, Loader2, Lock } from 'lucide-react';
import { getCategories, hostGetCategories, hostUpdateCategories } from '../../services/api';
import { getCategoryRules, groupCategories } from '../../utils/categoryUtils';

// Plan-gated category management. Free = locked. Creator = swap 1. Pro = up to 3.
const CategoriesSection = ({ plan, onSaved }) => {
  const rules = getCategoryRules(plan);
  const [active, setActive] = useState([]);
  const [primary, setPrimary] = useState(null);
  const [selected, setSelected] = useState([]); // includes primary
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getCategories(), hostGetCategories()])
      .then(([a, mine]) => {
        setActive(a.data || []);
        setPrimary(mine.data?.primary_category || null);
        setSelected(mine.data?.categories?.length ? mine.data.categories : (mine.data?.primary_category ? [mine.data.primary_category] : []));
      })
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => groupCategories(active), [active]);
  const labelOf = (slug) => active.find((c) => c.slug === slug)?.label || slug;

  const toggle = (slug) => {
    if (rules.locked) return;
    setSelected((prev) => {
      if (prev.includes(slug)) {
        if (slug === primary) return prev; // can't remove the primary by toggle
        return prev.filter((s) => s !== slug);
      }
      if (rules.max === 1) { setPrimary(slug); return [slug]; } // single-cap = swap primary
      if (prev.length >= rules.max) { toast.error(`Your plan allows up to ${rules.max} categories`); return prev; }
      return [...prev, slug];
    });
  };

  const makePrimary = (slug) => {
    if (rules.locked) return;
    setPrimary(slug);
    setSelected((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await hostUpdateCategories({ primary_category: primary, categories: selected });
      toast.success('Categories saved');
      onSaved?.(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save categories');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-1">Your Primary Category</p>
        <p className="text-base font-semibold text-primary">{primary ? labelOf(primary) : 'Not set'}</p>
      </div>

      {rules.locked ? (
        <div className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Your plan keeps your category fixed. Upgrade, or <strong>contact admin</strong> to change it.</span>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {rules.max === 1
              ? 'Tap a category to change your primary.'
              : `Choose up to ${rules.max}. Tap “Make primary” to set the main one.`}
          </p>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{g.group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {g.items.map((c) => {
                    const on = selected.includes(c.slug);
                    const isPrimary = primary === c.slug;
                    return (
                      <div
                        key={c.slug}
                        className={`flex items-center justify-between gap-1 p-2.5 rounded border-2 text-sm ${
                          on ? 'border-primary bg-primary-light' : 'border-gray-200'
                        }`}
                      >
                        <button onClick={() => toggle(c.slug)} className="flex items-center gap-1.5 text-left flex-1 min-w-0">
                          {on && <Check className="w-3.5 h-3.5 shrink-0 text-primary" strokeWidth={3} />}
                          <span className="truncate">{c.label}</span>
                        </button>
                        {rules.max > 1 && on && !isPrimary && (
                          <button onClick={() => makePrimary(c.slug)} className="text-[10px] text-primary underline shrink-0">Make primary</button>
                        )}
                        {isPrimary && <span className="text-[10px] text-primary font-semibold shrink-0">Primary</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={save}
            disabled={saving || !primary}
            className="btn bg-primary text-white px-5 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save categories'}
          </button>
        </>
      )}
    </div>
  );
};

export default CategoriesSection;
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd client && npx vitest run src/tests/ProfileCategories.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Mount the section as a tab in `ProfileSetup.jsx`**

In `client/src/pages/ProfileSetup.jsx`:

1. Add the import near the other component imports (after line 8):

```javascript
import CategoriesSection from "../components/dashboard/CategoriesSection";
```

2. The page tracks `activeSection` (line 114: `'info' | 'social' | 'appearance' | 'integrations'`). Add a `'categories'` tab. Find the tab button row (the buttons that call `setActiveSection('info')` etc.) and add a sibling button:

```jsx
<button
  type="button"
  onClick={() => setActiveSection('categories')}
  className={activeSection === 'categories' ? /* active tab classes */ '' : /* inactive */ ''}
>
  Categories
</button>
```

> Match the exact className expression used by the neighbouring tab buttons (copy their conditional class string, swapping the compared value to `'categories'`). Place it after the "Profile Info" tab button.

3. Add the section body next to the other `{activeSection === '...' && (...)}` blocks:

```jsx
{activeSection === 'categories' && (
  <CategoriesSection
    plan={plan}
    onSaved={(data) => updateUser({ ...user, primary_category: data.primary_category, categories: data.categories })}
  />
)}
```

(`plan`, `user`, and `updateUser` are already in scope — lines 108, 116.)

- [ ] **Step 6: Run the full client suite (ProfileSetup has existing tests)**

Run: `cd client && npx vitest run src/tests/ProfileSetup.test.jsx src/tests/ProfileCategories.test.jsx`
Expected: PASS — existing ProfileSetup tests still green, new section tests green.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/dashboard/CategoriesSection.jsx client/src/pages/ProfileSetup.jsx client/src/tests/ProfileCategories.test.jsx
git commit -m "feat(profile): plan-gated Categories section (Free locked / Creator swap / Pro +2)"
```

---

## Task 11: Admin Categories table redesign

**Files:**
- Modify: `client/src/pages/admin/AdminCategories.jsx` (full rewrite)
- Create: `client/src/tests/AdminCategories.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/tests/AdminCategories.test.jsx`:

```javascript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  adminListCategories: vi.fn(),
  adminCreateCategory: vi.fn(),
  adminUpdateCategory: vi.fn(),
  adminDeleteCategory: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { adminListCategories, adminUpdateCategory } from '../services/api';
import AdminCategories from '../pages/admin/AdminCategories';

const ROWS = [
  { id: '1', slug: 'life-coach', label: 'Life Coach', group_label: 'Coaching & Consulting', status: 'active', registered_hosts: 4, active_services: 9, created_at: '2026-06-20T00:00:00Z' },
  { id: '2', slug: 'astrologer', label: 'Astrologer', group_label: 'Spiritual & Wellness', status: 'disabled', registered_hosts: 0, active_services: 0, created_at: '2026-06-20T00:00:00Z' },
];

beforeEach(() => {
  adminListCategories.mockResolvedValue({ data: ROWS });
  adminUpdateCategory.mockResolvedValue({ data: {} });
});

test('renders the analytics columns and counts', async () => {
  render(<AdminCategories />);
  expect(await screen.findByText('Life Coach')).toBeTruthy();
  expect(screen.getByText('Registered Hosts')).toBeTruthy();
  expect(screen.getByText('Active Services')).toBeTruthy();
  expect(screen.getByText('4')).toBeTruthy(); // registered hosts for life-coach
});

test('status dropdown flips a category off', async () => {
  render(<AdminCategories />);
  await screen.findByText('Life Coach');
  const select = screen.getAllByRole('combobox')[0];
  fireEvent.change(select, { target: { value: 'disabled' } });
  await waitFor(() => expect(adminUpdateCategory).toHaveBeenCalledWith('1', { status: 'disabled' }));
});

test('delete is disabled when hosts are registered', async () => {
  render(<AdminCategories />);
  await screen.findByText('Life Coach');
  const delBtn = screen.getByTitle(/4 hosts registered/i);
  expect(delBtn.disabled).toBe(true);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd client && npx vitest run src/tests/AdminCategories.test.jsx`
Expected: FAIL — current page has no table/analytics columns.

- [ ] **Step 3: Rewrite `AdminCategories.jsx`**

Replace `client/src/pages/admin/AdminCategories.jsx` with:

```javascript
import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus, Clock, Check } from 'lucide-react';
import {
  adminListCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
} from '../../services/api';
import { groupCategories } from '../../utils/categoryUtils';

const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminListCategories()
      .then(({ data }) => setCategories(data || []))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const live = categories.filter((c) => c.status === 'active' || c.status === 'disabled');
  const pending = categories.filter((c) => c.status === 'pending');
  const groups = useMemo(() => groupCategories(live), [live]);
  const knownGroups = useMemo(
    () => [...new Set(categories.map((c) => c.group_label).filter(Boolean))],
    [categories]
  );

  const totals = useMemo(() => ({
    active: live.filter((c) => c.status === 'active').length,
    hosts: live.reduce((n, c) => n + (c.registered_hosts || 0), 0),
    top: [...live].sort((a, b) => (b.registered_hosts || 0) - (a.registered_hosts || 0))[0],
  }), [live]);

  const create = async () => {
    const label = newLabel.trim();
    if (label.length < 2) return toast.error('Enter a category name');
    setCreating(true);
    try {
      await adminCreateCategory({ label, group_label: newGroup.trim() || null, status: 'active' });
      setNewLabel(''); setNewGroup('');
      toast.success('Category created');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create');
    } finally { setCreating(false); }
  };

  const setStatus = async (cat, status) => {
    try {
      await adminUpdateCategory(cat.id, { status });
      toast.success(status === 'active' ? 'Set live' : status === 'disabled' ? 'Turned off' : 'Updated');
      load();
    } catch { toast.error('Update failed'); }
  };

  const remove = async (cat) => {
    if ((cat.registered_hosts || 0) > 0) return;
    if (!window.confirm(`Delete "${cat.label}"? This cannot be undone.`)) return;
    try {
      await adminDeleteCategory(cat.id);
      toast.success('Deleted');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const StatusCell = (cat) => (
    <select
      value={cat.status}
      onChange={(e) => setStatus(cat, e.target.value)}
      className={`text-xs font-medium rounded border px-2 py-1 ${
        cat.status === 'active'
          ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-red-300 bg-red-50 text-red-700'
      }`}
    >
      <option value="active">🟢 Active</option>
      <option value="disabled">🔴 Off</option>
    </select>
  );

  const Row = (cat) => {
    const locked = (cat.registered_hosts || 0) > 0;
    return (
      <tr key={cat.id} className="border-b border-gray-100 last:border-0">
        <td className="px-3 py-2.5">
          <div className="font-medium text-gray-900">{cat.label}</div>
          <div className="text-[11px] text-gray-400">/{cat.slug}</div>
        </td>
        <td className="px-3 py-2.5">{StatusCell(cat)}</td>
        <td className="px-3 py-2.5 text-center tabular-nums">{cat.registered_hosts || 0}</td>
        <td className="px-3 py-2.5 text-center tabular-nums">{cat.active_services || 0}</td>
        <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(cat.created_at)}</td>
        <td className="px-3 py-2.5 text-right">
          <button
            onClick={() => remove(cat)}
            disabled={locked}
            title={locked ? `${cat.registered_hosts} hosts registered — set to Off instead` : 'Delete'}
            className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Industry Categories</h1>
      <p className="text-sm text-gray-500 mb-5">
        Switch categories on/off to control what hosts can pick at onboarding. Phased rollout: turn the next set 🟢 Active when ready.
      </p>

      {/* Analytics strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded border border-gray-200 p-3">
            <div className="text-2xl font-bold text-gray-900">{totals.active}</div>
            <div className="text-xs text-gray-500">Active categories</div>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <div className="text-2xl font-bold text-gray-900">{totals.hosts}</div>
            <div className="text-xs text-gray-500">Hosts categorised</div>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <div className="text-sm font-bold text-gray-900 truncate">{totals.top?.label || '—'}</div>
            <div className="text-xs text-gray-500">Top category</div>
          </div>
        </div>
      )}

      {/* Add new */}
      <div className="flex flex-wrap gap-2 mb-6">
        <input className="fb-input flex-1 min-w-[180px]" placeholder="New category name"
          value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()} />
        <input className="fb-input flex-1 min-w-[160px]" placeholder="Group (e.g. Technology & Product)"
          value={newGroup} onChange={(e) => setNewGroup(e.target.value)} list="cat-groups" />
        <datalist id="cat-groups">{knownGroups.map((g) => <option key={g} value={g} />)}</datalist>
        <button onClick={create} disabled={creating}
          className="btn flex items-center gap-1.5 bg-primary text-white px-4 text-sm font-medium hover:bg-primary-dark disabled:opacity-50 shrink-0">
          <Plus className="w-4 h-4" strokeWidth={3} /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-10 text-center">Loading…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-6 border border-amber-200 rounded overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium">
                <Clock className="w-4 h-4" /> Pending suggestions ({pending.length})
              </div>
              {pending.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-amber-100">
                  <span className="flex-1 font-medium text-gray-900">{cat.label} <span className="text-xs text-gray-400">/{cat.slug}</span></span>
                  <button onClick={() => setStatus(cat, 'active')}
                    className="btn flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-1 hover:bg-green-700">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} /> Approve
                  </button>
                  <button onClick={() => setStatus(cat, 'rejected')}
                    className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Reject</button>
                </div>
              ))}
            </div>
          )}

          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-3 py-2">Category Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-center">Registered Hosts</th>
                  <th className="px-3 py-2 text-center">Active Services</th>
                  <th className="px-3 py-2">Date Added</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <>
                    <tr key={`h-${g.group}`} className="bg-gray-50/60">
                      <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{g.group}</td>
                    </tr>
                    {g.items.map(Row)}
                  </>
                ))}
                {live.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-sm text-gray-400 text-center">No categories yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminCategories;
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd client && npx vitest run src/tests/AdminCategories.test.jsx`
Expected: PASS (3 tests).

> If React warns about the `<>...</>` fragment `key` inside `<tbody>`, wrap each group in `<Fragment key={g.group}>` imported from `react` instead of `<>`.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/AdminCategories.jsx client/src/tests/AdminCategories.test.jsx
git commit -m "feat(admin): categories table redesign — status dropdown, analytics, delete-guard, groups"
```

---

## Task 12: Admin user override UI + host profile chip (light)

**Files:**
- Modify: `client/src/pages/admin/AdminUsers.jsx`
- Modify: `client/src/pages/HostProfile.jsx`
- Modify: `server/controllers/hostController.js` (`getHostProfile` returns the label)

- [ ] **Step 1: Admin "Set category" quick-action in `AdminUsers.jsx`**

In `client/src/pages/admin/AdminUsers.jsx`:

1. Add to the api import: `adminSetUserCategories`, and add `getCategories` (to populate options). Add `useEffect`/state to load active categories once:

```javascript
import { getCategories, adminSetUserCategories } from '../../services/api';
// ...inside the component:
const [catOptions, setCatOptions] = useState([]);
useEffect(() => { getCategories().then(({ data }) => setCatOptions(data || [])).catch(() => {}); }, []);
```

2. Add a handler:

```javascript
const handleSetCategory = async (user, slug) => {
  if (!slug) return;
  try {
    await adminSetUserCategories(user.id, { primary_category: slug, categories: [slug] });
    toast.success('Category updated');
    fetchUsers();
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed');
  }
};
```

3. For host rows only, render a compact select (place it in an existing actions cell, mirroring the role editor pattern at lines 174–194). Show it when `u.role === 'host'`:

```jsx
{u.role === 'host' && (
  <select
    className="border rounded px-1.5 py-1 text-xs"
    value={u.primary_category || ''}
    onChange={(e) => handleSetCategory(u, e.target.value)}
    title="Set primary category"
  >
    <option value="">— category —</option>
    {catOptions.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
  </select>
)}
```

> If the admin users list doesn't already return `primary_category`, the select simply defaults to "— category —"; setting it still works. To show the current value, ensure `getUsers` in `adminController.js` selects `primary_category` (add it to that controller's `.select(...)` list if it uses an explicit column list).

- [ ] **Step 2: Return the primary-category label from `getHostProfile`**

In `server/controllers/hostController.js`, inside `getHostProfile`, after the profile is fetched and before responding, attach the label:

```javascript
// Resolve the primary category's human label for display (best-effort).
if (profile?.primary_category) {
  const { data: cat } = await supabaseAdmin
    .from('categories').select('label').eq('slug', profile.primary_category).maybeSingle();
  profile.primary_category_label = cat?.label || null;
}
```

> Use the existing variable name for the fetched profile object in `getHostProfile` (it may be `profile`, `host`, or `data` — match the surrounding code). Ensure `primary_category` is included in that function's `.select(...)` if it uses an explicit column list rather than `*`.

- [ ] **Step 3: Render the chip in `HostProfile.jsx`**

In `client/src/pages/HostProfile.jsx`, near where the host name/profession renders, add a small chip when present:

```jsx
{host?.primary_category_label && (
  <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-primary-light text-primary">
    {host.primary_category_label}
  </span>
)}
```

> Match the actual prop/variable holding the host object in `HostProfile.jsx` (e.g. `host`, `profile`, or `data`). Place the chip near the existing `profession`/`tagline` display.

- [ ] **Step 4: Verify the client suite + build**

Run: `cd client && npm test`
Expected: PASS (all client tests green).

Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/AdminUsers.jsx client/src/pages/HostProfile.jsx server/controllers/hostController.js
git commit -m "feat(admin/profile): admin set-category control + primary-category chip on host profile"
```

---

## Task 13: Full verification + docs

**Files:**
- Modify: `docs/current-work.md` (append a changelog entry)

- [ ] **Step 1: Run both full suites**

Run: `cd server && npm test`
Expected: all green (includes new `categoryRules` + `planLimits.categories` tests).

Run: `cd client && npm test`
Expected: all green (includes `categoryUtils`, `CategoryStep`, `ProfileCategories`, `AdminCategories`).

- [ ] **Step 2: Live smoke (preview)** — start the app and confirm end-to-end against the migrated DB:
  1. Admin → `/admin/services/categories`: 20 Active + 40 Off, grouped; analytics strip populated; flip one Off→Active and back; confirm delete is disabled on a category with registered hosts and a clean category deletes.
  2. Onboarding step 4: single-select, heading "Pick Your Primary Service Category", only active categories shown; pick one and continue.
  3. Profile settings → Categories tab: as a `starter` host it's locked with the contact-admin note; as `professional` you can add up to 3 and set a primary; save persists (reload shows it).
  4. `PUT /api/host/categories` as a free host returns `403`; as professional with 4 categories returns `403` cap message.
  5. Admin Users: set a free host's category via the select; confirm it updates.

- [ ] **Step 3: Append changelog to `docs/current-work.md`**

Add at the top of the recent-changes section:

```markdown
### 2026-06-20 — Industry Categories (feat/category-system)
- Migration v3.21: 60-category taxonomy (20 active / 40 disabled), `categories.group_label`,
  `status` +`disabled`, `profiles.primary_category`, per-plan `limits.categories`
  (starter 0 / creator 1 / professional 3), `admin_category_stats()` RPC.
- Onboarding step 4 → single-select Primary Category.
- Profile settings → plan-gated Categories section (Free locked / Creator swap / Pro +2).
- Admin `/admin/services/categories` redesigned: status dropdown (on/off), per-category
  analytics, delete-guard for registered categories.
- Endpoints: GET/PUT `/api/host/categories`, PATCH `/api/admin/users/:id/categories`.
```

- [ ] **Step 4: Commit + push**

```bash
git add docs/current-work.md
git commit -m "docs: changelog for industry categories (v3.21)"
git push -u origin feat/category-system
```

- [ ] **Step 5:** Open a PR (use `finishing-a-development-branch` skill or `gh pr create`) summarising the migration apply step as a required deploy action.

---

## Self-Review Notes (author)

- **Spec coverage:** taxonomy/phasing → Task 1; on/off red-green dropdown → Task 11; admin table 5 columns + analytics → Tasks 4+11; delete-guard (server + UI) → Tasks 4+11; single-select onboarding → Tasks 7+9; plan-gated settings (Free/Creator/Pro) → Tasks 2+5+10; Primary invariant → Task 3; admin override / "Free contacts admin" → Tasks 6+12; replace-entirely + orphan clear → Task 1; colors untouched → not modified anywhere. ✔ all mapped.
- **Type/name consistency:** `validateCategorySelection` signature identical in Tasks 3/5/6; `getCategoryRules`/`groupCategories` identical in Tasks 8/9/10/11; API names `hostGetCategories`/`hostUpdateCategories`/`adminSetUserCategories` consistent Tasks 8/10/12; `limits.categories` consistent Tasks 1/2/5. ✔
- **Known risks (flagged in-task):** exact tab-button classes in `ProfileSetup` and the host-object variable names in `getHostProfile`/`HostProfile` must be matched to existing code (Tasks 10/12 note this). Migration must be applied before live smoke (Task 13). React fragment-key note in Task 11.
```
