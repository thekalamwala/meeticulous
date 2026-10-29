# Email Campaigns (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin send a targeted, scheduled or immediate **email campaign** to a consented segment of contacts, reusing the existing email engine, and see per-recipient results — email channel only.

**Architecture:** Add the three missing layers on top of the working delivery engine: a synced **contacts** table (the contactable, consented audience), **segments** (saved filters over contacts), and **email_campaigns + campaign_recipients** (the campaign object + a per-recipient work queue). Sending reuses `communicationEngine`'s `email_logs` queue + 60s worker — a campaign just renders a chosen `email_templates` row per contact and enqueues a `email_logs` row tagged with `campaign_id`. Bulk mail routes through **Resend** (provider already implemented) instead of Gmail SMTP.

**Tech Stack:** Node/Express, Supabase (`supabaseAdmin` service-role client), Jest (hand-rolled Supabase mock per `tests/unit/communicationEngine.test.js`), React + Vite (admin SPA), existing `requireAdmin(perm)` RBAC.

**Out of scope (Phase 2/3):** WhatsApp campaigns, delivery/read webhooks (funnel beyond sent/failed), custom visual segment builder, A/B tests, drip automations, the reference doc.

---

## File Structure

**Server — create**
- `server/migrations/v2.6_campaigns.sql` — contacts, segments, email_campaigns, campaign_recipients; `email_logs.campaign_id`
- `server/services/contactsService.js` — sync sources → contacts; suppression helpers
- `server/services/segmentService.js` — definition → resolved contacts; system segment seeds
- `server/services/campaignService.js` — create / launch (snapshot recipients) / stats
- `server/services/campaignWorker.js` — process `sending` campaigns under a throttle
- `server/controllers/campaignAdminController.js` — contacts + segments + campaigns HTTP handlers
- `server/tests/unit/contactsService.test.js`
- `server/tests/unit/segmentService.test.js`
- `server/tests/unit/campaignService.test.js`
- `server/tests/unit/campaignWorker.test.js`

**Server — modify**
- `server/services/email/communicationEngine.js` — add `enqueueCampaignEmail()` + export
- `server/lib/adminPermissions.js` — add `campaigns.view` / `campaigns.manage`; grant to `marketing`
- `server/routes/adminRoutes.js` — mount campaign routes
- `server/server.js` — register the campaign worker interval

**Client — create**
- `client/src/pages/admin/AdminCampaigns.jsx` — list + builder (email only)

**Client — modify**
- `client/src/services/api.js` — campaign/contact/segment API functions
- `client/src/App.jsx` — route `/admin/campaigns`
- `client/src/components/common/AdminLayout.jsx` — nav entry

---

## Conventions (read before coding)

- Controllers use `supabaseAdmin` directly and return JSON; errors → `res.status(5xx).json({ message })`. Mirror `emailAdminController.js`.
- Services are pure-ish modules taking no Express objects; they call `supabaseAdmin`. Mirror `communicationEngine.js`.
- Tests mock `../../config/supabase` with a hand-rolled chainable builder. Copy the mock scaffold from `tests/unit/communicationEngine.test.js:20-58` and adapt per table.
- Run a single server test: `cd server && npx jest tests/unit/<file>.test.js -t "<name>"`. Full suite: `cd server && npm test`.
- Commit after each green test. Branch first (repo is not currently a git repo per environment — if so, `git init` is a prerequisite; otherwise create a `feat/email-campaigns` branch).

---

### Task 1: Database migration v2.6

**Files:**
- Create: `server/migrations/v2.6_campaigns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- v2.6 — Campaign platform (Phase 1: contacts, segments, email campaigns)
-- Run in Supabase SQL Editor (or via Supabase MCP apply_migration).
-- Additive only; safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- 1. Contacts — one row per contactable, consented person (derived/synced)
CREATE TABLE IF NOT EXISTS contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT,
  phone               TEXT,
  name                TEXT,
  user_id             UUID,                         -- profiles.id if registered
  contact_type        TEXT NOT NULL DEFAULT 'guest',-- 'vendor' | 'guest' | 'buyer'
  email_opt_in        BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_opt_in     BOOLEAN NOT NULL DEFAULT TRUE,
  email_suppressed    BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  attributes          JSONB NOT NULL DEFAULT '{}',  -- plan, total_bookings, last_booking_at, city...
  source              TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  last_synced_at      TIMESTAMPTZ
);
-- Dedup key: one row per email. The sync service lowercases email before upsert
-- (case-insensitive dedup), so a PLAIN unique index on (email) is required — a
-- partial/expression index cannot serve as the ON CONFLICT (email) arbiter that
-- supabase-js .upsert({ onConflict: 'email' }) needs. Null/empty emails are never
-- inserted in Phase 1 (email channel only).
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (contact_type);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;   -- service-role only (no public policy)

-- 2. Segments — saved filter over contacts
CREATE TABLE IF NOT EXISTS segments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  definition  JSONB NOT NULL DEFAULT '{}',  -- { contact_type?, filters:[{field,op,value}] }
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

-- 3. Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'email',
  segment_id      UUID REFERENCES segments(id),
  template_id     UUID REFERENCES email_templates(id),
  subject_override TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft',   -- draft|scheduled|sending|sent|paused|failed
  scheduled_at    TIMESTAMPTZ,
  throttle_per_min INTEGER NOT NULL DEFAULT 120,
  stats           JSONB NOT NULL DEFAULT '{}',     -- { total, queued, sent, failed, skipped }
  created_by      TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns (status);
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

-- 4. Per-recipient work queue (mirrors email_logs lifecycle)
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES contacts(id),
  channel      TEXT NOT NULL DEFAULT 'email',
  destination  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',     -- queued|sent|failed|skipped
  error        TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  email_log_id UUID,                               -- link to email_logs row
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_camp_recipients_campaign ON campaign_recipients (campaign_id, status);
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

-- 5. Tag email_logs rows that belong to a campaign
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS campaign_id UUID;
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON email_logs (campaign_id);

-- 6. Seed system segments (idempotent by name)
INSERT INTO segments (name, description, definition, is_system)
SELECT v.name, v.description, v.definition::jsonb, TRUE FROM (VALUES
  ('All vendors',        'Every host/vendor contact',                  '{"contact_type":"vendor"}'),
  ('Free-plan vendors',  'Vendors on the explorer (free) plan',        '{"contact_type":"vendor","filters":[{"field":"plan","op":"eq","value":"explorer"}]}'),
  ('All guests',         'Everyone who booked as a guest',             '{"contact_type":"guest"}'),
  ('All contacts',       'Every contactable person',                   '{}')
) AS v(name, description, definition)
WHERE NOT EXISTS (SELECT 1 FROM segments s WHERE s.name = v.name);
```

- [ ] **Step 2: Apply and verify**

Apply via Supabase SQL Editor (project `STAGING_PROJECT_REF`) or Supabase MCP `apply_migration`.
Run: `SELECT count(*) FROM segments WHERE is_system;`
Expected: `4`. Also confirm `contacts`, `email_campaigns`, `campaign_recipients` exist and `email_logs.campaign_id` is present.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v2.6_campaigns.sql
git commit -m "feat(campaigns): v2.6 migration — contacts, segments, email campaigns"
```

---

### Task 2: Permissions — campaigns.view / campaigns.manage

**Files:**
- Modify: `server/lib/adminPermissions.js:41` (catalog) and `:144` (marketing role)
- Test: `server/tests/unit/adminPermissions.test.js` (create if absent)

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/adminPermissions.test.js
const { PERMISSION_SET, roleGrants, ROLES } = require('../../lib/adminPermissions');

test('campaigns permissions exist in catalog', () => {
  expect(PERMISSION_SET.has('campaigns.view')).toBe(true);
  expect(PERMISSION_SET.has('campaigns.manage')).toBe(true);
});

test('marketing role can manage campaigns', () => {
  expect(roleGrants('marketing')).toEqual(expect.arrayContaining(['campaigns.view', 'campaigns.manage']));
});

test('module loads without unknown-permission throw', () => {
  expect(Object.keys(ROLES)).toContain('marketing');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/adminPermissions.test.js -t "campaigns permissions"`
Expected: FAIL — `campaigns.view` not in set.

- [ ] **Step 3: Add permissions to the catalog**

In `server/lib/adminPermissions.js`, in the `// Engagement` group (currently line 41), change:
```js
  // Engagement
  'notifications.view', 'email.manage', 'whatsapp.manage',
  'campaigns.view', 'campaigns.manage',
  'badges.manage', 'announcements.manage',
```

- [ ] **Step 4: Grant to the marketing role**

In the `marketing` role `permissions` array (currently includes `'email.manage', 'whatsapp.manage'`), add after them:
```js
      'notifications.view', 'email.manage', 'whatsapp.manage',
      'campaigns.view', 'campaigns.manage',
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/adminPermissions.test.js`
Expected: PASS (3 tests). `super` already covers these via wildcard.

> NOTE: roles are also seeded in DB (migration v2.4). The new permission takes effect for `marketing` staff on next login; `super` is unaffected (wildcard). No DB change required for Phase 1.

- [ ] **Step 6: Commit**

```bash
git add server/lib/adminPermissions.js server/tests/unit/adminPermissions.test.js
git commit -m "feat(campaigns): add campaigns.view/manage permissions"
```

---

### Task 3: Resend provider self-test endpoint ("fix email", verifiable)

Adds a no-template provider test so an admin can prove Resend (or any configured provider) actually sends before running a campaign.

