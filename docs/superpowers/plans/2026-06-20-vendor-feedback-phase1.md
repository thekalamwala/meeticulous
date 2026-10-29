# Vendor Feedback (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a spontaneous vendor→platform feedback channel (submit widget + "my feedback" list), an admin triage pipeline, and an email loop-close that notifies the vendor when their item is planned/shipped/declined — all on a unified schema that surveys (Phase 2) and a public roadmap (Phase 3) extend without rework.

**Architecture:** One `feedback` table (`source` discriminator, dormant `vote_count`/`is_public`/`survey_id` columns for later). Vendor + admin access both go through the Express API using the service-role Supabase client (same pattern as `reviewController`). The loop-close email reuses the existing notification engine → communication engine (DB template). A single `vendor_feedback` feature flag gates the whole thing.

**Tech Stack:** Node/Express, Supabase (Postgres, service-role client), Jest (server unit tests, `--runInBand`), React 18 + Vite + react-router v6, Tailwind, Vitest (client).

**Spec:** `docs/superpowers/specs/2026-06-20-vendor-feedback-design.md`

**Conventions locked from the codebase (do not deviate):**
- Controllers use `const { supabaseAdmin } = require("../config/supabase")` and `const { safeError } = require('../utils/httpError')`.
- Vendor routes: `protect` (attaches `req.user`) + `requireFeature('<key>')`. Admin routes: `requireAdmin('<perm>')` (attaches `req.admin`).
- Background side-effects: `const { runInBackground } = require('../utils/background')`.
- Notifications: `require('../services/notificationEngine').send({ event, data })`.
- Next migration version is **v3.20** (highest present is `v3.19_service_seo.sql`). All DDL idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`).
- Server unit-test mock pattern: `jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }))` with a chainable `c` object (see `server/tests/unit/featureFlagController.test.js`).

**Scope notes / deliberate YAGNI for P1:**
- RLS is **server-only** (enable RLS, no client policies) because all access is via the Express API + service-role client, matching the hardened pattern used for `feature_flags`. The spec's "vendor reads own via RLS" wording is satisfied at the API layer, not by client-key RLS.
- The optional `FEEDBACK_RECEIVED_ADMIN` ops-ping email is **deferred** — admins see new items in the inbox immediately. Only the vendor-facing `FEEDBACK_STATUS_CHANGED` email is wired in P1.
- The persistent vendor entry point is a nav item + a floating Link button in `DashboardLayout` (both gated). No modal-portal state in P1; the submit form lives on `/dashboard/feedback`.

---

## File Structure

**Server — create:**
- `server/migrations/v3.20_vendor_feedback.sql` — `feedback` table, indexes, RLS, notification event seed.
- `server/controllers/feedbackController.js` — vendor: `createFeedback`, `getMyFeedback`.
- `server/controllers/feedbackAdminController.js` — admin: `listFeedback`, `updateFeedbackStatus`.
- `server/routes/feedbackRoutes.js` — vendor routes (gated).
- `server/tests/unit/feedbackController.test.js`
- `server/tests/unit/feedbackAdminController.test.js`

**Server — modify:**
- `server/config/featureRegistry.js` — add `vendor_feedback` flag.
- `server/lib/adminPermissions.js` — add `feedback.view` / `feedback.manage` + role grants.
- `server/config/emailTemplates.js` — add `FEEDBACK_STATUS_CHANGED` vendor template.
- `server/routes/adminRoutes.js` — mount admin feedback routes.
- `server/server.js` — mount `/api/feedback`.

**Client — create:**
- `client/src/pages/Feedback.jsx` — vendor submit form + "my feedback" list.
- `client/src/pages/admin/AdminFeedback.jsx` — triage table + detail drawer.

**Client — modify:**
- `client/src/services/api.js` — feedback API functions.
- `client/src/components/common/DashboardLayout.jsx` — nav item + floating button (gated).
- `client/src/components/common/AdminLayout.jsx` — Support-section nav item.
- `client/src/App.jsx` — lazy imports + routes.

---

## Task 1: Database migration (`feedback` table + RLS + notification event)

**Files:**
- Create: `server/migrations/v3.20_vendor_feedback.sql`

- [ ] **Step 1: Write the migration**

```sql
-- v3.20_vendor_feedback.sql
-- Vendor → platform feedback. Unified schema: P1 widget submissions; P2 surveys
-- reuse the same table (source='survey', survey_id, rating); P3 roadmap reuses
-- the dormant vote_count/is_public columns. All access is server-side via the
-- service-role client, so RLS is enabled with NO client policies (deny direct
-- anon/authenticated key access; service role bypasses RLS).