**Files:**
- Modify: `server/controllers/emailAdminController.js` (add `testProvider`, export it)
- Modify: `server/routes/adminRoutes.js:108` block (add route)
- Test: `server/tests/unit/emailProviderTest.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/emailProviderTest.test.js
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () =>
    Promise.resolve({ data: { id: 1, provider: 'resend', from_name: 'BAS', from_email: 'no@bas.in', brand_color: '#FE5100', support_email: 's@bas.in', website_url: 'https://bas.in' }, error: null }) }) }) }) },
  supabase: {},
}));
let sent = null;
jest.mock('../../services/email/providers', () => ({
  getProvider: (n) => ({ name: n, sendEmail: async (m) => { sent = m; return { success: true, id: 'r1' }; } }),
}));

const ctrl = require('../../controllers/emailAdminController');

const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

test('testProvider sends via configured provider and reports success', async () => {
  const res = mkRes();
  await ctrl.testProvider({ body: { to: 'me@x.test' } }, res);
  expect(sent.to).toBe('me@x.test');
  expect(res.body.message).toMatch(/sent/i);
});

test('testProvider 400s without recipient', async () => {
  const res = mkRes();
  await ctrl.testProvider({ body: {} }, res);
  expect(res.code).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/emailProviderTest.test.js`
Expected: FAIL — `ctrl.testProvider is not a function`.

- [ ] **Step 3: Implement `testProvider`**

In `server/controllers/emailAdminController.js`, add before `module.exports` (it reuses the engine's settings + provider factory):
```js
const { getProvider } = require('../services/email/providers');

// ── POST /api/admin/email/test-provider ──────────────────────────
// Sends a minimal email through the CURRENTLY configured provider (no template).
// Use to verify Resend/SES credentials before running a campaign.
const testProvider = async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: 'A recipient email (to) is required' });
    const settings = await communicationEngine.loadSettings();
    const provider = getProvider(settings.provider);
    const r = await provider.sendEmail({
      to,
      subject: `Meeticulous — ${settings.provider} provider test`,
      html: `<p>This is a provider connectivity test sent via <b>${settings.provider}</b>.</p>`,
      fromName: settings.from_name, fromEmail: settings.from_email,
    });
    return res.status(r.success ? 200 : 502)
      .json({ message: r.success ? `Test email sent via ${provider.name}` : `Send failed: ${r.error}`, provider: provider.name });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
```
Then add `testProvider` to the `module.exports` object.

- [ ] **Step 4: Add the route**

In `server/routes/adminRoutes.js`, in the Email block (after line 117 `.../test`), add:
```js
router.post('/email/test-provider',           requireAdmin('email.manage'), email.testProvider);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/emailProviderTest.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Configure Resend env (manual, deployment)**

In `server/.env` set `RESEND_API_KEY=<key>` and `RESEND_FROM=campaigns@meeticulous.in` (a verified Resend domain sender). Then in the admin Communications → Settings UI set provider to **Resend** for bulk. Transactional OTP can stay on SMTP if you keep a separate path; for Phase 1 the whole engine uses one provider, so verify Resend handles transactional volume too (it does).

- [ ] **Step 7: Commit**

```bash
git add server/controllers/emailAdminController.js server/routes/adminRoutes.js server/tests/unit/emailProviderTest.test.js
git commit -m "feat(campaigns): provider self-test endpoint for Resend verification"
```

---

### Task 4: contactsService.sync()

Builds the audience from `profiles` (vendors+guests), `bookings` (guest contacts incl. unregistered), `product_purchases` (buyers). Upserts into `contacts`, deduped by email, **preserving existing suppression/opt-in flags**.

**Files:**
- Create: `server/services/contactsService.js`
- Test: `server/tests/unit/contactsService.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/contactsService.test.js
const sources = {
  profiles: [
    { id: 'u1', email: 'Vendor@x.test', name: 'Vee', role: 'host', plan: 'explorer' },
    { id: 'u2', email: 'guest@x.test',  name: 'Gee', role: 'guest', plan: null },
  ],
  bookings: [
    { guest_email: 'guest@x.test', guest_name: 'Gee', guest_phone: '9991112222', scheduled_at: '2026-05-01T10:00:00Z' },
    { guest_email: 'walkin@x.test', guest_name: 'Walk', guest_phone: '9000000000', scheduled_at: '2026-05-02T10:00:00Z' },
  ],
  product_purchases: [
    { buyer_email: 'buyer@x.test', buyer_name: 'Buy', buyer_phone: '8000000000' },
  ],
};
const upserted = [];
const existing = [
  { id: 'c-old', email: 'guest@x.test', email_suppressed: true, whatsapp_opt_in: false }, // must be preserved
];

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (t) => ({
      select: () => Promise.resolve({ data: sources[t] ?? (t === 'contacts' ? existing : []), error: null }),
      upsert: (rows) => { upserted.push(...[].concat(rows)); return { select: () => Promise.resolve({ data: [].concat(rows), error: null }) }; },
    }),
  },
  supabase: {},
}));

const contactsService = require('../../services/contactsService');

test('dedups by email and unions all three sources', async () => {
  const r = await contactsService.sync();
  const emails = upserted.map((c) => c.email.toLowerCase());
  // vendor@, guest@, walkin@, buyer@ = 4 unique
  expect(new Set(emails).size).toBe(4);
  expect(r.upserted).toBe(4);
});

test('classifies contact_type from source', async () => {
  await contactsService.sync();
  const byEmail = Object.fromEntries(upserted.map((c) => [c.email.toLowerCase(), c]));
  expect(byEmail['vendor@x.test'].contact_type).toBe('vendor');
  expect(byEmail['walkin@x.test'].contact_type).toBe('guest');
  expect(byEmail['buyer@x.test'].contact_type).toBe('buyer');
});

test('preserves existing suppression / opt-out flags', async () => {
  await contactsService.sync();
  const g = upserted.find((c) => c.email.toLowerCase() === 'guest@x.test');
  expect(g.email_suppressed).toBe(true);
  expect(g.whatsapp_opt_in).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/contactsService.test.js`
Expected: FAIL — cannot find module `contactsService`.

- [ ] **Step 3: Implement the service**

```js
// server/services/contactsService.js
/**
 * contactsService — builds the consented, contactable audience by syncing
 * profiles + bookings + product_purchases into the `contacts` table.
 * Derived data: never hand-edited except suppression toggles (preserved here).
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');

const norm = (e) => (e || '').trim().toLowerCase();

async function loadExistingByEmail() {
  const { data } = await supabaseAdmin.from('contacts').select('*');
  const map = new Map();
  for (const c of data || []) if (c.email) map.set(norm(c.email), c);
  return map;
}

/** Merge a source record into the working map, newest wins for display fields. */
function upsertInto(map, { email, name, phone, type, attrs = {}, userId = null, source }) {
  const key = norm(email);
  if (!key) return; // Phase 1: email channel only
  const prev = map.get(key) || {};
  map.set(key, {
    ...prev,
    email: key,
    name: name || prev.name || '',
    phone: phone || prev.phone || '',
    user_id: userId || prev.user_id || null,
    // vendor outranks buyer outranks guest when a person appears in several sources
    contact_type: rankType(prev.contact_type, type),
    attributes: { ...(prev.attributes || {}), ...attrs },
    source: prev.source ? `${prev.source},${source}` : source,
  });
}

const TYPE_RANK = { vendor: 3, buyer: 2, guest: 1 };
const rankType = (a, b) => (TYPE_RANK[b] || 0) > (TYPE_RANK[a] || 0) ? b : (a || b);

async function sync() {
  const [{ data: profiles }, { data: bookings }, { data: purchases }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, email, name, role, plan'),
    supabaseAdmin.from('bookings').select('guest_email, guest_name, guest_phone, scheduled_at'),
    supabaseAdmin.from('product_purchases').select('buyer_email, buyer_name, buyer_phone'),
  ]);

  const work = new Map();
  for (const p of profiles || []) {
    upsertInto(work, {
      email: p.email, name: p.name, type: p.role === 'host' ? 'vendor' : 'guest',
      userId: p.id, attrs: { plan: p.plan || null }, source: 'profile',
    });
  }
  for (const b of bookings || []) {
    upsertInto(work, {
      email: b.guest_email, name: b.guest_name, phone: b.guest_phone, type: 'guest',
      attrs: { last_booking_at: b.scheduled_at }, source: 'booking',
    });
  }
  for (const pu of purchases || []) {
    upsertInto(work, {
      email: pu.buyer_email, name: pu.buyer_name, phone: pu.buyer_phone, type: 'buyer', source: 'purchase',
    });
  }

  // Preserve consent/suppression from existing rows.
  const existing = await loadExistingByEmail();
  const now = new Date().toISOString();
  const rows = [];
  for (const [key, c] of work) {
    const prev = existing.get(key) || {};
    rows.push({
      ...(prev.id ? { id: prev.id } : {}),
      email: c.email, name: c.name, phone: c.phone, user_id: c.user_id,
      contact_type: c.contact_type, attributes: c.attributes, source: c.source,
      email_opt_in:        prev.email_opt_in        ?? true,
      whatsapp_opt_in:     prev.whatsapp_opt_in     ?? true,
      email_suppressed:    prev.email_suppressed    ?? false,
      whatsapp_suppressed: prev.whatsapp_suppressed ?? false,
      last_synced_at: now, updated_at: now,
    });
  }

  if (rows.length) {
    const { error } = await supabaseAdmin.from('contacts').upsert(rows, { onConflict: 'email' }).select();
    if (error) return { upserted: 0, error: error.message };
  }
  return { upserted: rows.length };
}

module.exports = { sync, norm };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/contactsService.test.js`
Expected: PASS (3 tests).

> NOTE on `??`: the test's existing row sets `email_suppressed:true`/`whatsapp_opt_in:false`; `?? true`/`?? false` preserve them. Where a flag is absent it defaults consented (matches the T&C-at-signup consent basis).

- [ ] **Step 5: Commit**

```bash
git add server/services/contactsService.js server/tests/unit/contactsService.test.js
git commit -m "feat(campaigns): contactsService.sync — build consented audience"
```

---

### Task 5: segmentService.resolve()

**Files:**
- Create: `server/services/segmentService.js`
- Test: `server/tests/unit/segmentService.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/segmentService.test.js
const contacts = [
  { id: 'c1', email: 'v1@x', contact_type: 'vendor', email_opt_in: true,  email_suppressed: false, attributes: { plan: 'explorer' } },
  { id: 'c2', email: 'v2@x', contact_type: 'vendor', email_opt_in: true,  email_suppressed: false, attributes: { plan: 'creator' } },
  { id: 'c3', email: 'g1@x', contact_type: 'guest',  email_opt_in: true,  email_suppressed: false, attributes: {} },
  { id: 'c4', email: 'g2@x', contact_type: 'guest',  email_opt_in: false, email_suppressed: false, attributes: {} },
  { id: 'c5', email: 'g3@x', contact_type: 'guest',  email_opt_in: true,  email_suppressed: true,  attributes: {} },
];
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({ select: () => Promise.resolve({ data: contacts, error: null }) }) },
  supabase: {},
}));
const segmentService = require('../../services/segmentService');

test('filters by contact_type', async () => {
  const r = await segmentService.resolve({ contact_type: 'vendor' }, 'email');
  expect(r.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
});

test('applies attribute filters (plan eq)', async () => {
  const r = await segmentService.resolve({ contact_type: 'vendor', filters: [{ field: 'plan', op: 'eq', value: 'explorer' }] }, 'email');
  expect(r.map((c) => c.id)).toEqual(['c1']);
});

test('excludes not-opted-in and suppressed for the email channel', async () => {
  const r = await segmentService.resolve({ contact_type: 'guest' }, 'email');
  // c3 only — c4 opted out, c5 suppressed
  expect(r.map((c) => c.id)).toEqual(['c3']);
});

test('empty definition = all contactable', async () => {
  const r = await segmentService.resolve({}, 'email');
  expect(r.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/segmentService.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the service**

```js
// server/services/segmentService.js
/**
 * segmentService — resolve a segment definition to a contactable recipient list.
 * Consent + suppression for the target channel are ALWAYS enforced here, so no
 * caller can message an opted-out contact.
 *
 * definition = { contact_type?: string, filters?: [{ field, op, value }] }
 *   field is a top-level contact column OR an attributes.<key>.
 *   op ∈ 'eq' | 'neq' | 'exists' | 'gt' | 'lt'
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');

const getField = (c, field) =>
  (field in c ? c[field] : (c.attributes || {})[field]);

const passes = (c, f) => {
  const v = getField(c, f.field);
  switch (f.op) {
    case 'eq':     return v === f.value;
    case 'neq':    return v !== f.value;
    case 'exists': return v !== null && v !== undefined && v !== '';
    case 'gt':     return v != null && v > f.value;
    case 'lt':     return v != null && v < f.value;
    default:       return true;
  }
};

const contactable = (c, channel) =>
  channel === 'email'
    ? !!c.email && !!c.email_opt_in && !c.email_suppressed
    : !!c.phone && !!c.whatsapp_opt_in && !c.whatsapp_suppressed;

async function resolve(definition = {}, channel = 'email') {
  const { data, error } = await supabaseAdmin.from('contacts').select('*');
  if (error) return [];
  let rows = (data || []).filter((c) => contactable(c, channel));
  if (definition.contact_type) rows = rows.filter((c) => c.contact_type === definition.contact_type);
  for (const f of definition.filters || []) rows = rows.filter((c) => passes(c, f));
  return rows;
}

/** Count only (used by the builder preview). */
async function count(definition, channel = 'email') {
  return (await resolve(definition, channel)).length;
}

module.exports = { resolve, count };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/segmentService.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/segmentService.js server/tests/unit/segmentService.test.js
git commit -m "feat(campaigns): segmentService.resolve with consent enforcement"
```

---

### Task 6: communicationEngine.enqueueCampaignEmail()

Lets a campaign render a chosen template for one contact and drop a `queued` row into `email_logs` (tagged `campaign_id`) so the existing 60s worker delivers it with retry/backoff. No new delivery code.

**Files:**
- Modify: `server/services/email/communicationEngine.js` (add function + export)
- Test: `server/tests/unit/communicationEngineCampaign.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/communicationEngineCampaign.test.js
const db = {
  email_settings: { id: 1, provider: 'resend', from_name: 'BAS', support_email: 's@x', website_url: 'https://x', brand_color: '#FE5100' },
  email_templates: [{ id: 'tA', event_key: 'CAMPAIGN_PROMO', audience: 'all', status: 'active', subject: 'Hi {{first_name}}', html_content: '<p>{{first_name}}</p>', preview_text: '', cta_label: '', cta_url: '' }],
  email_logs: [],
};
jest.mock('../../config/supabase', () => {
  const make = (table) => ({
    select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
    maybeSingle() { return Promise.resolve({ data: table === 'email_settings' ? db.email_settings : null, error: null }); },
    single() { return Promise.resolve({ data: db.email_templates[0], error: null }); },
    insert(row) { const r = { id: `log${db.email_logs.length + 1}`, ...row }; db.email_logs.push(r); return { select: () => ({ single: () => Promise.resolve({ data: { id: r.id }, error: null }) }) }; },
    then(res) { if (table === 'email_templates') return res({ data: db.email_templates, error: null }); return res({ data: [], error: null }); },
  });
  return { supabaseAdmin: { from: (t) => make(t) }, supabase: {} };
});
jest.mock('../../services/email/providers', () => ({ getProvider: () => ({ name: 'resend', sendEmail: async () => ({ success: true }) }) }));

const engine = require('../../services/email/communicationEngine');
beforeEach(() => { db.email_logs = []; engine.clearCache(); });

test('enqueues a campaign email as a queued log tagged with campaign_id', async () => {
  const r = await engine.enqueueCampaignEmail({
    templateId: 'tA', to: 'a@x.test', data: { first_name: 'Asha' },
    user: { name: 'Asha', email: 'a@x.test' }, campaignId: 'camp1',
  });
  expect(r.ok).toBe(true);
  expect(r.status).toBe('queued');
  expect(db.email_logs).toHaveLength(1);
  expect(db.email_logs[0].campaign_id).toBe('camp1');
  expect(db.email_logs[0].status).toBe('queued');
  expect(db.email_logs[0].subject).toBe('Hi Asha');
  expect(db.email_logs[0].html).toContain('Asha');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/communicationEngineCampaign.test.js`
Expected: FAIL — `engine.enqueueCampaignEmail is not a function`.

- [ ] **Step 3: Implement and export**

In `server/services/email/communicationEngine.js`, add a function that fetches a template by id, renders it, and inserts a queued log. Add after `send` (and reuse `loadSettings`, `renderEmail`, `insertLog`):
```js
/**
 * Enqueue one campaign email (render chosen template for one contact → queued log).
 * The standard processQueue() worker delivers it. Subject override optional.
 */
async function enqueueCampaignEmail({ templateId, to, data = {}, user = {}, campaignId, subjectOverride, recipientUserId = null }) {
  if (!templateId || !to) return { ok: false, reason: 'templateId and to required' };
  const settings = await loadSettings();
  const { data: template } = await supabaseAdmin.from('email_templates').select('*').eq('id', templateId).single();
  if (!template) return { ok: false, reason: 'no_template' };

  const rendered = renderEmail(template, { data, user, settings });
  const subject = subjectOverride || rendered.subject;
  const logId = await insertLog({
    event_key: `CAMPAIGN:${campaignId || ''}`, template_id: template.id, audience: template.audience,
    recipient: to, recipient_user_id: recipientUserId, campaign_id: campaignId || null,
    subject, html: rendered.html, status: 'queued', attempts: 0,
    next_attempt_at: new Date().toISOString(), is_test: false,
  });
  return { ok: true, status: 'queued', logId };
}
```
Add `enqueueCampaignEmail` to the `module.exports` list.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/communicationEngineCampaign.test.js`
Expected: PASS.

- [ ] **Step 5: Run the existing engine suite (no regressions)**

Run: `cd server && npx jest tests/unit/communicationEngine.test.js`
Expected: PASS (unchanged).

- [ ] **Step 6: Commit**

```bash
git add server/services/email/communicationEngine.js server/tests/unit/communicationEngineCampaign.test.js
git commit -m "feat(campaigns): enqueueCampaignEmail reuses email queue + worker"
```

---

### Task 7: campaignService — create / launch / stats

`launch()` resolves the segment, snapshots **consented** recipients into `campaign_recipients` (status `queued`), and flips the campaign to `sending`. The worker (Task 8) does the actual enqueueing under a throttle.

**Files:**
- Create: `server/services/campaignService.js`
- Test: `server/tests/unit/campaignService.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/campaignService.test.js
const state = { campaign: { id: 'camp1', status: 'draft', channel: 'email', segment_id: 'seg1', template_id: 'tA' },
  segment: { id: 'seg1', definition: { contact_type: 'vendor' } }, recipients: [], updated: {} };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: (t) => ({
    select() { return this; }, eq() { return this; },
    single() {
      if (t === 'email_campaigns') return Promise.resolve({ data: state.campaign, error: null });
      if (t === 'segments')        return Promise.resolve({ data: state.segment, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    insert(rows) { state.recipients.push(...[].concat(rows)); return { select: () => Promise.resolve({ data: [].concat(rows), error: null }) }; },
    update(ch) { Object.assign(state.updated, ch); return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { ...state.campaign, ...ch }, error: null }) }) }) }; },
  }) },
  supabase: {},
}));
jest.mock('../../services/segmentService', () => ({
  resolve: async () => ([
    { id: 'c1', email: 'a@x', name: 'A', user_id: 'u1', attributes: {} },
    { id: 'c2', email: 'b@x', name: 'B', user_id: null, attributes: {} },
  ]),
}));
const campaignService = require('../../services/campaignService');