CREATE TABLE IF NOT EXISTS feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source        text NOT NULL DEFAULT 'widget' CHECK (source IN ('widget','survey')),
  type          text NOT NULL CHECK (type IN ('idea','bug','complaint','praise','other')),
  area          text CHECK (area IN ('booking','payments','dashboard','profile','availability','other')),
  rating        int  CHECK (rating BETWEEN 0 AND 10),
  subject       text,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','planned','shipped','declined')),
  admin_note    text,
  admin_response text,
  screenshot_url text,
  context       jsonb,
  vote_count    int NOT NULL DEFAULT 0,      -- dormant (P3)
  is_public     boolean NOT NULL DEFAULT false, -- dormant (P3)
  survey_id     uuid,                         -- P2 link; FK added in P2 migration
  handled_by    uuid,
  handled_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_vendor ON feedback (vendor_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback (source);
CREATE INDEX IF NOT EXISTS idx_feedback_type   ON feedback (type);

-- Server-only access (service role bypasses RLS; no client-key policies).
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Vendor-facing loop-close notification. Email on; WhatsApp off (disabled
-- platform-wide). campaign_name blank — admin can wire AiSensy later.
INSERT INTO notification_events
  (event_key, display_name, whatsapp_enabled, email_enabled, campaign_name, email_subject)
VALUES
  ('FEEDBACK_STATUS_CHANGED', 'Vendor Feedback Status Update', false, true, '', NULL)
ON CONFLICT (event_key) DO NOTHING;
```

- [ ] **Step 2: Apply to the staging DB (Tokyo) and verify the table exists**

Apply via the Supabase SQL Editor (or MCP `apply_migration`) against the staging project, then verify:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'feedback' ORDER BY ordinal_position;
```
Expected: the 21 columns above are listed.

> Production (Mumbai) gets the same SQL at merge/deploy time — see Task 11. Do NOT apply to prod during development.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.20_vendor_feedback.sql
git commit -m "feat(feedback): v3.20 migration — feedback table + RLS + notification event"
```

---

## Task 2: Feature flag `vendor_feedback`

**Files:**
- Modify: `server/config/featureRegistry.js`
- Test: `server/tests/unit/featureRegistryFeedback.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/featureRegistryFeedback.test.js
const { REGISTRY, KEYS } = require('../../config/featureRegistry');

test('vendor_feedback flag is registered with the right shape', () => {
  expect(KEYS).toContain('vendor_feedback');
  const f = REGISTRY.find((x) => x.key === 'vendor_feedback');
  expect(f).toMatchObject({ key: 'vendor_feedback', scope: 'vendor', category: 'Operations' });
  expect(typeof f.label).toBe('string');
  expect(typeof f.description).toBe('string');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/featureRegistryFeedback.test.js --runInBand`
Expected: FAIL — `KEYS` does not contain `vendor_feedback`.

- [ ] **Step 3: Add the flag**

In `server/config/featureRegistry.js`, add to the `// ── VENDOR · Operations ──` block (after the `transactions` entry, line ~46):

```js
  { key: 'vendor_feedback',      label: 'Vendor Feedback',      category: 'Operations', scope: 'vendor', description: 'Vendor feedback widget + "my feedback" list. Off = feedback UI hidden and submit blocked.' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/featureRegistryFeedback.test.js --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/config/featureRegistry.js server/tests/unit/featureRegistryFeedback.test.js
git commit -m "feat(feedback): add vendor_feedback feature flag"
```

---

## Task 3: Admin permissions `feedback.view` / `feedback.manage`

**Files:**
- Modify: `server/lib/adminPermissions.js`
- Test: `server/tests/unit/adminPermissionsFeedback.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/adminPermissionsFeedback.test.js
const { PERMISSIONS, ROLES } = require('../../lib/adminPermissions');

test('feedback permissions exist', () => {
  expect(PERMISSIONS).toEqual(expect.arrayContaining(['feedback.view', 'feedback.manage']));
});

test('operations role can view + manage feedback; support can view', () => {
  expect(ROLES.operations.permissions).toEqual(expect.arrayContaining(['feedback.view', 'feedback.manage']));
  expect(ROLES.support.permissions).toContain('feedback.view');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/adminPermissionsFeedback.test.js --runInBand`
Expected: FAIL — permissions missing.

- [ ] **Step 3: Add permissions + grants**

In `server/lib/adminPermissions.js`:

1. In the `PERMISSIONS` array, add after the `'reviews.moderate',` line (in the Support group, ~line 48):
```js
  'feedback.view', 'feedback.manage',
```

2. In `ROLES.operations.permissions`, add after `'reviews.moderate',` (~line 93):
```js
      'feedback.view', 'feedback.manage',
```

3. In `ROLES.support.permissions`, add after `'reviews.moderate',` (~line 113):
```js
      'feedback.view',
```

> The module's load-time loop validates every role permission against `PERMISSION_SET`, so step 1 must precede steps 2–3 logically (they're in the same file edit). `super` already passes via the `*` wildcard.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/unit/adminPermissionsFeedback.test.js tests/unit/adminPermissions.test.js --runInBand`
Expected: PASS (both the new test and the existing `adminPermissions.test.js`, which asserts role integrity).

- [ ] **Step 5: Commit**

```bash
git add server/lib/adminPermissions.js server/tests/unit/adminPermissionsFeedback.test.js
git commit -m "feat(feedback): add feedback.view/manage admin permissions"
```

> **Deploy note (not a code step):** existing admins receive the new permission on their NEXT login (permissions are embedded in the JWT at login, and the `admin_roles` table is re-seeded from this catalog on boot). Capture this in Task 11's deploy checklist.

---

## Task 4: Vendor controller — `createFeedback` + `getMyFeedback`

**Files:**
- Create: `server/controllers/feedbackController.js`
- Test: `server/tests/unit/feedbackController.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// server/tests/unit/feedbackController.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { createFeedback, getMyFeedback } = require('../../controllers/feedbackController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('createFeedback rejects missing body', async () => {
  const r = res();
  await createFeedback({ user: { id: 'v1' }, body: { type: 'idea' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('createFeedback rejects unknown type', async () => {
  const r = res();
  await createFeedback({ user: { id: 'v1' }, body: { type: 'spam', body: 'hi' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('createFeedback rejects unknown area', async () => {
  const r = res();
  await createFeedback({ user: { id: 'v1' }, body: { type: 'idea', body: 'hi', area: 'nope' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('createFeedback inserts a new widget row scoped to the vendor', async () => {
  let inserted = null;
  mockFrom.mockImplementation(() => {
    const c = {
      insert: jest.fn((row) => { inserted = row; return c; }),
      select: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({ data: { id: 'f1', status: 'new' }, error: null }),
    };
    return c;
  });
  const r = res();
  await createFeedback(
    { user: { id: 'v1' }, body: { type: 'bug', area: 'booking', subject: 'X', body: 'broken' } },
    r,
  );
  expect(inserted).toMatchObject({
    vendor_id: 'v1', source: 'widget', type: 'bug', area: 'booking', subject: 'X', body: 'broken', status: 'new',
  });
  expect(r.status).toHaveBeenCalledWith(201);
});

test('getMyFeedback returns the vendor\'s own rows newest-first', async () => {
  const rows = [{ id: 'f2' }, { id: 'f1' }];
  const order = jest.fn().mockResolvedValue({ data: rows, error: null });
  const eq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq }));
  mockFrom.mockImplementation(() => ({ select }));
  const r = res();
  await getMyFeedback({ user: { id: 'v1' } }, r);
  expect(eq).toHaveBeenCalledWith('vendor_id', 'v1');
  expect(r.json).toHaveBeenCalledWith({ feedback: rows });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/unit/feedbackController.test.js --runInBand`
Expected: FAIL — `Cannot find module '../../controllers/feedbackController'`.

- [ ] **Step 3: Implement the controller**

```js
// server/controllers/feedbackController.js
// Vendor → platform feedback (Phase 1: spontaneous widget submissions).
// All access is server-side via the service-role client. Admin triage lives in
// feedbackAdminController.js.
const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require("../utils/httpError");

const TYPES = ["idea", "bug", "complaint", "praise", "other"];
const AREAS = ["booking", "payments", "dashboard", "profile", "availability", "other"];
const MAX_BODY = 4000;
const MAX_SUBJECT = 160;

// POST /api/feedback — vendor submits feedback
const createFeedback = async (req, res) => {
  try {
    const { type, area, subject, body, screenshot_url, context } = req.body || {};

    if (!body || !String(body).trim())
      return res.status(400).json({ message: "Feedback body is required" });
    if (String(body).length > MAX_BODY)
      return res.status(400).json({ message: `Feedback is too long (max ${MAX_BODY} chars)` });
    if (!TYPES.includes(type))
      return res.status(400).json({ message: "Invalid feedback type" });
    if (area != null && !AREAS.includes(area))
      return res.status(400).json({ message: "Invalid feedback area" });
    if (subject != null && String(subject).length > MAX_SUBJECT)
      return res.status(400).json({ message: `Subject is too long (max ${MAX_SUBJECT} chars)` });

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .insert({
        vendor_id: req.user.id,
        source: "widget",
        type,
        area: area || null,
        subject: subject ? String(subject).trim() : null,
        body: String(body).trim(),
        screenshot_url: screenshot_url || null,
        context: context || null,
        status: "new",
      })
      .select()
      .single();

    if (error) return safeError(res, error);
    res.status(201).json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/feedback/mine — the vendor's own submissions + current status
const getMyFeedback = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("feedback")
      .select("id, type, area, subject, body, status, admin_response, created_at, updated_at")
      .eq("vendor_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return safeError(res, error);
    res.json({ feedback: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { createFeedback, getMyFeedback, TYPES, AREAS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/unit/feedbackController.test.js --runInBand`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/feedbackController.js server/tests/unit/feedbackController.test.js
git commit -m "feat(feedback): vendor createFeedback + getMyFeedback controller"
```

---

## Task 5: Admin controller — `listFeedback` + `updateFeedbackStatus` (loop-close notify)

**Files:**
- Create: `server/controllers/feedbackAdminController.js`
- Test: `server/tests/unit/feedbackAdminController.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// server/tests/unit/feedbackAdminController.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
// Run background tasks synchronously so we can assert the notify call.
jest.mock('../../utils/background', () => ({ runInBackground: (_label, fn) => fn() }));
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('../../services/notificationEngine', () => ({ send: (...a) => mockSend(...a) }));

const { listFeedback, updateFeedbackStatus } = require('../../controllers/feedbackAdminController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('updateFeedbackStatus rejects an invalid status', async () => {
  const r = res();
  await updateFeedbackStatus({ params: { id: 'f1' }, body: { status: 'bogus' }, admin: { id: 'a1' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('updateFeedbackStatus updates, stamps handler, and notifies the vendor on "shipped"', async () => {
  let updated = null;
  // First .from() call → the UPDATE chain returning the joined vendor.
  mockFrom.mockImplementation(() => {
    const c = {
      update: jest.fn((row) => { updated = row; return c; }),
      eq: jest.fn(() => c),
      select: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({
        data: { id: 'f1', status: 'shipped', subject: 'Dark mode', admin_response: 'Done!',
                profiles: { name: 'Asha', email: 'asha@x.com' } },
        error: null,
      }),
    };
    return c;
  });
  const r = res();
  await updateFeedbackStatus(
    { params: { id: 'f1' }, body: { status: 'shipped', admin_response: 'Done!' }, admin: { id: 'a1' } },
    r,
  );
  expect(updated).toMatchObject({ status: 'shipped', admin_response: 'Done!', handled_by: 'a1' });
  expect(updated.handled_at).toBeTruthy();
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
    event: 'FEEDBACK_STATUS_CHANGED',
    data: expect.objectContaining({ email: 'asha@x.com', audience: 'vendor' }),
  }));
  expect(r.json).toHaveBeenCalled();
});

test('updateFeedbackStatus does NOT notify when moving to "reviewing"', async () => {
  mockFrom.mockImplementation(() => {
    const c = { update: jest.fn(() => c), eq: jest.fn(() => c), select: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({ data: { id: 'f1', status: 'reviewing', profiles: { email: 'a@x.com' } }, error: null }) };
    return c;
  });
  const r = res();
  await updateFeedbackStatus({ params: { id: 'f1' }, body: { status: 'reviewing' }, admin: { id: 'a1' } }, r);
  expect(mockSend).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/unit/feedbackAdminController.test.js --runInBand`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the admin controller**

```js
// server/controllers/feedbackAdminController.js
// Admin triage for vendor feedback: list with filters, and a status pipeline
// that closes the loop by emailing the vendor on planned/shipped/declined.
const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require("../utils/httpError");
const { runInBackground } = require("../utils/background");
const NotificationEngine = require("../services/notificationEngine");

const STATUSES = ["new", "reviewing", "planned", "shipped", "declined"];
const NOTIFY_ON = new Set(["planned", "shipped", "declined"]);
const STATUS_LABELS = {
  planned: "planned", shipped: "shipped", declined: "declined",
  new: "received", reviewing: "under review",
};

// GET /api/admin/feedback — triage list with optional filters
const listFeedback = async (req, res) => {
  try {
    const { status, type, area, search } = req.query || {};
    let q = supabaseAdmin
      .from("feedback")
      .select("id, vendor_id, source, type, area, subject, body, status, admin_note, admin_response, created_at, updated_at, profiles:vendor_id(name, email)")
      .order("created_at", { ascending: false });

    if (status && STATUSES.includes(status)) q = q.eq("status", status);
    if (type) q = q.eq("type", type);
    if (area) q = q.eq("area", area);
    if (search) q = q.ilike("body", `%${search}%`);

    const { data, error } = await q;
    if (error) return safeError(res, error);
    res.json({ feedback: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /api/admin/feedback/:id — set status / note / response; close the loop
const updateFeedbackStatus = async (req, res) => {
  try {
    const { status, admin_note, admin_response } = req.body || {};
    if (!STATUSES.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const patch = {
      status,
      handled_by: req.admin.id,
      handled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (admin_note !== undefined) patch.admin_note = admin_note;
    if (admin_response !== undefined) patch.admin_response = admin_response;

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .update(patch)
      .eq("id", req.params.id)
      .select("id, vendor_id, status, subject, admin_response, profiles:vendor_id(name, email)")
      .single();

    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: "Feedback not found" });

    // Close the loop: notify the vendor when the item reaches a decision state.
    if (NOTIFY_ON.has(status) && data.profiles?.email) {
      runInBackground("feedback-status-notify", () =>
        NotificationEngine.send({
          event: "FEEDBACK_STATUS_CHANGED",
          data: {
            email: data.profiles.email,
            name: data.profiles.name,
            audience: "vendor",
            recipientUserId: data.vendor_id,
            emailData: {
              status_label: STATUS_LABELS[status] || status,
              feedback_subject: data.subject || "your feedback",
              admin_response: data.admin_response || "",
            },
          },
        }),
      );
    }

    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { listFeedback, updateFeedbackStatus, STATUSES };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/unit/feedbackAdminController.test.js --runInBand`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/feedbackAdminController.js server/tests/unit/feedbackAdminController.test.js
git commit -m "feat(feedback): admin list + status pipeline with loop-close notify"
```

---

## Task 6: Routes — vendor router + mount, admin routes

**Files:**
- Create: `server/routes/feedbackRoutes.js`
- Modify: `server/server.js`, `server/routes/adminRoutes.js`

- [ ] **Step 1: Create the vendor router**

```js
// server/routes/feedbackRoutes.js
const express = require('express');
const router = express.Router();
const { createFeedback, getMyFeedback } = require('../controllers/feedbackController');
const { protect } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/requireFeature');

// POST is gated by the kill-switch; the global apiLimiter (server.js) already
// rate-limits /api, so no extra limiter here.
router.post('/', protect, requireFeature('vendor_feedback'), createFeedback);
router.get('/mine', protect, getMyFeedback);

module.exports = router;
```

- [ ] **Step 2: Mount the vendor router in `server.js`**

In `server/server.js`, after line 92 (`app.use('/api/reviews', ...)`), add:

```js
app.use('/api/feedback',    require('./routes/feedbackRoutes'));
```

- [ ] **Step 3: Add admin routes in `adminRoutes.js`**

In `server/routes/adminRoutes.js`, after the Notification system block (after line 98), add:

```js
// ── Vendor feedback (triage) ───────────────────────────────────
const feedbackAdmin = require('../controllers/feedbackAdminController');
router.get('/feedback',         requireAdmin('feedback.view'),   feedbackAdmin.listFeedback);
router.patch('/feedback/:id',   requireAdmin('feedback.manage'), feedbackAdmin.updateFeedbackStatus);
```

- [ ] **Step 4: Verify the server boots and routes are wired**

Run: `cd server && node -e "require('./routes/feedbackRoutes'); require('./routes/adminRoutes'); console.log('routes ok')"`
Expected: prints `routes ok` with no `Cannot find module` / throw.

Then run the full unit suite to confirm nothing regressed:
Run: `cd server && npx jest --runInBand`
Expected: PASS (all suites, including the 3 new feedback specs).

- [ ] **Step 5: Commit**

```bash
git add server/routes/feedbackRoutes.js server/server.js server/routes/adminRoutes.js
git commit -m "feat(feedback): mount vendor /api/feedback + admin triage routes"
```

---

## Task 7: Loop-close email template

**Files:**
- Modify: `server/config/emailTemplates.js`

- [ ] **Step 1: Add the template definition**

In `server/config/emailTemplates.js`, add a new entry to the `TEMPLATES` array (place it near other vendor-lifecycle templates; any position is fine — seeding is keyed by `event_key`+`audience`):

```js
  {
    event_key: 'FEEDBACK_STATUS_CHANGED', audience: 'vendor', category: 'Engagement',
    name: 'Feedback Status Update', subject: 'Update on your feedback: {{feedback_subject}}',
    preview_text: 'Your feedback is now {{status_label}}.',
    email_category: 'Product Feedback',
    email_reason: 'You are receiving this email because you submitted feedback on Meeticulous.',
    html_content:
      eyebrow('Your feedback') + h('Your feedback is now {{status_label}}') +
      lead('Thanks for helping us improve Meeticulous. Here is where your feedback stands:') +
      card(
        detail('Your feedback', '{{feedback_subject}}') +
        detail('Status', '{{status_label}}'),
      ) +
      lead('{{admin_response}}') +
      note('Have more to share? Open Feedback in your dashboard any time.'),
    cta_label: 'Open my feedback', cta_url: '{{dashboard_url}}',
  },
```

> `eyebrow`, `h`, `lead`, `card`, `detail`, `note` are the helpers already defined at the top of the file. `{{dashboard_url}}`, `{{brand_color}}`, etc. are resolved by `placeholderResolver.js` globals. `{{status_label}}`, `{{feedback_subject}}`, `{{admin_response}}` come from the controller's `emailData` (Task 5).

- [ ] **Step 2: Seed the template into staging and verify**

Run (with `server/.env` pointed at staging):
`cd server && node scripts/seedEmailTemplates.js`
Expected: idempotent upsert output; no error. Verify:

```sql
SELECT event_key, audience, status FROM email_templates WHERE event_key = 'FEEDBACK_STATUS_CHANGED';
```
Expected: one `active` row, audience `vendor`.

> If `seedEmailTemplates.js` requires a flag/arg, run `node scripts/seedEmailTemplates.js --help` first and follow it. The script is idempotent (upsert by event_key+audience).

- [ ] **Step 3: Commit**

```bash
git add server/config/emailTemplates.js
git commit -m "feat(feedback): FEEDBACK_STATUS_CHANGED vendor email template"
```

---

## Task 8: Client API functions

**Files:**
- Modify: `client/src/services/api.js`

- [ ] **Step 1: Add the feedback API calls**

In `client/src/services/api.js`, after the reviews block (after line 231, `getBookingReview`), add:

```js
// ── Vendor feedback ──────────────────────────────────────────
export const submitFeedback  = (data)   => API.post('/feedback', data);
export const getMyFeedback   = ()       => API.get('/feedback/mine');

// Admin feedback (uses the admin API client + token; mirror existing admin calls)
export const adminListFeedback   = (params)      => API.get('/admin/feedback', { params });
export const adminUpdateFeedback = (id, data)    => API.patch(`/admin/feedback/${id}`, data);
```

> Confirm how existing admin calls attach the `bas_admin` token in this file (search for another `'/admin/...'` call, e.g. campaigns or features, and match its client/instance). If admin calls use a separate axios instance or interceptor, use the same one for `adminListFeedback`/`adminUpdateFeedback` instead of the public `API`.

- [ ] **Step 2: Verify the client still builds**

Run: `cd client && npm run build`
Expected: build succeeds (no unresolved import / syntax error).

- [ ] **Step 3: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(feedback): client API functions"
```

---

## Task 9: Vendor Feedback page + dashboard entry points

**Files:**
- Create: `client/src/pages/Feedback.jsx`
- Modify: `client/src/components/common/DashboardLayout.jsx`, `client/src/App.jsx`

- [ ] **Step 1: Build the Feedback page**

```jsx
// client/src/pages/Feedback.jsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { submitFeedback, getMyFeedback } from '../services/api';

const TYPES = [
  { v: 'idea', label: '💡 Idea' },
  { v: 'bug', label: '🐞 Bug' },
  { v: 'complaint', label: '😕 Complaint' },
  { v: 'praise', label: '🎉 Praise' },
  { v: 'other', label: 'Other' },
];
const AREAS = ['booking', 'payments', 'dashboard', 'profile', 'availability', 'other'];
const STATUS_STYLE = {
  new: 'bg-gray-100 text-gray-600', reviewing: 'bg-blue-100 text-blue-700',
  planned: 'bg-amber-100 text-amber-700', shipped: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
};

export default function Feedback() {
  const [type, setType] = useState('idea');
  const [area, setArea] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { const { data } = await getMyFeedback(); setItems(data.feedback || []); }
    catch { /* non-fatal */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return toast.error('Please write your feedback');
    setSaving(true);
    try {
      await submitFeedback({ type, area: area || undefined, subject: subject || undefined, body, context: { page_url: window.location.href, user_agent: navigator.userAgent } });
      toast.success('Thanks! We read every piece of feedback.');
      setSubject(''); setBody(''); setArea(''); setType('idea');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send feedback');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-sm text-gray-500">Tell us what's working, what's not, and what you'd love to see. We read everything.</p>
      </header>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 max-w-2xl">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button type="button" key={t.v} onClick={() => setType(t.v)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${type === t.v ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <select value={area} onChange={(e) => setArea(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Which area? (optional)</option>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160}
            placeholder="Short title (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={5}
          placeholder="Your feedback…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <button type="submit" disabled={saving}
          className="btn bg-primary text-white px-5 py-2 text-sm font-medium disabled:opacity-60">
          {saving ? 'Sending…' : 'Send feedback'}
        </button>
      </form>

      <section className="max-w-2xl">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Your feedback</h2>
        {loading ? <p className="text-sm text-gray-400">Loading…</p>
          : items.length === 0 ? <p className="text-sm text-gray-400">You haven't sent any feedback yet.</p>
          : (
            <ul className="space-y-3">
              {items.map((f) => (
                <li key={f.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm">{f.subject || f.type}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[f.status] || 'bg-gray-100 text-gray-600'}`}>{f.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{f.body}</p>
                  {f.admin_response && (
                    <p className="text-xs text-gray-500 mt-2 border-l-2 border-primary/40 pl-2">
                      <span className="font-semibold">Team:</span> {f.admin_response}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add nav item + floating button to `DashboardLayout.jsx` (gated)**

In `client/src/components/common/DashboardLayout.jsx`:

1. Add the import at the top:
```jsx
import FeatureGate from './FeatureGate';
```

2. Add a nav entry to `NAV_ITEMS` (after the `Profile` item, line ~12):
```jsx
  { to:'/dashboard/feedback',       label:'Feedback',      icon:'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z' },
```

3. Add a floating button inside the `<main>` element, just before `{children}` (so it persists on every dashboard page). Replace the `<main>` block (lines ~178-181) with:
```jsx
      {/* Main */}
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 pb-28 sm:px-6 md:px-8 md:pb-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
        <FeatureGate flag="vendor_feedback">
          <Link to="/dashboard/feedback"
            className="hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-primary/90 transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>
            Feedback
          </Link>
        </FeatureGate>
      </main>
```
(`Link` is already imported at the top of the file.)

> The nav item is not wrapped in `FeatureGate` (it's a static array); that's acceptable — the route + page are the real gate. If you want the nav item hidden when off too, filter `NAV_ITEMS` against `useFeature('vendor_feedback')` inside the component. Optional for P1.

- [ ] **Step 3: Wire the route in `App.jsx`**

1. Add the lazy import near the other vendor dashboard pages (after line 64, `Transactions`):
```jsx
const Feedback     = lazy(() => import('./pages/Feedback'));
```

2. Add the route in the "Vendor dashboard" block (after line 236, the transactions route):
```jsx
          <Route path="/dashboard/feedback" element={<DashboardWrapper><Feedback /></DashboardWrapper>} />
```

- [ ] **Step 4: Verify build + render**

Run: `cd client && npm run build`
Expected: build succeeds.

Then verify in the preview (dev server): the vendor dashboard shows a **Feedback** nav item and a floating Feedback button; `/dashboard/feedback` renders the form + empty "Your feedback" list. Submitting a test item shows the success toast and the item appears with a `new` badge. (Use the preview workflow — start server, navigate, snapshot.)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Feedback.jsx client/src/components/common/DashboardLayout.jsx client/src/App.jsx
git commit -m "feat(feedback): vendor Feedback page + dashboard entry points"
```

---

## Task 10: Admin triage page

**Files:**
- Create: `client/src/pages/admin/AdminFeedback.jsx`
- Modify: `client/src/components/common/AdminLayout.jsx`, `client/src/App.jsx`

- [ ] **Step 1: Build the admin triage page**

```jsx
// client/src/pages/admin/AdminFeedback.jsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminListFeedback, adminUpdateFeedback } from '../../services/api';

const STATUSES = ['new', 'reviewing', 'planned', 'shipped', 'declined'];
const STATUS_STYLE = {
  new: 'bg-gray-100 text-gray-600', reviewing: 'bg-blue-100 text-blue-700',
  planned: 'bg-amber-100 text-amber-700', shipped: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
};

export default function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // row being triaged
  const [resp, setResp] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    try { const { data } = await adminListFeedback(filter ? { status: filter } : {}); setItems(data.feedback || []); }
    catch (e) { toast.error('Could not load feedback'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const openRow = (f) => { setActive(f); setResp(f.admin_response || ''); setNote(f.admin_note || ''); };

  const save = async (status) => {
    try {
      await adminUpdateFeedback(active.id, { status, admin_response: resp, admin_note: note });
      toast.success(`Marked ${status}`);
      setActive(null); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Update failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Vendor Feedback</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p>
        : items.length === 0 ? <p className="text-sm text-gray-400">No feedback.</p>
        : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr><th className="text-left px-4 py-2">Vendor</th><th className="text-left px-4 py-2">Type</th><th className="text-left px-4 py-2">Feedback</th><th className="text-left px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{f.profiles?.name || '—'}</td>
                    <td className="px-4 py-2">{f.type}{f.area ? ` · ${f.area}` : ''}</td>
                    <td className="px-4 py-2 max-w-md truncate">{f.subject || f.body}</td>
                    <td className="px-4 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[f.status]}`}>{f.status}</span></td>
                    <td className="px-4 py-2 text-right"><button onClick={() => openRow(f)} className="text-primary text-xs font-medium hover:underline">Triage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {active && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setActive(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold">{active.subject || active.type}</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{active.body}</p>
            <div>
              <label className="text-xs font-semibold text-gray-500">Reply to vendor (sent on planned/shipped/declined)</label>
              <textarea value={resp} onChange={(e) => setResp(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Internal note</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => save(s)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">{s}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the admin nav item**

In `client/src/components/common/AdminLayout.jsx`, add to the `support` section's `items` array (after the Reviews Moderation entry, line ~165):
```jsx
    { label:'Vendor Feedback',    icon:'msgSq', to:'/admin/feedback', perm:'feedback.view' },
```
Also add `feedback:'Vendor Feedback',` to the `PATH_LABELS` object (line ~84-100) so the breadcrumb reads correctly:
```jsx
  feedback:'Vendor Feedback',
```

- [ ] **Step 3: Wire the admin route in `App.jsx`**

1. Add the lazy import near other admin support pages (after line 113, `AdminReviews`):
```jsx
const AdminFeedback  = lazy(() => import('./pages/admin/AdminFeedback'));
```

2. Add the route in the "Support" block (after line 280, the reviews route):
```jsx
          <Route path="/admin/feedback" element={<AdminWrapper><AdminFeedback /></AdminWrapper>} />
```

- [ ] **Step 4: Verify build + end-to-end loop**

Run: `cd client && npm run build`
Expected: build succeeds.

Then verify in the preview with the server running:
1. As a vendor, submit feedback on `/dashboard/feedback`.
2. As an admin (with `feedback.view`), open `/admin/feedback`, see the row, click **Triage**, write a reply, click **shipped**.
3. Reload the vendor `/dashboard/feedback` — the item shows `shipped` and the team reply.
4. Confirm the email attempt: check `email_logs` for an `FEEDBACK_STATUS_CHANGED` row (status `queued`/`sent`), or the server log line for the background notify.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/AdminFeedback.jsx client/src/components/common/AdminLayout.jsx client/src/App.jsx
git commit -m "feat(feedback): admin triage page + nav + route"
```

---

## Task 11: Full verification + deploy checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the entire server suite**

Run: `cd server && npx jest --runInBand`
Expected: all suites PASS (existing + `featureRegistryFeedback`, `adminPermissionsFeedback`, `feedbackController`, `feedbackAdminController`).

- [ ] **Step 2: Build the client**

Run: `cd client && npm run build`
Expected: success.

- [ ] **Step 3: Feature-flag off path**

In the preview, toggle `vendor_feedback` OFF in `/admin/features`, then:
- `POST /api/feedback` returns **503** (`feature_disabled: vendor_feedback`).
- The floating Feedback button disappears from the dashboard.
Toggle back ON.

- [ ] **Step 4: Record the deploy checklist in the PR description**

The following are **ops actions at deploy**, not code:
1. Apply `server/migrations/v3.20_vendor_feedback.sql` to **both** DBs (Mumbai prod + Tokyo staging) via the Supabase SQL Editor / MCP.
2. Run `node scripts/seedEmailTemplates.js` against **both** DBs to seed the `FEEDBACK_STATUS_CHANGED` template.
3. Admins must re-login to pick up `feedback.view` / `feedback.manage` (JWT permissions refresh on login).
4. `vendor_feedback` ships ON by default (registry default) — flip in `/admin/features` if a staged rollout is wanted.

- [ ] **Step 5: Finalize the branch**

Use the `superpowers:finishing-a-development-branch` skill to open the PR (base `main`), pasting the deploy checklist above into the PR body.

---

## Self-Review

**Spec coverage:**
- §3 data model → Task 1 (table + dormant `vote_count`/`is_public`/`survey_id`). ✓
- §4 server components → Tasks 4, 5, 6. Client surfaces → Tasks 9, 10. ✓
- §5 loop-close notifications → Task 5 (fire) + Task 7 (template) + Task 1 (event seed). `FEEDBACK_RECEIVED_ADMIN` explicitly deferred (documented). ✓
- §6 feature flag → Task 2. ✓
- §7 permissions → Task 3. ✓
- §8 error handling → Task 4 (enum/length validation), Task 5 (best-effort background notify), apiLimiter (global). Screenshot is optional (`screenshot_url` nullable; upload UI deferred — body has no uploader in P1, only the column + API field exist). ✓ *(Note: P1 ships the `screenshot_url` field end-to-end in the API/schema but no client uploader widget; that's a deliberate trim — flagged here so it's not mistaken for full coverage.)*
- §9 testing → Tasks 2–6 unit tests; Tasks 9–11 build + preview + flag-off. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type/name consistency:** `vendor_feedback` (flag), `feedback.view`/`feedback.manage` (perms), `FEEDBACK_STATUS_CHANGED` (event + template + controller emailData), `submitFeedback`/`getMyFeedback`/`adminListFeedback`/`adminUpdateFeedback` (api.js → used in Feedback.jsx/AdminFeedback.jsx), `/api/feedback` + `/api/admin/feedback/:id` (routes ↔ api.js). Controller `emailData` keys (`status_label`, `feedback_subject`, `admin_response`) match the `{{...}}` placeholders in the Task 7 template. ✓

**Known deferrals (documented, intentional):** screenshot uploader UI, `FEEDBACK_RECEIVED_ADMIN` ops-ping, Phase 2 surveys, Phase 3 roadmap.