test('launch snapshots resolved recipients and sets status sending', async () => {
  const r = await campaignService.launch('camp1');
  expect(state.recipients).toHaveLength(2);
  expect(state.recipients[0]).toMatchObject({ campaign_id: 'camp1', channel: 'email', status: 'queued' });
  expect(state.updated.status).toBe('sending');
  expect(r.recipients).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/campaignService.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the service**

```js
// server/services/campaignService.js
/**
 * campaignService — create, launch (snapshot recipients), and report stats for
 * email campaigns. Sending itself is done by campaignWorker via the email queue.
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');
const segmentService = require('./segmentService');

async function create(input) {
  const row = {
    name: input.name, channel: 'email', segment_id: input.segment_id || null,
    template_id: input.template_id || null, subject_override: input.subject_override || '',
    status: 'draft', scheduled_at: input.scheduled_at || null,
    throttle_per_min: input.throttle_per_min || 120, created_by: input.created_by || '',
  };
  const { data, error } = await supabaseAdmin.from('email_campaigns').insert(row).select().single();
  if (error) return { error: error.message };
  return { campaign: data };
}

/** Resolve segment → snapshot consented recipients → status 'sending'. */
async function launch(campaignId) {
  const { data: campaign } = await supabaseAdmin.from('email_campaigns').select('*').eq('id', campaignId).single();
  if (!campaign) return { error: 'campaign_not_found' };
  if (!campaign.template_id) return { error: 'no_template' };
  if (!['draft', 'scheduled'].includes(campaign.status)) return { error: `cannot_launch_from_${campaign.status}` };

  const { data: segment } = await supabaseAdmin.from('segments').select('*').eq('id', campaign.segment_id).single();
  const recipients = await segmentService.resolve(segment ? segment.definition : {}, 'email');

  if (recipients.length) {
    const rows = recipients.map((c) => ({
      campaign_id: campaignId, contact_id: c.id, channel: 'email',
      destination: c.email, status: 'queued', attempts: 0,
    }));
    const { error } = await supabaseAdmin.from('campaign_recipients').insert(rows).select();
    if (error) return { error: error.message };
  }

  const stats = { total: recipients.length, queued: recipients.length, sent: 0, failed: 0, skipped: 0 };
  await supabaseAdmin.from('email_campaigns')
    .update({ status: 'sending', stats, updated_at: new Date().toISOString() })
    .eq('id', campaignId).select().single();

  return { recipients: recipients.length };
}

async function stats(campaignId) {
  const { data } = await supabaseAdmin.from('campaign_recipients').select('status').eq('campaign_id', campaignId);
  const acc = { total: 0, queued: 0, sent: 0, failed: 0, skipped: 0 };
  for (const r of data || []) { acc.total++; acc[r.status] = (acc[r.status] || 0) + 1; }
  return acc;
}

module.exports = { create, launch, stats };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/campaignService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/campaignService.js server/tests/unit/campaignService.test.js
git commit -m "feat(campaigns): campaignService create/launch/stats"
```

---

### Task 8: campaignWorker — throttled send + interval registration

Pulls up to `throttle_per_min` `queued` recipients per `sending` campaign each tick, calls `enqueueCampaignEmail` for each (which queues to `email_logs`), marks the recipient `sent` (enqueued) or `failed`/`skipped`, and flips the campaign to `sent` when drained.

**Files:**
- Create: `server/services/campaignWorker.js`
- Modify: `server/server.js` (register interval, after the email queue worker ~line 102)
- Test: `server/tests/unit/campaignWorker.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/campaignWorker.test.js
const state = {
  campaigns: [{ id: 'camp1', status: 'sending', template_id: 'tA', subject_override: '', throttle_per_min: 100 }],
  recipients: [
    { id: 'r1', campaign_id: 'camp1', contact_id: 'c1', destination: 'a@x', status: 'queued' },
    { id: 'r2', campaign_id: 'camp1', contact_id: 'c2', destination: 'b@x', status: 'queued' },
  ],
  contacts: { c1: { id: 'c1', email: 'a@x', name: 'A', user_id: 'u1', attributes: {} },
              c2: { id: 'c2', email: 'b@x', name: 'B', user_id: null, attributes: {} } },
};
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: (t) => {
    const q = { _f: {} };
    q.select = () => q; q.eq = (c, v) => { q._f[c] = v; return q; }; q.limit = () => q;
    q.then = (res) => {
      if (t === 'email_campaigns') return res({ data: state.campaigns.filter((c) => c.status === 'sending'), error: null });
      if (t === 'campaign_recipients') return res({ data: state.recipients.filter((r) => r.campaign_id === q._f.campaign_id && r.status === (q._f.status || r.status)), error: null });
      if (t === 'contacts') return res({ data: Object.values(state.contacts).filter((c) => c.id === q._f.id), error: null });
      return res({ data: [], error: null });
    };
    q.single = () => { if (t === 'contacts') return Promise.resolve({ data: state.contacts[q._f.id], error: null }); return Promise.resolve({ data: null, error: null }); };
    q.update = (ch) => ({ eq: (c, v) => {
      if (t === 'campaign_recipients') { const r = state.recipients.find((x) => x.id === v); if (r) Object.assign(r, ch); }
      if (t === 'email_campaigns') { const c = state.campaigns.find((x) => x.id === v); if (c) Object.assign(c, ch); }
      return Promise.resolve({ error: null });
    } });
    return q;
  } },
  supabase: {},
}));
let enqueued = [];
jest.mock('../../services/email/communicationEngine', () => ({
  enqueueCampaignEmail: async (a) => { enqueued.push(a); return { ok: true, status: 'queued', logId: `log${enqueued.length}` }; },
}));
const worker = require('../../services/campaignWorker');
beforeEach(() => { enqueued = []; state.recipients.forEach((r) => { r.status = 'queued'; }); state.campaigns[0].status = 'sending'; });

test('enqueues each queued recipient and marks them sent', async () => {
  const r = await worker.processDue();
  expect(enqueued).toHaveLength(2);
  expect(enqueued[0].templateId).toBe('tA');
  expect(state.recipients.every((x) => x.status === 'sent')).toBe(true);
  expect(r.enqueued).toBe(2);
});

test('marks campaign sent once drained', async () => {
  await worker.processDue();
  expect(state.campaigns[0].status).toBe('sent');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/campaignWorker.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the worker**

```js
// server/services/campaignWorker.js
/**
 * campaignWorker — drives 'sending' campaigns. Each tick, for every sending
 * campaign, enqueue up to throttle_per_min recipients into the email queue.
 * Idempotent per recipient (only 'queued' rows are picked). Flips campaign to
 * 'sent' when no queued recipients remain.
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');
const communicationEngine = require('./email/communicationEngine');

async function processDue() {
  const { data: campaigns } = await supabaseAdmin.from('email_campaigns').select('*').eq('status', 'sending');
  let enqueued = 0, failed = 0;

  for (const campaign of campaigns || []) {
    const cap = campaign.throttle_per_min || 120;
    const { data: recipients } = await supabaseAdmin
      .from('campaign_recipients').select('*').eq('campaign_id', campaign.id).eq('status', 'queued').limit(cap);

    for (const rcpt of recipients || []) {
      const { data: contact } = await supabaseAdmin.from('contacts').select('*').eq('id', rcpt.contact_id).single();
      if (!contact || !contact.email || !contact.email_opt_in || contact.email_suppressed) {
        await mark(rcpt.id, 'skipped', 'not_contactable');
        continue;
      }
      const data = { first_name: (contact.name || '').split(' ')[0], name: contact.name, email: contact.email, ...(contact.attributes || {}) };
      const r = await communicationEngine.enqueueCampaignEmail({
        templateId: campaign.template_id, to: contact.email, data,
        user: { name: contact.name, email: contact.email },
        campaignId: campaign.id, subjectOverride: campaign.subject_override || null,
        recipientUserId: contact.user_id || null,
      });
      if (r.ok) { await mark(rcpt.id, 'sent', null, r.logId); enqueued++; }
      else      { await mark(rcpt.id, 'failed', r.reason || 'enqueue_failed'); failed++; }
    }

    // Drained? Mark the campaign complete.
    const { data: remaining } = await supabaseAdmin
      .from('campaign_recipients').select('id').eq('campaign_id', campaign.id).eq('status', 'queued').limit(1);
    if (!remaining || remaining.length === 0) {
      await supabaseAdmin.from('email_campaigns').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', campaign.id);
    }
  }
  return { enqueued, failed };
}

async function mark(id, status, error = null, email_log_id = null) {
  const patch = { status, error, updated_at: new Date().toISOString() };
  if (status === 'sent') { patch.sent_at = new Date().toISOString(); if (email_log_id) patch.email_log_id = email_log_id; }
  await supabaseAdmin.from('campaign_recipients').update(patch).eq('id', id);
}

module.exports = { processDue };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/campaignWorker.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Register the interval in server.js**

In `server/server.js`, after the email queue worker block (ends ~line 102), add:
```js
// Campaign worker — drives 'sending' email campaigns under their throttle (every 60s)
const campaignWorker = require('./services/campaignWorker');
setInterval(async () => {
  try {
    const r = await campaignWorker.processDue();
    if (r.enqueued || r.failed) console.log(`Campaign worker: ${r.enqueued} enqueued, ${r.failed} failed`);
  } catch (err) { console.error('Campaign worker error:', err.message); }
}, 60 * 1000);
```

> The throttle is per 60s tick. `throttle_per_min: 120` ⇒ ≤120 enqueues/min. Since email delivery is then paced by the existing email queue worker (`limit 25`/tick), real send rate is naturally smoothed — fine for Resend.

- [ ] **Step 6: Commit**

```bash
git add server/services/campaignWorker.js server/server.js server/tests/unit/campaignWorker.test.js
git commit -m "feat(campaigns): throttled campaign worker + interval registration"
```

---

### Task 9: campaignAdminController + routes

HTTP surface for contacts, segments, campaigns. Mirrors `emailAdminController` style.

**Files:**
- Create: `server/controllers/campaignAdminController.js`
- Modify: `server/routes/adminRoutes.js` (mount block after the Email block)
- Test: `server/tests/unit/campaignAdminController.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/campaignAdminController.test.js
jest.mock('../../services/contactsService', () => ({ sync: async () => ({ upserted: 7 }) }));
jest.mock('../../services/segmentService', () => ({ count: async () => 4 }));
jest.mock('../../services/campaignService', () => ({
  create: async (b) => ({ campaign: { id: 'camp1', ...b } }),
  launch: async () => ({ recipients: 3 }),
}));
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({ select() { return this; }, order() { return this; }, eq() { return this; },
    then: (res) => res({ data: [{ id: 'seg1', name: 'All vendors' }], error: null }) }) }, supabase: {},
}));
const ctrl = require('../../controllers/campaignAdminController');
const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

test('syncContacts returns upserted count', async () => {
  const res = mkRes(); await ctrl.syncContacts({}, res);
  expect(res.body.upserted).toBe(7);
});
test('createCampaign returns created campaign', async () => {
  const res = mkRes(); await ctrl.createCampaign({ body: { name: 'Promo' } }, res);
  expect(res.body.campaign.id).toBe('camp1');
});
test('launchCampaign returns recipient count', async () => {
  const res = mkRes(); await ctrl.launchCampaign({ params: { id: 'camp1' } }, res);
  expect(res.body.recipients).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/campaignAdminController.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the controller**

```js
// server/controllers/campaignAdminController.js
/**
 * campaignAdminController — Super Admin → Campaigns (Phase 1: email).
 * Contacts (list/sync/suppress), segments (list/preview), campaigns (CRUD + launch).
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');
const contactsService = require('../services/contactsService');
const segmentService = require('../services/segmentService');
const campaignService = require('../services/campaignService');

// ── Contacts ──
const listContacts = async (req, res) => {
  try {
    const { type, search, limit = 100 } = req.query;
    let q = supabaseAdmin.from('contacts').select('*').order('updated_at', { ascending: false }).limit(Math.min(parseInt(limit) || 100, 500));
    if (type) q = q.eq('contact_type', type);
    if (search) q = q.ilike('email', `%${search}%`);
    const { data, error } = await q;
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
const syncContacts = async (_req, res) => {
  try { const r = await contactsService.sync(); res.json(r); }
  catch (e) { res.status(500).json({ message: e.message }); }
};
const suppressContact = async (req, res) => {
  try {
    const allowed = ['email_opt_in', 'whatsapp_opt_in', 'email_suppressed', 'whatsapp_suppressed'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in req.body) updates[k] = !!req.body[k];
    const { data, error } = await supabaseAdmin.from('contacts').update(updates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ message: error?.message || 'Contact not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── Segments ──
const listSegments = async (_req, res) => {
  try { const { data, error } = await supabaseAdmin.from('segments').select('*').order('name');
    if (error) return res.status(500).json({ message: error.message }); res.json(data || []);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
const previewSegment = async (req, res) => {
  try { const n = await segmentService.count(req.body?.definition || {}, 'email'); res.json({ count: n }); }
  catch (e) { res.status(500).json({ message: e.message }); }
};

// ── Campaigns ──
const listCampaigns = async (_req, res) => {
  try { const { data, error } = await supabaseAdmin.from('email_campaigns').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ message: error.message }); res.json(data || []);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
const createCampaign = async (req, res) => {
  try {
    if (!req.body?.name) return res.status(400).json({ message: 'name is required' });
    const r = await campaignService.create({ ...req.body, created_by: req.admin?.email || '' });
    if (r.error) return res.status(500).json({ message: r.error });
    res.status(201).json(r);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
const getCampaign = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('email_campaigns').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ message: 'Campaign not found' });
    const stats = await campaignService.stats(req.params.id);
    res.json({ ...data, live_stats: stats });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
const updateCampaign = async (req, res) => {
  try {
    const allowed = ['name', 'segment_id', 'template_id', 'subject_override', 'scheduled_at', 'throttle_per_min', 'status'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    const { data, error } = await supabaseAdmin.from('email_campaigns').update(updates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ message: error?.message || 'Campaign not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
const launchCampaign = async (req, res) => {
  try {
    const r = await campaignService.launch(req.params.id);
    if (r.error) return res.status(400).json({ message: r.error });
    res.json({ message: `Launched — ${r.recipients} recipients queued`, recipients: r.recipients });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = {
  listContacts, syncContacts, suppressContact,
  listSegments, previewSegment,
  listCampaigns, createCampaign, getCampaign, updateCampaign, launchCampaign,
};
```

- [ ] **Step 4: Mount the routes**

In `server/routes/adminRoutes.js`, after the Email block (after line 123), add:
```js
// ── Campaigns (Phase 1: email) ─────────────────────────────────
const campaigns = require('../controllers/campaignAdminController');
router.get('/campaigns/contacts',          requireAdmin('campaigns.view'),   campaigns.listContacts);
router.post('/campaigns/contacts/sync',    requireAdmin('campaigns.manage'), campaigns.syncContacts);
router.patch('/campaigns/contacts/:id',    requireAdmin('campaigns.manage'), campaigns.suppressContact);
router.get('/campaigns/segments',          requireAdmin('campaigns.view'),   campaigns.listSegments);
router.post('/campaigns/segments/preview', requireAdmin('campaigns.view'),   campaigns.previewSegment);
router.get('/campaigns',                   requireAdmin('campaigns.view'),   campaigns.listCampaigns);
router.post('/campaigns',                  requireAdmin('campaigns.manage'), campaigns.createCampaign);
router.get('/campaigns/:id',               requireAdmin('campaigns.view'),   campaigns.getCampaign);
router.put('/campaigns/:id',               requireAdmin('campaigns.manage'), campaigns.updateCampaign);
router.post('/campaigns/:id/launch',       requireAdmin('campaigns.manage'), campaigns.launchCampaign);
```

> ROUTE ORDER: register `/campaigns/contacts`, `/campaigns/segments` BEFORE `/campaigns/:id` so Express doesn't match `contacts` as an `:id`. The order above is correct — keep it.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/campaignAdminController.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/campaignAdminController.js server/routes/adminRoutes.js server/tests/unit/campaignAdminController.test.js
git commit -m "feat(campaigns): admin controller + routes"
```

---

### Task 10: Client API functions

**Files:**
- Modify: `client/src/services/api.js` (after the email block ~line 269)

- [ ] **Step 1: Add the functions**

In `client/src/services/api.js`, append after the `adminEmailEvents` line:
```js
// ── Campaigns (Phase 1: email) ──
export const adminCampContacts     = (params)   => API.get('/admin/campaigns/contacts', { params });
export const adminCampSyncContacts = ()         => API.post('/admin/campaigns/contacts/sync');
export const adminCampSuppress     = (id, data) => API.patch(`/admin/campaigns/contacts/${id}`, data);
export const adminCampSegments     = ()         => API.get('/admin/campaigns/segments');
export const adminCampSegPreview   = (definition) => API.post('/admin/campaigns/segments/preview', { definition });
export const adminCampaigns        = ()         => API.get('/admin/campaigns');
export const adminCampCreate       = (data)     => API.post('/admin/campaigns', data);
export const adminCampGet          = (id)       => API.get(`/admin/campaigns/${id}`);
export const adminCampUpdate       = (id, data) => API.put(`/admin/campaigns/${id}`, data);
export const adminCampLaunch       = (id)       => API.post(`/admin/campaigns/${id}/launch`);
```

- [ ] **Step 2: Verify build**

Run: `cd client && npm run build`
Expected: build succeeds (no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(campaigns): client API functions"
```

---

### Task 11: Client Campaigns page + nav + route

A list + a simple builder: name → segment (with live count preview) → template → schedule/throttle → Save draft → Launch. Reuses the styling idioms from `AdminCommunication.jsx` (tabs, `fb-input`, pill).

**Files:**
- Create: `client/src/pages/admin/AdminCampaigns.jsx`
- Modify: `client/src/App.jsx` (lazy import + route, near line 243)
- Modify: `client/src/components/common/AdminLayout.jsx` (nav entry + label map)
- Test: `client/src/pages/admin/__tests__/AdminCampaigns.test.jsx` (Vitest smoke)

- [ ] **Step 1: Create the page**

```jsx
// client/src/pages/admin/AdminCampaigns.jsx
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  adminCampaigns, adminCampCreate, adminCampLaunch, adminCampUpdate,
  adminCampSegments, adminCampSegPreview, adminCampSyncContacts,
  adminEmailTemplates,
} from '../../services/api';

const STATUS = { draft: 'bg-gray-100 text-gray-600', scheduled: 'bg-blue-50 text-blue-600',
  sending: 'bg-amber-50 text-amber-600', sent: 'bg-emerald-50 text-emerald-600',
  paused: 'bg-violet-50 text-violet-600', failed: 'bg-red-50 text-red-600' };
const Pill = ({ s }) => <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS[s] || 'bg-gray-100 text-gray-500'}`}>{s}</span>;

const AdminCampaigns = () => {
  const [list, setList] = useState([]);
  const [segments, setSegments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [building, setBuilding] = useState(false);
  const [form, setForm] = useState({ name: '', segment_id: '', template_id: '', subject_override: '', throttle_per_min: 120 });
  const [count, setCount] = useState(null);

  const load = useCallback(() => { adminCampaigns().then((r) => setList(r.data)).catch(() => toast.error('Failed to load campaigns')); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminCampSegments().then((r) => setSegments(r.data)).catch(() => {});
    adminEmailTemplates({ status: 'active' }).then((r) => setTemplates(r.data)).catch(() => {});
  }, []);

  const previewCount = async (segId) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return setCount(null);
    try { const r = await adminCampSegPreview(seg.definition); setCount(r.data.count); } catch { setCount(null); }
  };

  const save = async () => {
    if (!form.name || !form.segment_id || !form.template_id) return toast.error('Name, segment and template are required');
    try { await adminCampCreate(form); toast.success('Draft saved'); setBuilding(false);
      setForm({ name: '', segment_id: '', template_id: '', subject_override: '', throttle_per_min: 120 }); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  const launch = async (c) => {
    if (!window.confirm(`Launch "${c.name}"? This sends to all consented recipients in the segment.`)) return;
    try { const r = await adminCampLaunch(c.id); toast.success(r.data.message); load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Launch failed'); }
  };

  const syncContacts = async () => {
    try { const r = await adminCampSyncContacts(); toast.success(`Synced ${r.data.upserted} contacts`); }
    catch { toast.error('Sync failed'); }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Targeted email campaigns to consented segments. WhatsApp coming soon.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncContacts} className="border px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Sync contacts</button>
          <button onClick={() => setBuilding(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">New campaign</button>
        </div>
      </div>

      {building && (
        <div className="bg-white border rounded-xl p-5 mb-6 max-w-2xl space-y-3">
          <div><label className="block text-xs font-semibold text-gray-500 mb-1">Campaign name</label>
            <input className="fb-input text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="block text-xs font-semibold text-gray-500 mb-1">Audience (segment)</label>
            <select className="fb-input text-sm" value={form.segment_id}
              onChange={(e) => { setForm({ ...form, segment_id: e.target.value }); previewCount(e.target.value); }}>
              <option value="">Select a segment…</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {count !== null && <p className="text-[11px] text-gray-500 mt-1">≈ {count} consented recipients</p>}
          </div>
          <div><label className="block text-xs font-semibold text-gray-500 mb-1">Email template</label>
            <select className="fb-input text-sm" value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
              <option value="">Select a template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
          <div><label className="block text-xs font-semibold text-gray-500 mb-1">Subject override (optional)</label>
            <input className="fb-input text-sm" value={form.subject_override} onChange={(e) => setForm({ ...form, subject_override: e.target.value })} /></div>
          <div className="flex gap-2 pt-2 border-t">
            <button onClick={save} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">Save draft</button>
            <button onClick={() => setBuilding(false)} className="border px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b">
            <th className="px-4 py-2.5">Campaign</th><th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Sent/Total</th><th className="px-4 py-2.5">Created</th><th className="px-4 py-2.5">Actions</th>
          </tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-2.5"><Pill s={c.status} /></td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{(c.stats?.sent ?? 0)}/{(c.stats?.total ?? 0)}</td>
                <td className="px-4 py-2.5 text-xs text-gray-400">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</td>
                <td className="px-4 py-2.5 text-xs">
                  {['draft', 'scheduled'].includes(c.status)
                    ? <button onClick={() => launch(c)} className="text-indigo-600 font-semibold hover:underline">Launch</button>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="5" className="text-center text-sm text-gray-400 py-8">No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCampaigns;
```

- [ ] **Step 2: Add lazy import + route in App.jsx**

In `client/src/App.jsx`, near line 102 (with the other admin lazy imports):
```js
const AdminCampaigns = lazy(() => import('./pages/admin/AdminCampaigns'));
```
And near line 243 (with the other admin routes):
```jsx
<Route path="/admin/campaigns" element={<AdminWrapper><AdminCampaigns /></AdminWrapper>} />
```

- [ ] **Step 3: Add nav entry in AdminLayout.jsx**

In `client/src/components/common/AdminLayout.jsx`, in the label map (line ~95) add `campaigns:'Campaigns',`. In the nav array (near line 165, next to Communication) add:
```jsx
    { label:'Campaigns', icon:'send', to:'/admin/campaigns', perm:'campaigns.view' },
```
(If `send` is not a registered icon key, reuse `'mail'`.)

- [ ] **Step 4: Write a smoke test**

```jsx
// client/src/pages/admin/__tests__/AdminCampaigns.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi, test, expect } from 'vitest';

vi.mock('../../../services/api', () => ({
  adminCampaigns: () => Promise.resolve({ data: [{ id: 'c1', name: 'Promo', status: 'draft', stats: { sent: 0, total: 0 }, created_at: '2026-06-12' }] }),
  adminCampSegments: () => Promise.resolve({ data: [] }),
  adminEmailTemplates: () => Promise.resolve({ data: [] }),
  adminCampCreate: vi.fn(), adminCampLaunch: vi.fn(), adminCampUpdate: vi.fn(),
  adminCampSegPreview: vi.fn(), adminCampSyncContacts: vi.fn(),
}));

import AdminCampaigns from '../AdminCampaigns';

test('renders campaign list', async () => {
  render(<AdminCampaigns />);
  await waitFor(() => expect(screen.getByText('Promo')).toBeInTheDocument());
  expect(screen.getByText('Campaigns')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run client tests + build**

Run: `cd client && npm test -- AdminCampaigns` then `cd client && npm run build`
Expected: smoke test PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/AdminCampaigns.jsx client/src/App.jsx client/src/components/common/AdminLayout.jsx client/src/pages/admin/__tests__/AdminCampaigns.test.jsx
git commit -m "feat(campaigns): admin Campaigns page, route and nav"
```

---

### Task 12: Full-suite regression + end-to-end manual verification

- [ ] **Step 1: Run the whole server suite**

Run: `cd server && npm test`
Expected: all prior tests (205+) still pass, plus the new campaign tests.

- [ ] **Step 2: Run the whole client suite**

Run: `cd client && npm test`
Expected: all pass.

- [ ] **Step 3: Manual end-to-end (staging / local with Resend configured)**

1. Communications → Settings → provider = **Resend**; hit **Test provider** (Task 3 endpoint) to a real inbox → confirm receipt.
2. Campaigns → **Sync contacts** → confirm count > 0; spot-check the `contacts` table.
3. Create a campaign: name, segment **All guests** (or a tiny test segment), an active template → Save draft.
4. **Launch** → confirm recipients snapshotted (`campaign_recipients` rows = consented count) and campaign status → `sending`.
5. Within ~2 minutes the campaign + email workers drain it → status `sent`; verify a real email arrives and `email_logs` rows carry `campaign_id`.
6. Suppress a contact (PATCH) → re-launch a campaign → confirm that contact is `skipped`.

- [ ] **Step 4: Final commit / open PR**

```bash
git add -A
git commit -m "test(campaigns): phase-1 regression green; e2e verified"
```

---

## Self-Review

**Spec coverage:**
- Audience layer → Task 1 (contacts table), Task 4 (sync). ✓
- Consent/suppression enforced → Task 5 (`contactable`), Task 8 (re-checked at send), Task 9 (`suppressContact`). ✓
- Segments → Task 1 (table + seeds), Task 5 (resolve), Task 9 (list/preview). ✓
- Campaign object + worker reusing email queue → Tasks 1, 6, 7, 8. ✓
- Resend as bulk sender + verifiable → Task 3. ✓
- Admin API + UI + nav + perms → Tasks 2, 9, 10, 11. ✓
- Tested at every layer → Tasks 2–11 each ship tests; Task 12 regression + e2e. ✓
- Out of scope (WhatsApp, funnel webhooks, automations) → not present. ✓

**Type/name consistency:** `enqueueCampaignEmail({ templateId, to, data, user, campaignId, subjectOverride, recipientUserId })` is defined in Task 6 and called identically in Task 8. `segmentService.resolve(definition, channel)` defined Task 5, called Task 7. `campaignService.launch(id)` defined Task 7, called Task 9. `campaign_recipients.status` values (`queued|sent|failed|skipped`) consistent across Tasks 1, 7, 8. ✓

**Placeholder scan:** every code step contains complete code; no TBD/TODO. ✓

**Known follow-ups (note, not Phase-1 blockers):** single-instance worker has no row-lock claim — fine for one process; if the API is ever scaled horizontally, add a `claimed_at`/`SELECT … FOR UPDATE SKIP LOCKED` pattern to `campaign_recipients` before parallelizing. Logged here intentionally rather than silently assumed safe.

---

# Phase 2 — WhatsApp Campaigns

**Goal:** Send a targeted WhatsApp campaign (AiSensy Pro approved template) to a consented segment, reusing every Phase-1 primitive, plus capture opt-outs and delivery receipts so the WABA quality rating is protected.

**Why it slots in cleanly:** `contacts.phone/whatsapp_opt_in/whatsapp_suppressed`, channel-aware `segmentService.resolve(def, 'whatsapp')`, and `campaign_recipients.channel` already exist from Phase 1. Phase 2 is **additive only** — new tables + `ALTER`, a WhatsApp branch in the worker, a registry UI, and a webhook.

**Naming debt (intentional):** the campaigns table stays `email_campaigns` though it now also holds WhatsApp campaigns. Renaming a live table mid-stream is riskier than the cosmetic cost. Documented; revisit only if it ever causes real confusion.

### Phase-2 Pre-task: Confirm vendor phone source (read-only)

- [ ] Investigate where vendor phone numbers are persisted (onboarding phone-OTP step — check `profiles` columns, `vendorOnboardingRoutes`/controller, and `auth.users.phone`).
- [ ] Decide outcome:
  - **If reliably stored:** extend `contactsService.sync()` to pull vendor phone into `contacts.phone` for `contact_type='vendor'`.
  - **If not:** scope WhatsApp v1 to `guest`/`buyer` contacts (they have phones via `bookings`/`product_purchases`) and file a separate "capture vendor phone" task. Do **not** silently ship vendor WhatsApp that can't reach vendors.
- [ ] Record the decision in the plan before Task 13.

---

### Task 13: Migration v2.7 — WhatsApp template registry

**Files:** Create `server/migrations/v2.7_whatsapp_campaigns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- v2.7 — WhatsApp campaigns (additive on top of v2.6)
-- ============================================================

-- Approved AiSensy templates + their data→placeholder mapping.
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,                 -- friendly label
  aisensy_campaign_name TEXT NOT NULL,                 -- EXACT AiSensy campaign name
  language              TEXT NOT NULL DEFAULT 'en',
  body_preview          TEXT DEFAULT '',               -- human preview of the approved body
  variable_map          JSONB NOT NULL DEFAULT '{}',   -- { "1":"first_name", "2":"service_name", ... }
  param_count           INTEGER NOT NULL DEFAULT 0,
  approval_status       TEXT NOT NULL DEFAULT 'pending',-- pending|approved|rejected (mirrors Meta)
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Campaigns can target a WhatsApp template (email campaigns keep template_id).
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS whatsapp_template_id UUID REFERENCES whatsapp_templates(id);
```

- [ ] **Step 2: Apply + verify** — `SELECT to_regclass('public.whatsapp_templates');` → not null; confirm `email_campaigns.whatsapp_template_id` exists.
- [ ] **Step 3: Commit** — `feat(campaigns): v2.7 — whatsapp template registry`

---

### Task 14: whatsappTemplateService — variable mapping → ordered params

**Files:** Create `server/services/whatsappTemplateService.js` + `server/tests/unit/whatsappTemplateService.test.js`

- [ ] **Step 1: Failing test**

```js
const svc = require('../../services/whatsappTemplateService');
test('builds ordered templateParams from variable_map + contact data', () => {
  const tpl = { param_count: 4, variable_map: { 1: 'first_name', 2: 'service_name', 3: 'vendor_name', 4: 'booking_datetime' } };
  const params = svc.buildParams(tpl, { first_name: 'Asha', service_name: 'SEO', vendor_name: 'BAS', booking_datetime: 'Mon 10am' });
  expect(params).toEqual(['Asha', 'SEO', 'BAS', 'Mon 10am']);
});
test('missing fields become empty strings, order preserved', () => {
  const tpl = { param_count: 2, variable_map: { 1: 'first_name', 2: 'city' } };
  expect(svc.buildParams(tpl, { first_name: 'Asha' })).toEqual(['Asha', '']);
});
```

- [ ] **Step 2: Run → fails.**
- [ ] **Step 3: Implement**

```js
// server/services/whatsappTemplateService.js
'use strict';
/** Build the ordered templateParams array AiSensy expects ({{1}}..{{n}}). */
function buildParams(template, contactData = {}) {
  const n = template.param_count || 0;
  const map = template.variable_map || {};
  const out = [];
  for (let i = 1; i <= n; i++) {
    const field = map[i] ?? map[String(i)];
    const v = field ? contactData[field] : '';
    out.push(v == null ? '' : String(v));
  }
  return out;
}
module.exports = { buildParams };
```

- [ ] **Step 4: Run → passes. Step 5: Commit** — `feat(campaigns): whatsapp variable mapping`

---

### Task 15: campaignWorker — WhatsApp branch (throttled AiSensy send)

**Files:** Modify `server/services/campaignWorker.js`; add `server/tests/unit/campaignWorkerWhatsapp.test.js`

- [ ] **Step 1: Failing test** — mock `aisensyService.sendCampaign` (returns `{success:true}`), a `sending` campaign with `channel:'whatsapp'`, a `whatsapp_templates` row, an active `aisensy` provider, and a recipient with `destination` phone. Assert `sendCampaign` called with the built params + campaign name, recipient marked `sent`, and a `notification_logs` row written.

```js
// key assertions
expect(aisensyMock.sendCampaign).toHaveBeenCalledWith(expect.objectContaining({
  campaignName: 'promo_june', destination: '919991112222', templateParams: ['Asha', 'SEO'],
}));
expect(state.recipients[0].status).toBe('sent');
```

- [ ] **Step 2: Run → fails.**
- [ ] **Step 3: Implement** — in `processDue()`, branch on `campaign.channel`:

```js
const aisensy = require('./aisensyService');
const waTemplates = require('./whatsappTemplateService');
const NotificationEngine = require('./notificationEngine'); // for logResult reuse

// inside the recipient loop, replace the email-only block with:
if (campaign.channel === 'whatsapp') {
  if (!contact.phone || !contact.whatsapp_opt_in || contact.whatsapp_suppressed) { await mark(rcpt.id, 'skipped', 'not_contactable'); continue; }
  const { data: tpl } = await supabaseAdmin.from('whatsapp_templates').select('*').eq('id', campaign.whatsapp_template_id).single();
  const { data: provider } = await supabaseAdmin.from('notification_providers').select('*').eq('provider', 'aisensy').single();
  if (!tpl || !provider || !provider.is_active || !provider.api_key) { await mark(rcpt.id, 'failed', 'whatsapp_not_configured'); failed++; continue; }
  const cdata = { first_name: (contact.name || '').split(' ')[0], name: contact.name, ...(contact.attributes || {}) };
  const params = waTemplates.buildParams(tpl, cdata);
  const r = await aisensy.sendCampaign({ apiKey: provider.api_key, campaignName: tpl.aisensy_campaign_name, destination: contact.phone, userName: contact.name, templateParams: params });
  await NotificationEngine.logResult({ event: `CAMPAIGN:${campaign.id}`, channel: 'whatsapp', destination: contact.phone, status: r.success ? 'sent' : 'failed', response: r.response, error: r.error, payload: { campaignName: tpl.aisensy_campaign_name, templateParams: params } });
  if (r.success) { await mark(rcpt.id, 'sent'); enqueued++; } else { await mark(rcpt.id, 'failed', r.error); failed++; }
  continue;
}
// ...existing email branch unchanged...
```

- [ ] **Step 4: Run → passes (and re-run `campaignWorker.test.js` for no email regression). Step 5: Commit.**

> THROTTLE: the existing `limit(throttle_per_min)` per tick already paces WhatsApp. Set a conservative default for WhatsApp campaigns (e.g. 60/min) in the UI to protect the WABA quality rating.

---

### Task 16: campaignService.launch — WhatsApp channel

**Files:** Modify `server/services/campaignService.js`; extend `campaignService.test.js`

- [ ] **Step 1: Failing test** — campaign `channel:'whatsapp'`; assert `segmentService.resolve` called with `'whatsapp'` and recipients snapshotted with `destination = contact.phone`, `channel:'whatsapp'`.
- [ ] **Step 2: Run → fails. Step 3: Implement** — in `launch()` derive channel and destination field:

```js
const channel = campaign.channel || 'email';
const recipients = await segmentService.resolve(segment ? segment.definition : {}, channel);
const rows = recipients.map((c) => ({
  campaign_id: campaignId, contact_id: c.id, channel,
  destination: channel === 'whatsapp' ? c.phone : c.email, status: 'queued', attempts: 0,
}));
// guard: require the right template ref
if (channel === 'whatsapp' && !campaign.whatsapp_template_id) return { error: 'no_whatsapp_template' };
if (channel === 'email' && !campaign.template_id) return { error: 'no_template' };
```

- [ ] **Step 4: Run → passes. Step 5: Commit.**

---

### Task 17: whatsappTemplate admin endpoints + campaign create accepts channel

**Files:** Modify `server/controllers/campaignAdminController.js`, `server/routes/adminRoutes.js`; extend controller test.

- [ ] Add handlers: `listWaTemplates`, `createWaTemplate` (name, aisensy_campaign_name, language, body_preview, variable_map, param_count, approval_status), `updateWaTemplate`. Gate `campaigns.view`/`campaigns.manage`.
- [ ] Extend `createCampaign`/`updateCampaign` allowed fields with `channel`, `whatsapp_template_id`.
- [ ] Routes (register BEFORE `/campaigns/:id`):

```js
router.get('/campaigns/wa-templates',       requireAdmin('campaigns.view'),   campaigns.listWaTemplates);
router.post('/campaigns/wa-templates',      requireAdmin('campaigns.manage'), campaigns.createWaTemplate);
router.put('/campaigns/wa-templates/:id',   requireAdmin('campaigns.manage'), campaigns.updateWaTemplate);
```

- [ ] TDD each handler (mock supabase per existing pattern). Commit.

---

### Task 18: AiSensy delivery + opt-out webhook (compliance-critical)

**Files:** Create `server/controllers/whatsappWebhookController.js`; add a **public** route in `server/routes/authRoutes.js` or a new `notificationРublicRoutes` mounted in `server.js`; test.

- [ ] **Behaviour:**
  - Verify the request (shared secret in query/header matching `notification_providers.settings_json.webhook_secret`, or AiSensy's signature — confirm AiSensy's exact webhook scheme first).
  - On a **delivery/read** status: match `notification_logs`/`campaign_recipients` by destination + recent campaign and update status/timestamps.
  - On an **opt-out / STOP** inbound: set `contacts.whatsapp_suppressed = true` for that phone. **This is the non-negotiable bit** — never message an opted-out number again.
- [ ] Route is public (no `requireAdmin`) but secret-gated. Mount before `express.json` only if AiSensy needs raw body for signature (mirror the Razorpay raw-body pattern in `server.js:24`); otherwise standard JSON.
- [ ] **TDD:** POST a STOP payload → assert `contacts.whatsapp_suppressed` set; POST a delivered payload → assert recipient row updated; POST with bad secret → 401.
- [ ] Commit.

> CONFIRM BEFORE BUILD: AiSensy Pro webhook payload shape + whether it posts inbound user replies (needed for STOP detection). If AiSensy doesn't surface inbound opt-outs, rely on its native opt-out handling and document that limitation — do not claim opt-out capture we don't have.

---

### Task 19: Client — WhatsApp in the Campaigns builder + template registry UI

**Files:** Modify `client/src/pages/admin/AdminCampaigns.jsx`, `client/src/services/api.js`; optional new `AdminWaTemplates` sub-view.

- [ ] Channel selector (Email | WhatsApp) at step 1. When WhatsApp: template dropdown sources `wa-templates`; show body preview + the variable map; show **recipient count** from `segmentService.count(def, 'whatsapp')` and a **cost estimate** line (`count × per-msg cost`, cost configurable).
- [ ] A small registry view to add/edit WhatsApp templates (name, AiSensy campaign name, language, param count, variable map rows `{{1}} → [field]`, approval status).
- [ ] api.js: `adminCampWaTemplates`, `adminCampWaCreate`, `adminCampWaUpdate`.
- [ ] Vitest smoke: renders channel toggle + WhatsApp template select. Build. Commit.

---

### Task 20: AiSensy onboarding wizard (polish — convert the flat form)

**Files:** Modify `client/src/pages/admin/AdminNotifications.jsx` (or fold AiSensy setup under the Campaigns/WhatsApp area).

- [ ] Convert the single AiSensy form into the stepped flow: **Connect → Verify (existing testConnection) → Register templates → Map variables → Send test → Activate**, with a persisted `setup_step` and a progress indicator.
- [ ] Lower priority than Tasks 13–19; if time-boxed, ship the registry (Task 19) and keep the existing flat AiSensy config form, deferring the wizard. Mark clearly if deferred.
- [ ] Commit.

---

### Task 21: Phase-2 regression + WhatsApp e2e

- [ ] `cd server && npm test` (all green incl. new WA tests) and `cd client && npm test`.
- [ ] Manual e2e to a real opted-in test number: register an approved AiSensy template + map variables → create WhatsApp campaign → tiny test segment → Launch → confirm message received, `campaign_recipients`/`notification_logs` updated, throttle respected.
- [ ] Send STOP from the test phone → confirm `whatsapp_suppressed` set and the contact is excluded on next launch.
- [ ] Commit / PR.

---

# Phase 3 — Documentation

**Goal:** Operator-facing guides ("documentation for me") + developer reference + updated project docs/memory, so the platform is usable and maintainable without re-deriving how it works.

### Task 22: Architecture reference
- [ ] Create `docs/communication-campaigns-architecture.md`: the 4-layer model, data model (all new tables + the `email_campaigns` naming note), send pipelines (email queue reuse; WhatsApp throttle), consent/suppression flow, channel differences table, worker/interval map, webhook flow, and a "how to add a future channel (SMS/Push)" section.

### Task 23: Operator guides (plain-English, screenshot-ready)
- [ ] `docs/guides/email-campaigns.md` — set Resend, sync contacts, pick a segment, choose a template, preview, test, launch, read results.
- [ ] `docs/guides/whatsapp-campaigns.md` — register an approved AiSensy template, map variables, recipient/cost preview, launch, throttle guidance, what STOP/opt-out does.
- [ ] `docs/guides/aisensy-onboarding.md` — get the API key, connected number, create + get a template approved in AiSensy, paste the campaign name, send a test.
- [ ] `docs/guides/segments-and-consent.md` — what a segment is, how consent/suppression is enforced, how to suppress a contact.

### Task 24: Update existing project docs
- [ ] `docs/database-schema.md` — add `contacts`, `segments`, `email_campaigns`, `campaign_recipients`, `whatsapp_templates`, `email_logs.campaign_id`; note migrations v2.6/v2.7.
- [ ] `docs/feature-map.md` — Campaigns feature → file ownership.
- [ ] `docs/current-state.md` + `docs/current-work.md` — campaigns shipped, what works, known limits (funnel depth, vendor phone caveat if any).
- [ ] `docs/ai-context.md` — campaign rules (never bypass consent; never inline-send; reuse engines).

### Task 25: Update agent memory
- [ ] Update `[[notification-system]]` and `[[email-communication-engine]]` memory files + `MEMORY.md` index with the campaign platform (contacts/segments/campaigns, the worker, channel enforcement). New memory: `campaign-platform`.

### Task 26 (optional): In-app help
- [ ] Tooltips/empty-state copy on the Campaigns + AiSensy pages pointing to the guides.

---

# Master Execution Plan, Gates & Definition of Done

## Prerequisite gates (resolve before Task 1)
| Gate | Needed for | Decision |
|---|---|---|
| `git init` (repo is not git today) | per-task rollback checkpoints | **your call** |
| Apply v2.6 + v2.7 to **live** Supabase | Tasks 1, 13 | **your explicit go** (additive, non-destructive) |
| `RESEND_API_KEY` + verified sender domain | real email send (Task 3 step 6, e2e) | needed by Phase-1 e2e |
| AiSensy Pro: API key, connected number, ≥1 approved template, exact campaign name | Phase 2 | needed by Phase-2 e2e |
| Confirm AiSensy webhook payload shape | Task 18 | confirm before building webhook |
| Vendor phone source confirmed | Phase-2 pre-task | confirm; may scope WA to guests first |
| A test inbox + a test opted-in phone | e2e per channel | needed for e2e |

## Sequencing
Phase 1 (Tasks 1–12) → Phase 2 (Pre-task, 13–21) → Phase 3 (22–26). Within each phase, tasks are ordered and individually committable. Phase 2 never edits Phase-1 schema (additive). Phase 3 only writes docs/memory.

## Test strategy (every phase)
- Unit: one Jest test file per service/controller (hand-rolled Supabase mock pattern).
- Client: Vitest smoke per new page.
- Regression: full `npm test` (server + client) at the end of each phase — must stay green (server 205+ baseline).
- Manual e2e: the per-channel checklists (Task 12 email, Task 21 WhatsApp) against real Resend/AiSensy with tiny segments.

## Rollback & safety
- All migrations additive (`IF NOT EXISTS`, `ADD COLUMN`, `ON CONFLICT`) — no drops, no data loss; safe to re-run.
- Campaigns are inert until `Launch`; nav entry is permission-gated, so the UI can be hidden by withholding `campaigns.view`.
- Consent/suppression enforced in `segmentService` AND re-checked in the worker (defense in depth) — no path sends to an opted-out contact.
- git checkpoints (if initialised) let any task be reverted independently.

## Definition of Done
- **Phase 1:** an admin sends a real email campaign to a segment; recipients snapshotted; emails land with `campaign_id`; suppressed contacts skipped; all tests green.
- **Phase 2:** an admin sends a real WhatsApp campaign via an approved AiSensy template to a consented segment; throttled; STOP opt-out suppresses the contact; all tests green.
- **Phase 3:** all guides + reference + updated project docs/memory committed; a non-dev can run a campaign from the guide alone.

## Risk register
| Risk | Mitigation |
|---|---|
| Gmail SMTP can't do bulk | Move bulk to Resend (Task 3); transactional can stay SMTP |
| WABA quality drop from blasting | Throttle default + opt-out webhook + consented-only segments |
| Vendor phones missing | Pre-task confirms; scope WA to guests first if absent |
| AiSensy lacks template-list / webhook specifics | Manual template registry; confirm webhook shape before Task 18; document any limitation honestly |
| Live migration on prod | Additive only + explicit go + verify queries |
| Single-instance worker double-send if scaled out | Documented; add row-claim before horizontal scaling |
