# Reschedule + Feature Flags + Reschedule Fee — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guest reschedule (with Google Calendar move), leave-review, and rebook to `/my-bookings`, gated by a new admin "Feature Status" kill-switch system, with a platform-kept reschedule fee (default ₹0, first reschedule free) built end-to-end.

**Architecture:** Three sequential-dependent subsystems. (1) A `feature_flags` table + cached `isFeatureEnabled()` helper + admin toggle UI. (2) `rescheduleBooking` gated by the `reschedule` flag, stores+patches a Google Calendar event, increments a guest reschedule counter. (3) A platform reschedule fee (vendor opt-in ₹0/₹10) charged from the 2nd reschedule via Razorpay, posted to the existing double-entry ledger. Server enforcement is authoritative; client flag checks only hide UI.

**Tech Stack:** Node/Express + Supabase (PG) server, Jest tests; React 18 + Vite client, Vitest tests; Razorpay; Google Calendar API; existing ledger (`postSafe` + `journalTemplates`).

**Branch:** `feat/reschedule-feature-flags` (already created; spec committed).

**Spec:** `docs/superpowers/specs/2026-06-14-reschedule-feature-flags-fee-design.md`

**Conventions to mirror:**
- Cached config service: `server/services/platformConfig.js`
- Admin route guard: `requireAdmin('perm')` in `server/routes/adminRoutes.js`
- Admin nav: `NAV` array in `client/src/components/common/AdminLayout.jsx`
- Ledger post: `postSafe({sourceType,sourceId,journalDate,template})` + builders in `server/services/ledger/journalTemplates.js`
- Jest controller test: mock-chain style in `server/tests/unit/bookingCalendarDeferral.test.js`
- API client: `client/src/services/api.js`
- `safeError(res, err)` from `server/utils/httpError`; `verifySignature` + `decryptToken` as imported in `server/controllers/paymentController.js`

---

## Phase 1 — Feature Flags backend

### Task 1: Migration — `feature_flags` table

**Files:**
- Create: `server/migrations/v3.2_feature_flags.sql`

- [ ] **Step 1: Confirm next version**

Run: `ls server/migrations` — confirm latest is `v3.1_user_phone_index.sql` and `v3.2*` does not exist. If taken, bump to the next free number and use it consistently below. NEVER touch `v2.9_explore.sql`.

- [ ] **Step 2: Write the migration**

```sql
-- v3.2_feature_flags.sql — generic admin kill-switches ("Feature Status")
create table if not exists feature_flags (
  key         text primary key,
  label       text not null,
  description text,
  category    text,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into feature_flags (key, label, description, category, enabled) values
  ('reschedule', 'Booking Reschedule',
   'Allow guests and vendors to reschedule bookings. Off = all reschedule blocked.',
   'bookings', true),
  ('reschedule_fee', 'Reschedule Fee Charging',
   'Charge guests the vendor-set reschedule fee from the 2nd reschedule onward. Off = all reschedules free.',
   'bookings', true)
on conflict (key) do nothing;
```

- [ ] **Step 3: Apply in Supabase SQL Editor**

Paste + run. Verify: `select * from feature_flags;` returns 2 rows.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/v3.2_feature_flags.sql
git commit -m "feat(db): v3.2 feature_flags table + reschedule/reschedule_fee seeds"
```

---

### Task 2: `featureFlags` service (cached `isFeatureEnabled`)

**Files:**
- Create: `server/services/featureFlags.js`
- Test: `server/tests/unit/featureFlags.test.js`

- [ ] **Step 1: Write the failing test**

```js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
const featureFlags = require('../../services/featureFlags');

const wire = (rows, error = null) =>
  mockFrom.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({ data: rows, error }) }));

beforeEach(() => { jest.clearAllMocks(); featureFlags.clearCache(); });

test('returns the stored enabled value', async () => {
  wire([{ key: 'reschedule', enabled: false }]);
  expect(await featureFlags.isFeatureEnabled('reschedule')).toBe(false);
});

test('fail-open: unknown key defaults to enabled', async () => {
  wire([]);
  expect(await featureFlags.isFeatureEnabled('nope')).toBe(true);
});

test('fail-open: on DB error defaults to enabled', async () => {
  wire(null, { message: 'boom' });
  expect(await featureFlags.isFeatureEnabled('reschedule')).toBe(true);
});

test('caches within TTL (one DB read for two calls)', async () => {
  wire([{ key: 'reschedule', enabled: true }]);
  await featureFlags.isFeatureEnabled('reschedule');
  await featureFlags.isFeatureEnabled('reschedule');
  expect(mockFrom).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module '../../services/featureFlags'`)

Run: `cd server && npx jest tests/unit/featureFlags.test.js`

- [ ] **Step 3: Implement**

```js
// server/services/featureFlags.js
const { supabaseAdmin } = require('../config/supabase');

const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, map: null };

async function loadFlags() {
  const now = Date.now();
  if (_cache.map && now - _cache.at < CACHE_TTL_MS) return _cache.map;
  const map = {};
  try {
    const { data, error } = await supabaseAdmin.from('feature_flags').select('key, enabled');
    if (!error) for (const row of data || []) map[row.key] = !!row.enabled;
  } catch (_) { /* fail-open below */ }
  _cache = { at: now, map };
  return map;
}

// Fail-open: unknown / errored flags default to enabled so a missing
// migration never bricks a feature.
async function isFeatureEnabled(key) {
  const map = await loadFlags();
  return key in map ? map[key] : true;
}

function clearCache() { _cache = { at: 0, map: null }; }

module.exports = { isFeatureEnabled, loadFlags, clearCache };
```

- [ ] **Step 4: Run — expect PASS** (all 4)

- [ ] **Step 5: Commit**

```bash
git add server/services/featureFlags.js server/tests/unit/featureFlags.test.js
git commit -m "feat(flags): cached isFeatureEnabled helper (fail-open)"
```

---

### Task 3: Feature-flag controller + routes (admin + public)

**Files:**
- Create: `server/controllers/featureFlagController.js`
- Create: `server/routes/featureFlagRoutes.js`
- Modify: `server/routes/adminRoutes.js`
- Modify: `server/server.js` (mount public route)
- Test: `server/tests/unit/featureFlagController.test.js`

- [ ] **Step 1: Write the failing test**

```js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/featureFlags', () => ({
  loadFlags: jest.fn(), clearCache: jest.fn(),
}));
const featureFlags = require('../../services/featureFlags');
const { getPublicFlags, toggleFlag } = require('../../controllers/featureFlagController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('getPublicFlags returns only public keys, fail-open default true', async () => {
  featureFlags.loadFlags.mockResolvedValue({ reschedule: false });
  const r = res();
  await getPublicFlags({}, r);
  expect(r.json).toHaveBeenCalledWith({ reschedule: false, reschedule_fee: true });
});

test('toggleFlag rejects non-boolean', async () => {
  const r = res();
  await toggleFlag({ params: { key: 'reschedule' }, body: { enabled: 'yes' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('toggleFlag updates + clears cache', async () => {
  mockFrom.mockImplementation(() => {
    const c = { update: jest.fn(() => c), eq: jest.fn(() => c), select: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({ data: { key: 'reschedule', enabled: false }, error: null }) };
    return c;
  });
  const r = res();
  await toggleFlag({ params: { key: 'reschedule' }, body: { enabled: false }, admin: { id: 'a1' } }, r);
  expect(featureFlags.clearCache).toHaveBeenCalled();
  expect(r.json).toHaveBeenCalledWith({ key: 'reschedule', enabled: false });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd server && npx jest tests/unit/featureFlagController.test.js`

- [ ] **Step 3: Implement controller**

```js
// server/controllers/featureFlagController.js
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const featureFlags = require('../services/featureFlags');

// Flags safe to expose to unauthenticated clients (UI gating only).
const PUBLIC_KEYS = ['reschedule', 'reschedule_fee'];

// GET /api/admin/features
const getFlags = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('feature_flags').select('*').order('key');
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};

// PATCH /api/admin/features/:key
const toggleFlag = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ message: 'enabled (boolean) is required' });
    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .update({ enabled, updated_at: new Date().toISOString(), updated_by: req.admin?.id || req.user?.id || null })
      .eq('key', req.params.key)
      .select().single();
    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: 'Flag not found' });
    featureFlags.clearCache();
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// GET /api/feature-flags  (public)
const getPublicFlags = async (req, res) => {
  try {
    const map = await featureFlags.loadFlags();
    const out = {};
    for (const k of PUBLIC_KEYS) out[k] = k in map ? map[k] : true;
    res.json(out);
  } catch (e) { safeError(res, e); }
};

module.exports = { getFlags, toggleFlag, getPublicFlags };
```

- [ ] **Step 4: Wire admin routes** — in `server/routes/adminRoutes.js`, near the settings routes add:

```js
const features = require('../controllers/featureFlagController');
router.get('/features',        requireAdmin('settings.manage'), features.getFlags);
router.patch('/features/:key', requireAdmin('settings.manage'), features.toggleFlag);
```

- [ ] **Step 5: Public route file**

```js
// server/routes/featureFlagRoutes.js
const express = require('express');
const router = express.Router();
const { getPublicFlags } = require('../controllers/featureFlagController');
router.get('/', getPublicFlags);
module.exports = router;
```

- [ ] **Step 6: Mount public route** — in `server/server.js`, beside the other `app.use('/api/...')` mounts add:

```js
app.use('/api/feature-flags', require('./routes/featureFlagRoutes'));
```

- [ ] **Step 7: Run — expect PASS** (all 3)

- [ ] **Step 8: Manual smoke**

Run server (`npm run dev`), then `curl http://localhost:5000/api/feature-flags` → `{"reschedule":true,"reschedule_fee":true}`.

- [ ] **Step 9: Commit**

```bash
git add server/controllers/featureFlagController.js server/routes/featureFlagRoutes.js server/routes/adminRoutes.js server/server.js server/tests/unit/featureFlagController.test.js
git commit -m "feat(flags): admin list/toggle + public read endpoints"
```

---

## Phase 2 — Feature Flags admin UI + client hook

### Task 4: API client functions + `useFeatureFlags` hook

**Files:**
- Modify: `client/src/services/api.js`
- Create: `client/src/hooks/useFeatureFlags.js`
- Test: `client/src/tests/useFeatureFlags.test.jsx`

- [ ] **Step 1: Add API functions** — append to `client/src/services/api.js`:

```js
// ── Feature flags ─────────────────────────────────────────────
export const getFeatureFlags    = ()             => API.get('/feature-flags');
export const adminGetFeatures   = ()             => API.get('/admin/features');
export const adminToggleFeature = (key, enabled) => API.patch(`/admin/features/${key}`, { enabled });
// ── Reschedule fee ────────────────────────────────────────────
export const createRescheduleFeeOrder = (bookingId) => API.post('/payment/reschedule-fee/create-order', { booking_id: bookingId });
```

- [ ] **Step 2: Write the failing test**

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({ getFeatureFlags: vi.fn() }));
import { getFeatureFlags } from '../services/api';
import useFeatureFlags, { _resetFlagCache } from '../hooks/useFeatureFlags';

function Probe() {
  const { on } = useFeatureFlags();
  return <span>{on('reschedule') ? 'on' : 'off'}|{on('unknown') ? 'on' : 'off'}</span>;
}

beforeEach(() => { _resetFlagCache(); vi.clearAllMocks(); });

test('reads flags; unknown keys fail open to on', async () => {
  getFeatureFlags.mockResolvedValue({ data: { reschedule: false } });
  render(<Probe />);
  await waitFor(() => expect(screen.getByText('off|on')).toBeInTheDocument());
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `cd client && npx vitest run src/tests/useFeatureFlags.test.jsx`

- [ ] **Step 4: Implement hook**

```js
// client/src/hooks/useFeatureFlags.js
import { useEffect, useState } from 'react';
import { getFeatureFlags } from '../services/api';

let _cache = null;

export function _resetFlagCache() { _cache = null; } // test helper

export default function useFeatureFlags() {
  const [flags, setFlags] = useState(_cache || {});
  useEffect(() => {
    if (_cache) return;
    getFeatureFlags()
      .then(({ data }) => { _cache = data || {}; setFlags(_cache); })
      .catch(() => { /* fail-open: on() treats missing as enabled */ });
  }, []);
  // Fail-open default: a key we don't know about is treated as enabled.
  const on = (key) => (key in flags ? flags[key] : true);
  return { flags, on };
}
```

- [ ] **Step 5: Run — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add client/src/services/api.js client/src/hooks/useFeatureFlags.js client/src/tests/useFeatureFlags.test.jsx
git commit -m "feat(flags): client api + useFeatureFlags hook (fail-open)"
```

---

### Task 5: Admin "Feature Status" page + route + nav

**Files:**
- Create: `client/src/pages/admin/AdminFeatureStatus.jsx`
- Modify: `client/src/App.jsx` (lazy import + route)
- Modify: `client/src/components/common/AdminLayout.jsx` (NAV entry)
- Test: `client/src/pages/admin/__tests__/AdminFeatureStatus.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('../../../services/api', () => ({
  adminGetFeatures: vi.fn(), adminToggleFeature: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
import { adminGetFeatures, adminToggleFeature } from '../../../services/api';
import AdminFeatureStatus from '../AdminFeatureStatus';

beforeEach(() => vi.clearAllMocks());

test('lists flags and toggles one', async () => {
  adminGetFeatures.mockResolvedValue({ data: [
    { key: 'reschedule', label: 'Booking Reschedule', description: 'x', enabled: true },
  ] });
  adminToggleFeature.mockResolvedValue({ data: { key: 'reschedule', enabled: false } });
  render(<AdminFeatureStatus />);
  await waitFor(() => screen.getByText('Booking Reschedule'));
  fireEvent.click(screen.getByRole('switch', { name: /Booking Reschedule/i }));
  await waitFor(() => expect(adminToggleFeature).toHaveBeenCalledWith('reschedule', false));
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd client && npx vitest run src/pages/admin/__tests__/AdminFeatureStatus.test.jsx`

- [ ] **Step 3: Implement the page**

```jsx
// client/src/pages/admin/AdminFeatureStatus.jsx
import { useEffect, useState } from 'react';
import { adminGetFeatures, adminToggleFeature } from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminFeatureStatus() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    adminGetFeatures()
      .then(({ data }) => setFlags(Array.isArray(data) ? data : []))
      .catch(() => setFlags([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (f) => {
    const next = !f.enabled;
    setBusy(f.key);
    setFlags((fs) => fs.map((x) => (x.key === f.key ? { ...x, enabled: next } : x))); // optimistic
    try {
      await adminToggleFeature(f.key, next);
      toast.success(`${f.label} ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setFlags((fs) => fs.map((x) => (x.key === f.key ? { ...x, enabled: f.enabled } : x))); // rollback
      toast.error('Could not update');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Feature Status</h1>
      <p className="text-sm text-gray-500 mb-6">Turn platform features on or off.</p>
      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          {flags.map((f) => (
            <div key={f.key} className="flex items-start justify-between gap-4 bg-white border rounded-xl p-4">
              <div className="min-w-0">
                <p className="font-semibold">{f.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{f.description}</p>
              </div>
              <button
                role="switch"
                aria-checked={f.enabled}
                aria-label={f.label}
                disabled={busy === f.key}
                onClick={() => toggle(f)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${f.enabled ? 'bg-[#FE5100]' : 'bg-gray-300'} disabled:opacity-50`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${f.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add lazy import + route** — in `client/src/App.jsx`:

Import (near the other admin lazy imports):
```jsx
const AdminFeatureStatus = lazy(() => import('./pages/admin/AdminFeatureStatus'));
```
Route (beside other `/admin/*` routes):
```jsx
<Route path="/admin/features" element={<AdminWrapper><AdminFeatureStatus /></AdminWrapper>} />
```

- [ ] **Step 5: Add top-level nav entry** — in `client/src/components/common/AdminLayout.jsx`, add a new section to the `NAV` array (place before the `future` section):

```js
{ id:'control', section:'PLATFORM CONTROL', items:[
  { label:'Feature Status', icon:'zap', to:'/admin/features', perm:'settings.manage' },
]},
```

- [ ] **Step 6: Run — expect PASS**; then manual: log into `/hello-sloth`, open `/admin/features`, toggle reschedule, confirm `select * from feature_flags` reflects it.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/AdminFeatureStatus.jsx client/src/App.jsx client/src/components/common/AdminLayout.jsx client/src/pages/admin/__tests__/AdminFeatureStatus.test.jsx
git commit -m "feat(admin): Feature Status page, route, nav entry"
```

---

## Phase 3 — Calendar event move + reschedule gating

### Task 6: Migration — booking calendar id + reschedule count

**Files:**
- Create: `server/migrations/v3.3_booking_reschedule.sql`

- [ ] **Step 1: Write**

```sql
-- v3.3_booking_reschedule.sql
alter table bookings add column if not exists google_event_id text;
alter table bookings add column if not exists reschedule_count integer not null default 0;
```

- [ ] **Step 2: Apply in Supabase**; verify columns exist (`select google_event_id, reschedule_count from bookings limit 1;`).

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.3_booking_reschedule.sql
git commit -m "feat(db): v3.3 bookings.google_event_id + reschedule_count"
```

---

### Task 7: `updateCalendarEvent` in google.js

**Files:**
- Modify: `server/config/google.js`
- Test: `server/tests/unit/updateCalendarEvent.test.js`

- [ ] **Step 1: Write the failing test**

```js
const patch = jest.fn().mockResolvedValue({ data: { id: 'evt1', hangoutLink: 'https://meet/x', htmlLink: 'h' } });
jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: function () { this.setCredentials = () => {}; } },
    calendar: () => ({ events: { patch } }),
  },
}));
const { updateCalendarEvent } = require('../../config/google');

beforeEach(() => jest.clearAllMocks());

test('patches start/end with sendUpdates all, keeps meet link', async () => {
  const out = await updateCalendarEvent('a', 'r', 'evt1', {
    startTime: '2099-01-01T05:00:00.000Z', endTime: '2099-01-01T05:30:00.000Z', timezone: 'Asia/Kolkata',
  });
  expect(patch).toHaveBeenCalledWith(expect.objectContaining({
    calendarId: 'primary', eventId: 'evt1', sendUpdates: 'all',
  }));
  expect(out.meetLink).toBe('https://meet/x');
});
```

- [ ] **Step 2: Run — expect FAIL** (`updateCalendarEvent is not a function`)

Run: `cd server && npx jest tests/unit/updateCalendarEvent.test.js`

- [ ] **Step 3: Implement** — add to `server/config/google.js` (before `module.exports`) and export it:

```js
// Move an existing event to a new time. Keeps the same Meet link; notifies
// attendees. Used by reschedule.
const updateCalendarEvent = async (accessToken, refreshToken, eventId, { startTime, endTime, timezone }) => {
  const auth = buildOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
    resource: {
      start: { dateTime: startTime, timeZone: timezone || 'Asia/Kolkata' },
      end:   { dateTime: endTime,   timeZone: timezone || 'Asia/Kolkata' },
    },
  });
  return {
    eventId: response.data.id,
    meetLink: response.data.hangoutLink,
    htmlLink: response.data.htmlLink,
  };
};
```
Add `updateCalendarEvent,` to the `module.exports` object.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server/config/google.js server/tests/unit/updateCalendarEvent.test.js
git commit -m "feat(calendar): updateCalendarEvent (events.patch, keep meet link)"
```

---

### Task 8: Persist `google_event_id` on event creation

**Files:**
- Modify: `server/controllers/bookingController.js` (free-service create path, ~line 272)
- Modify: `server/controllers/paymentController.js` (post-payment path, ~line 274)

- [ ] **Step 1: bookingController** — where the free-service event is created, capture the id and add it to the insert payload.

After `meetingLink = event.meetLink || "";` add:
```js
        var googleEventId = event.eventId || null;
```
Then in `bookingPayload`, add the field:
```js
      google_event_id: typeof googleEventId !== "undefined" ? googleEventId : null,
```
Locate the existing schema-cache fallback that strips v2.5-only columns (the block that removes `end_at` when the column is missing) and add `google_event_id` to the same stripped set, so pre-migration DBs still insert.

- [ ] **Step 2: paymentController** — in the post-payment calendar block, when persisting `meeting_link`, also persist the event id:

Replace the relink update:
```js
            const { data: relinked } = await supabaseAdmin
              .from("bookings").update({ meeting_link: meetingLink, google_event_id: event.eventId || null }).eq("id", booking_id).select().single();
```
(If a schema-cache error fires on `google_event_id`, retry with only `meeting_link` — mirror the existing fallback pattern in that file.)

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd server && npx jest tests/unit/bookingCalendarDeferral.test.js` → PASS. (The google mock returns no `eventId`; payload field resolves to `null`, harmless.)

- [ ] **Step 4: Commit**

```bash
git add server/controllers/bookingController.js server/controllers/paymentController.js
git commit -m "feat(calendar): persist google_event_id on booking creation"
```

---

### Task 9: Gate reschedule by flag + patch calendar + count

**Files:**
- Modify: `server/controllers/bookingController.js` (`rescheduleBooking`, ~line 624; imports at top)
- Test: `server/tests/unit/rescheduleBooking.test.js`

- [ ] **Step 1: Write the failing test**

```js
jest.mock('../../config/google', () => ({
  updateCalendarEvent: jest.fn().mockResolvedValue({}),
  createCalendarEvent: jest.fn(),
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
const featureFlags = require('../../services/featureFlags');
const { updateCalendarEvent } = require('../../config/google');

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/cryptoTokens', () => ({ decryptToken: (v) => v, decrypt: (v) => v }));

const { rescheduleBooking } = require('../../controllers/bookingController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

const futureISO = '2099-01-01T05:00:00.000Z';
const baseBooking = {
  id: 'b1', host_id: 'h1', guest_id: 'g1', status: 'confirmed', reschedule_count: 0,
  scheduled_at: '2098-12-01T05:00:00.000Z', services: { duration: 30, grace_period_minutes: 10 },
  google_event_id: 'evt1',
  'profiles!bookings_host_id_fkey': { id: 'h1', google_calendar_connected: true, google_refresh_token: 'r', google_access_token: 'a', reschedule_fee: 0 },
};

const wire = (booking) => mockFrom.mockImplementation((table) => {
  const chain = {
    select: jest.fn(() => chain), eq: jest.fn(() => chain), neq: jest.fn(() => chain),
    gte: jest.fn(() => chain), lte: jest.fn(() => chain), update: jest.fn(() => chain),
    single: jest.fn().mockResolvedValue({ data: booking, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: { timezone: 'Asia/Kolkata', buffer_minutes: 0 } }),
    then: undefined,
  };
  // availability select + conflicts select resolve to arrays via the awaited chain
  chain.select = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  return chain;
});

beforeEach(() => jest.clearAllMocks());

test('403 when reschedule flag is off', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(false);
  wire(baseBooking);
  const r = res();
  await rescheduleBooking({ params: { id: 'b1' }, user: { id: 'g1' }, body: { scheduled_at: futureISO } }, r);
  expect(r.status).toHaveBeenCalledWith(403);
});

test('guest reschedule patches the calendar event when flag on', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  wire(baseBooking);
  const r = res();
  await rescheduleBooking({ params: { id: 'b1' }, user: { id: 'g1' }, body: { scheduled_at: futureISO } }, r);
  expect(updateCalendarEvent).toHaveBeenCalledWith('a', 'r', 'evt1', expect.objectContaining({ timezone: 'Asia/Kolkata' }));
});
```

> Note: the conflict-detection query returns an array. If the mock chain resolves `single`/array shapes awkwardly for your version, adapt `wire()` so the conflicts `select(...).gte(...).lte(...)` resolves to `{ data: [], error: null }` (await on the chain). Keep the two assertions identical.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd server && npx jest tests/unit/rescheduleBooking.test.js`

- [ ] **Step 3: Implement edits in `rescheduleBooking`**

(a) Top of file imports — extend the google import and add featureFlags:
```js
const { createCalendarEvent, updateCalendarEvent } = require("../config/google");
const featureFlags = require("../services/featureFlags");
```
(Ensure `decryptToken` is imported in this file; if not, add `const { decryptToken } = require("../utils/cryptoTokens");` matching paymentController's import.)

(b) First line inside the `try` of `rescheduleBooking`:
```js
    if (!(await featureFlags.isFeatureEnabled('reschedule'))) {
      return res.status(403).json({ message: 'Reschedule is currently disabled' });
    }
```

(c) Where `isHostReschedule` is computed, add guest count and put it into `rescheduleUpdate`:
```js
    const isHostReschedule = req.user?.id === booking.host_id;
    const isGuestReschedule = !isHostReschedule;
```
Add to the `rescheduleUpdate` object:
```js
      reschedule_count: (Number(booking.reschedule_count) || 0) + (isGuestReschedule ? 1 : 0),
```
Add `reschedule_count` to the schema-cache fallback strip set (same block that drops `end_at`).

(d) After the booking row is updated successfully (`const { data: updated, error } = rescheduleResult;` … `if (error) return safeError(res, error);`) add the calendar patch:
```js
    try {
      const hostRow = booking["profiles!bookings_host_id_fkey"] || {};
      if (booking.google_event_id && hostRow.google_calendar_connected && hostRow.google_refresh_token) {
        await updateCalendarEvent(
          decryptToken(hostRow.google_access_token),
          decryptToken(hostRow.google_refresh_token),
          booking.google_event_id,
          { startTime: newStart.toISOString(), endTime: newEnd.toISOString(), timezone: hostTimezone },
        );
      }
    } catch (calErr) {
      console.error("Reschedule calendar patch error (non-fatal):", calErr.message);
    }
```

- [ ] **Step 4: Run — expect PASS** (both)

- [ ] **Step 5: Commit**

```bash
git add server/controllers/bookingController.js server/tests/unit/rescheduleBooking.test.js
git commit -m "feat(reschedule): gate by flag, patch calendar, count guest reschedules"
```

---

## Phase 4 — Reschedule fee (charging, default ₹0)

### Task 10: Migration — vendor reschedule fee

**Files:**
- Create: `server/migrations/v3.4_reschedule_fee.sql`

- [ ] **Step 1: Write**

```sql
-- v3.4_reschedule_fee.sql — per-vendor reschedule fee (0 or 10), platform-kept
alter table profiles add column if not exists reschedule_fee integer not null default 0;
```

- [ ] **Step 2: Apply in Supabase**; verify column.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.4_reschedule_fee.sql
git commit -m "feat(db): v3.4 profiles.reschedule_fee (default 0)"
```

---

### Task 11: `rescheduleFeeEntry` journal template

**Files:**
- Modify: `server/services/ledger/journalTemplates.js`
- Test: `server/tests/unit/rescheduleFeeEntry.test.js`

- [ ] **Step 1: Write the failing test**

```js
const { rescheduleFeeEntry } = require('../../services/ledger/journalTemplates');

test('₹10 fee → balanced, platform revenue + GST, no vendor payable', () => {
  const { lines } = rescheduleFeeEntry({ booking_id: 'b1', host_id: 'h1', fee: 10, gstRate: 0.18 });
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  expect(Math.round(debit * 100)).toBe(Math.round(credit * 100)); // balanced
  // no vendor payable line (account 2000)
  expect(lines.find((l) => l.account_code === '2000')).toBeUndefined();
  // revenue posted to platform fee revenue (4000)
  expect(lines.find((l) => l.account_code === '4000' && l.credit > 0)).toBeTruthy();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd server && npx jest tests/unit/rescheduleFeeEntry.test.js`

- [ ] **Step 3: Implement** — add to `journalTemplates.js` and export:

```js
/** RESCHEDULE_FEE — platform keeps the fee; platform bears the gateway charge. */
function rescheduleFeeEntry({ booking_id, host_id, fee, gstRate = 0.18, razorpay_fee = 0, razorpay_tax = 0 }) {
  const tags = { vendor_id: host_id, order_item_id: booking_id };
  const gross = round2(fee);
  // Fee is GST-inclusive: revenue = gross / (1+gstRate); gst = remainder.
  const net = round2(gross / (1 + gstRate));
  const gst = round2(gross - net);
  const gatewayTotal = round2(Number(razorpay_fee || 0) + Number(razorpay_tax || 0));
  const lines = [
    line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit', gross, tags),
    line(ACCOUNTS.PLATFORM_FEE_REVENUE, 'credit', net, tags),
  ];
  if (gst > 0) lines.push(line(ACCOUNTS.GST_PAYABLE, 'credit', gst, tags));
  if (gatewayTotal > 0) {
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'debit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', gatewayTotal, tags));
  }
  return { description: `Reschedule fee — booking ${booking_id}`, lines };
}
```
Add `rescheduleFeeEntry,` to `module.exports`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server/services/ledger/journalTemplates.js server/tests/unit/rescheduleFeeEntry.test.js
git commit -m "feat(ledger): RESCHEDULE_FEE journal template (platform revenue)"
```

---

### Task 12: Fee order endpoint + fee enforcement in reschedule

**Files:**
- Modify: `server/controllers/paymentController.js` (new `createRescheduleFeeOrder`)
- Modify: `server/routes/paymentRoutes.js` (route)
- Modify: `server/controllers/bookingController.js` (`rescheduleBooking` fee branch + ledger post)
- Test: `server/tests/unit/rescheduleFee.test.js`

- [ ] **Step 1: Write the failing test (fee enforcement in reschedule)**

```js
jest.mock('../../config/google', () => ({ updateCalendarEvent: jest.fn().mockResolvedValue({}), createCalendarEvent: jest.fn() }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decryptToken: (v) => v, decrypt: (v) => v }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
const postSafe = jest.fn().mockResolvedValue({});
jest.mock('../../services/ledger/postingService', () => ({ postSafe: (...a) => postSafe(...a) }));
const verifySignature = jest.fn().mockReturnValue(true);
jest.mock('../../utils/razorpaySignature', () => ({ verifySignature: (...a) => verifySignature(...a) }));

const featureFlags = require('../../services/featureFlags');
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
const { rescheduleBooking } = require('../../controllers/bookingController');
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

const future = '2099-01-01T05:00:00.000Z';
const mk = (count, fee) => ({
  id: 'b1', host_id: 'h1', guest_id: 'g1', status: 'confirmed', reschedule_count: count,
  scheduled_at: '2098-12-01T05:00:00.000Z', services: { duration: 30, grace_period_minutes: 10 },
  google_event_id: null,
  'profiles!bookings_host_id_fkey': { id: 'h1', reschedule_fee: fee },
});
const wire = (b) => mockFrom.mockImplementation(() => {
  const c = { select: jest.fn(() => c), eq: jest.fn(() => c), neq: jest.fn(() => c), gte: jest.fn(() => c),
    lte: jest.fn(() => c), order: jest.fn(() => c), update: jest.fn(() => c),
    single: jest.fn().mockResolvedValue({ data: b, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: { timezone: 'Asia/Kolkata', buffer_minutes: 0 } }) };
  return c;
});

beforeEach(() => { jest.clearAllMocks(); featureFlags.isFeatureEnabled.mockResolvedValue(true); });

test('1st guest reschedule is free even if vendor fee=10', async () => {
  wire(mk(0, 10));
  const r = res();
  await rescheduleBooking({ params: { id: 'b1' }, user: { id: 'g1' }, body: { scheduled_at: future } }, r);
  expect(r.status).not.toHaveBeenCalledWith(402);
  expect(postSafe).not.toHaveBeenCalled();
});

test('2nd reschedule with fee=10 and no payment → 402', async () => {
  wire(mk(1, 10));
  const r = res();
  await rescheduleBooking({ params: { id: 'b1' }, user: { id: 'g1' }, body: { scheduled_at: future } }, r);
  expect(r.status).toHaveBeenCalledWith(402);
});

test('2nd reschedule with fee=10 + valid payment → posts ledger', async () => {
  wire(mk(1, 10));
  const r = res();
  await rescheduleBooking({ params: { id: 'b1' }, user: { id: 'g1' },
    body: { scheduled_at: future, fee_payment_id: 'p', fee_order_id: 'o', fee_signature: 's' } }, r);
  expect(verifySignature).toHaveBeenCalled();
  expect(postSafe).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'RESCHEDULE_FEE' }));
});

test('2nd reschedule but reschedule_fee flag off → free', async () => {
  featureFlags.isFeatureEnabled.mockImplementation((k) => Promise.resolve(k !== 'reschedule_fee'));
  wire(mk(1, 10));
  const r = res();
  await rescheduleBooking({ params: { id: 'b1' }, user: { id: 'g1' }, body: { scheduled_at: future } }, r);
  expect(r.status).not.toHaveBeenCalledWith(402);
});
```

> If `verifySignature` lives inline in `paymentController.js` rather than `utils/razorpaySignature`, extract it to `server/utils/razorpaySignature.js` first (pure function: `verifySignature(orderId, paymentId, signature)` using `RAZORPAY_KEY_SECRET` HMAC) and import it in both controllers, so the reschedule path can reuse + tests can mock it. Do that extraction as Step 0 of this task and commit separately.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd server && npx jest tests/unit/rescheduleFee.test.js`

- [ ] **Step 3: Implement fee branch** in `rescheduleBooking` — after `isGuestReschedule` is set and BEFORE the booking update:

```js
    const verifySignature = require("../utils/razorpaySignature").verifySignature;
    let feeChargedAmount = 0;
    if (isGuestReschedule) {
      const hostRow = booking["profiles!bookings_host_id_fkey"] || {};
      const vendorFee = Number(hostRow.reschedule_fee) || 0;
      const count = Number(booking.reschedule_count) || 0;
      const feeFlagOn = await featureFlags.isFeatureEnabled('reschedule_fee');
      const feeApplies = count >= 1 && feeFlagOn && vendorFee > 0;
      if (feeApplies) {
        const { fee_payment_id, fee_order_id, fee_signature } = req.body;
        if (!fee_payment_id || !fee_order_id || !fee_signature ||
            !verifySignature(fee_order_id, fee_payment_id, fee_signature)) {
          return res.status(402).json({ message: 'Reschedule fee payment required', fee: vendorFee });
        }
        feeChargedAmount = vendorFee;
      }
    }
```

- [ ] **Step 4: Post ledger** — after the calendar-patch block (Task 9d), when a fee was charged:

```js
    if (feeChargedAmount > 0) {
      try {
        const { rescheduleFeeEntry } = require("../services/ledger/journalTemplates");
        const { postSafe } = require("../services/ledger/postingService");
        const newCount = (Number(booking.reschedule_count) || 0) + 1;
        await postSafe({
          sourceType: 'RESCHEDULE_FEE',
          sourceId: `${booking.id}:${newCount}`,
          journalDate: new Date().toISOString().slice(0, 10),
          template: rescheduleFeeEntry({ booking_id: booking.id, host_id: booking.host_id, fee: feeChargedAmount, gstRate: 0.18 }),
        });
      } catch (ledgerErr) {
        console.error("Reschedule fee ledger error (non-fatal):", ledgerErr.message);
      }
    }
```

- [ ] **Step 5: Add the fee-order endpoint** in `paymentController.js`:

```js
// ── POST /api/payment/reschedule-fee/create-order ────────────
const createRescheduleFeeOrder = async (req, res) => {
  try {
    const { booking_id } = req.body;
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, guest_id, reschedule_count, profiles!bookings_host_id_fkey(reschedule_fee)")
      .eq("id", booking_id).single();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user?.id !== booking.guest_id) return res.status(403).json({ message: "Not authorized" });

    const fee = Number(booking["profiles!bookings_host_id_fkey"]?.reschedule_fee) || 0;
    if (fee <= 0 || (Number(booking.reschedule_count) || 0) < 1) {
      return res.status(400).json({ message: "No reschedule fee due", fee: 0 });
    }
    const order = await razorpay.orders.create({
      amount: Math.round(fee * 100), currency: "INR",
      receipt: `rsf_${booking_id.slice(0, 20)}`,
      notes: { booking_id, kind: "reschedule_fee" },
    });
    res.json({ razorpay_order_id: order.id, amount: order.amount, currency: order.currency, fee });
  } catch (e) {
    res.status(500).json({ message: "Could not start reschedule fee payment" });
  }
};
```
Export it (`module.exports = { ..., createRescheduleFeeOrder }`).

- [ ] **Step 6: Route** in `server/routes/paymentRoutes.js` (protected):

```js
router.post('/reschedule-fee/create-order', protect, createRescheduleFeeOrder);
```
(Import `createRescheduleFeeOrder` + ensure `protect` is the auth middleware used by other guest payment routes.)

- [ ] **Step 7: Run — expect PASS** (4 tests)

- [ ] **Step 8: Commit**

```bash
git add server/controllers/paymentController.js server/routes/paymentRoutes.js server/controllers/bookingController.js server/utils/razorpaySignature.js server/tests/unit/rescheduleFee.test.js
git commit -m "feat(reschedule): first-free fee, Razorpay charge, ledger post"
```

---

### Task 13: Vendor reschedule-fee toggle (settings)

**Files:**
- Modify: `client/src/pages/ProfileSetup.jsx`
- Test: extend `client/src/tests/ProfileSetup.test.jsx` (or add a focused test)

- [ ] **Step 1: Add a fee control** to the vendor settings form. Bind to the profile form state (the page already loads the profile via `getMe`/`updateProfile`). Add a labeled select:

```jsx
<div>
  <label className="block text-sm font-medium mb-1">Guest reschedule fee</label>
  <select
    className="fb-input"
    value={form.reschedule_fee ?? 0}
    onChange={(e) => setForm({ ...form, reschedule_fee: Number(e.target.value) })}
  >
    <option value={0}>Free (₹0)</option>
    <option value={10}>₹10 per reschedule (from the 2nd)</option>
  </select>
  <p className="text-xs text-gray-400 mt-1">The platform keeps this fee. The guest's first reschedule is always free.</p>
</div>
```
Ensure `reschedule_fee` is included in the payload sent to `updateProfile` on save (it flows through the existing `form` object).

- [ ] **Step 2: Test** — assert the select renders and a change is reflected in the save payload. Mirror the existing ProfileSetup test's render+mock setup; add:

```jsx
// after rendering the settings form with a mocked profile { reschedule_fee: 0 }
fireEvent.change(screen.getByLabelText(/Guest reschedule fee/i), { target: { value: '10' } });
// trigger save, assert updateProfile called with reschedule_fee: 10
```

- [ ] **Step 3: Run — expect PASS**

Run: `cd client && npx vitest run src/tests/ProfileSetup.test.jsx`

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ProfileSetup.jsx client/src/tests/ProfileSetup.test.jsx
git commit -m "feat(vendor): reschedule fee toggle in settings"
```

---

### Task 14: Admin abuse signal (high reschedule count)

**Files:**
- Modify: `server/controllers/adminController.js` (`getAllBookings` select includes `reschedule_count`)
- Modify: `client/src/pages/admin/AdminBookings.jsx` (badge when count ≥ threshold)

- [ ] **Step 1: Server** — ensure the admin bookings query selects `reschedule_count` (add to the existing `.select(...)` column list in `getAllBookings`).

- [ ] **Step 2: Client** — add a constant and a badge in the booking row:

```jsx
const RESCHEDULE_ALERT_THRESHOLD = 3;
// …in the row, near the status cell:
{Number(b.reschedule_count) >= RESCHEDULE_ALERT_THRESHOLD && (
  <span title={`${b.reschedule_count} reschedules`}
    className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
    ⚠ {b.reschedule_count}× resched
  </span>
)}
```

- [ ] **Step 3: Manual verify** — a booking with `reschedule_count >= 3` shows the badge in `/admin/bookings`.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/adminController.js client/src/pages/admin/AdminBookings.jsx
git commit -m "feat(admin): flag bookings with high reschedule count"
```

---

## Phase 5 — Guest frontend (reschedule + review + rebook)

### Task 15: Shared Modal overlay

**Files:**
- Create: `client/src/components/booking/Modal.jsx`
- Test: `client/src/tests/Modal.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Modal from '../components/booking/Modal';

test('renders children and closes on backdrop + ESC', () => {
  const onClose = vi.fn();
  render(<Modal open title="Hi" onClose={onClose}><p>body</p></Modal>);
  expect(screen.getByText('body')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('modal-backdrop'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

test('renders nothing when closed', () => {
  const { container } = render(<Modal open={false} onClose={() => {}}><p>x</p></Modal>);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd client && npx vitest run src/tests/Modal.test.jsx`

- [ ] **Step 3: Implement**

```jsx
// client/src/components/booking/Modal.jsx
import { useEffect } from 'react';

export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div data-testid="modal-backdrop" className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto">
        {title && <h2 className="text-lg font-bold mb-3">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add client/src/components/booking/Modal.jsx client/src/tests/Modal.test.jsx
git commit -m "feat(ui): shared booking Modal overlay"
```

---

### Task 16: RescheduleModal (slot picker + fee branch)

**Files:**
- Create: `client/src/components/booking/RescheduleModal.jsx`
- Test: `client/src/tests/RescheduleModal.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({
  getAvailableSlots: vi.fn(), rescheduleBooking: vi.fn(), createRescheduleFeeOrder: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
import { getAvailableSlots, rescheduleBooking } from '../services/api';
import RescheduleModal from '../components/booking/RescheduleModal';

const booking = { id: 'b1', host_id: 'h1', service_id: 's1', scheduled_at: '2099-01-01T05:00:00.000Z',
  reschedule_count: 0, services: { id: 's1', duration: 30 },
  'profiles!bookings_host_id_fkey': { reschedule_fee: 0 } };

beforeEach(() => vi.clearAllMocks());

test('free path: pick slot → calls rescheduleBooking', async () => {
  getAvailableSlots.mockResolvedValue({ data: { slots: ['2099-01-02T06:00:00.000Z'] } });
  rescheduleBooking.mockResolvedValue({ data: {} });
  const onDone = vi.fn();
  render(<RescheduleModal open booking={booking} onClose={() => {}} onDone={onDone} />);
  fireEvent.change(screen.getByTestId('resched-date'), { target: { value: '2099-01-02' } });
  await waitFor(() => screen.getByRole('button', { name: /06:00/ }));
  fireEvent.click(screen.getByRole('button', { name: /06:00/ }));
  fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
  await waitFor(() => expect(rescheduleBooking).toHaveBeenCalledWith('b1', { scheduled_at: '2099-01-02T06:00:00.000Z' }));
  expect(onDone).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd client && npx vitest run src/tests/RescheduleModal.test.jsx`

- [ ] **Step 3: Implement**

```jsx
// client/src/components/booking/RescheduleModal.jsx
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { getAvailableSlots, rescheduleBooking, createRescheduleFeeOrder } from '../services/api';
import toast from 'react-hot-toast';

const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export default function RescheduleModal({ open, booking, onClose, onDone }) {
  const host = booking['profiles!bookings_host_id_fkey'] || booking.profiles || {};
  const svc = booking.services || {};
  const count = Number(booking.reschedule_count) || 0;
  const vendorFee = Number(host.reschedule_fee) || 0;
  const feeDue = count >= 1 ? vendorFee : 0; // first reschedule free; server is authoritative

  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    setSlots(null); setPicked(null);
    getAvailableSlots(booking.host_id, svc.id || booking.service_id, date)
      .then(({ data }) => setSlots(Array.isArray(data?.slots) ? data.slots : []))
      .catch(() => setSlots([]));
  }, [date]);

  const confirm = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      let feeRefs = {};
      if (feeDue > 0) {
        feeRefs = await payFee(); // throws/cancels if not completed
      }
      await rescheduleBooking(booking.id, { scheduled_at: picked, ...feeRefs });
      toast.success('Rescheduled');
      onDone?.(picked);
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error('That slot was just taken — pick another');
        getAvailableSlots(booking.host_id, svc.id || booking.service_id, date)
          .then(({ data }) => setSlots(Array.isArray(data?.slots) ? data.slots : []));
      } else if (err?.message !== 'cancelled') {
        toast.error(err?.response?.data?.message || 'Could not reschedule');
      }
    } finally {
      setBusy(false);
    }
  };

  // Razorpay checkout for the reschedule fee. Resolves with payment refs.
  const payFee = () => new Promise(async (resolve, reject) => {
    try {
      const { data } = await createRescheduleFeeOrder(booking.id);
      const rzp = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: data.razorpay_order_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Reschedule fee',
        handler: (r) => resolve({
          fee_order_id: data.razorpay_order_id,
          fee_payment_id: r.razorpay_payment_id,
          fee_signature: r.razorpay_signature,
        }),
        modal: { ondismiss: () => reject(new Error('cancelled')) },
      });
      rzp.open();
    } catch (e) { reject(e); }
  });

  return (
    <Modal open={open} title="Reschedule booking" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-3">
        Currently: {new Date(booking.scheduled_at).toLocaleString('en-IN')}
        {feeDue > 0 && <> · <span className="text-[#FE5100] font-medium">₹{feeDue} fee applies</span></>}
        {count === 0 && vendorFee > 0 && <> · <span className="text-green-600">first reschedule free</span></>}
      </p>
      <label className="block text-sm font-medium mb-1">New date</label>
      <input data-testid="resched-date" type="date" className="fb-input mb-3"
        value={date} min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setDate(e.target.value)} />
      {date && (
        slots === null ? <p className="text-sm text-gray-400">Loading slots…</p>
        : slots.length === 0 ? <p className="text-sm text-gray-400">No slots — try another date.</p>
        : <div className="grid grid-cols-3 gap-2 mb-4">
            {slots.map((s) => (
              <button key={s} onClick={() => setPicked(s)}
                className={`text-sm py-2 rounded-lg border ${picked === s ? 'bg-[#FE5100] text-white border-[#FE5100]' : 'border-gray-200'}`}>
                {fmtTime(s)}
              </button>
            ))}
          </div>
      )}
      <button onClick={confirm} disabled={!picked || busy}
        className="w-full bg-[#FE5100] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
        {busy ? 'Working…' : feeDue > 0 ? `Pay ₹${feeDue} & Confirm` : 'Confirm reschedule'}
      </button>
    </Modal>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add client/src/components/booking/RescheduleModal.jsx client/src/tests/RescheduleModal.test.jsx
git commit -m "feat(ui): RescheduleModal with slot picker + fee branch"
```

---

### Task 17: ReviewModal

**Files:**
- Create: `client/src/components/booking/ReviewModal.jsx`
- Test: `client/src/tests/ReviewModal.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({ createReview: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
import { createReview } from '../services/api';
import ReviewModal from '../components/booking/ReviewModal';

beforeEach(() => vi.clearAllMocks());

test('select stars + submit calls createReview', async () => {
  createReview.mockResolvedValue({ data: { id: 'r1', rating: 4 } });
  const onDone = vi.fn();
  render(<ReviewModal open booking={{ id: 'b1' }} onClose={() => {}} onDone={onDone} />);
  fireEvent.click(screen.getByRole('button', { name: /rate 4/i }));
  fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
  await waitFor(() => expect(createReview).toHaveBeenCalledWith({ booking_id: 'b1', rating: 4, comment: '' }));
  expect(onDone).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd client && npx vitest run src/tests/ReviewModal.test.jsx`

- [ ] **Step 3: Implement**

```jsx
// client/src/components/booking/ReviewModal.jsx
import { useState } from 'react';
import Modal from './Modal';
import { createReview } from '../services/api';
import toast from 'react-hot-toast';

export default function ReviewModal({ open, booking, onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (rating < 1) { toast.error('Pick a rating'); return; }
    setBusy(true);
    try {
      const { data } = await createReview({ booking_id: booking.id, rating, comment });
      toast.success('Thanks for the review!');
      onDone?.(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit review');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Leave a review" onClose={onClose}>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} aria-label={`rate ${n}`} onClick={() => setRating(n)}
            className={`text-2xl ${n <= rating ? 'text-[#FE5100]' : 'text-gray-300'}`}>★</button>
        ))}
      </div>
      <textarea className="fb-input mb-4" rows={3} placeholder="Optional comment"
        value={comment} onChange={(e) => setComment(e.target.value)} />
      <button onClick={submit} disabled={busy}
        className="w-full bg-[#FE5100] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
        {busy ? 'Submitting…' : 'Submit review'}
      </button>
    </Modal>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add client/src/components/booking/ReviewModal.jsx client/src/tests/ReviewModal.test.jsx
git commit -m "feat(ui): ReviewModal star rating"
```

---

### Task 18: Wire CustomerBookings (buttons + review state + rebook + flag)

**Files:**
- Modify: `client/src/pages/CustomerBookings.jsx`
- Modify: `client/src/services/api.js` (already has `rescheduleBooking`, `getBookingReview` — confirm both exported)
- Test: `client/src/tests/CustomerBookings.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({
  getGuestBookings: vi.fn(), cancelBooking: vi.fn(), getBookingReview: vi.fn(),
}));
vi.mock('../hooks/useFeatureFlags', () => ({ default: () => ({ on: () => true }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Sam' } }) }));
import { getGuestBookings, getBookingReview } from '../services/api';
import CustomerBookings from '../pages/CustomerBookings';

const upcoming = { id: 'b1', status: 'confirmed', scheduled_at: '2099-01-01T05:00:00.000Z',
  services: { title: 'Coaching', slug: 'coaching' }, 'profiles!bookings_host_id_fkey': { name: 'Pat', username: 'pat' } };
const done = { id: 'b2', status: 'completed', scheduled_at: '2000-01-01T05:00:00.000Z',
  services: { title: 'Old', slug: 'old' }, 'profiles!bookings_host_id_fkey': { name: 'Pat', username: 'pat' } };

const renderPage = () => render(<MemoryRouter><CustomerBookings /></MemoryRouter>);
beforeEach(() => vi.clearAllMocks());

test('upcoming shows Reschedule; completed shows Leave review + Rebook', async () => {
  getGuestBookings.mockResolvedValue({ data: [upcoming, done] });
  getBookingReview.mockResolvedValue({ data: null });
  renderPage();
  await waitFor(() => screen.getByText('Coaching'));
  expect(screen.getByRole('button', { name: /Reschedule/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Leave review/i })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /Rebook/i }).length).toBeGreaterThan(0);
});

test('reschedule hidden when flag off', async () => {
  vi.doMock('../hooks/useFeatureFlags', () => ({ default: () => ({ on: () => false }) }));
  getGuestBookings.mockResolvedValue({ data: [upcoming] });
  getBookingReview.mockResolvedValue({ data: null });
  renderPage();
  await waitFor(() => screen.getByText('Coaching'));
  expect(screen.queryByRole('button', { name: /Reschedule/i })).toBeNull();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd client && npx vitest run src/tests/CustomerBookings.test.jsx`

- [ ] **Step 3: Implement** — modify `client/src/pages/CustomerBookings.jsx`:

(a) Imports:
```jsx
import { getGuestBookings, cancelBooking, getBookingReview } from "../services/api";
import useFeatureFlags from "../hooks/useFeatureFlags";
import RescheduleModal from "../components/booking/RescheduleModal";
import ReviewModal from "../components/booking/ReviewModal";
```

(b) In the component, add state + review fetch + flag:
```jsx
  const { on } = useFeatureFlags();
  const [reviews, setReviews] = useState({});       // bookingId -> review|null
  const [reschedFor, setReschedFor] = useState(null);
  const [reviewFor, setReviewFor] = useState(null);
```
In `load()`’s `.then`, after setting bookings, fetch review state for completed ones:
```jsx
      const completed = (Array.isArray(data) ? data : []).filter((b) => b.status === 'completed');
      Promise.all(completed.map((b) =>
        getBookingReview(b.id).then(({ data: r }) => [b.id, r]).catch(() => [b.id, null])
      )).then((pairs) => setReviews(Object.fromEntries(pairs)));
```

(c) In `Card`, add the new buttons. Reschedule (upcoming, flag on):
```jsx
            {isUpcoming && on('reschedule') && (
              <button onClick={() => setReschedFor(b)}
                className="text-sm font-medium text-[#FE5100] hover:underline">Reschedule</button>
            )}
```
Completed → review + rebook:
```jsx
            {b.status === 'completed' && (
              reviews[b.id]
                ? <span className="text-sm text-gray-500">Your review {'★'.repeat(reviews[b.id].rating)}</span>
                : <button onClick={() => setReviewFor(b)} className="text-sm font-medium text-[#FE5100] hover:underline">Leave review</button>
            )}
```
Rebook (completed or cancelled), using the host username + service slug:
```jsx
            {(b.status === 'completed' || b.status === 'cancelled') && (host.username && svc.slug) && (
              <Link to={`/${host.username}/booking/${svc.slug}`} className="text-sm text-gray-600 hover:underline">Rebook</Link>
            )}
```

(d) Render the modals once (after the list), patching the list on done:
```jsx
      {reschedFor && (
        <RescheduleModal open booking={reschedFor} onClose={() => setReschedFor(null)}
          onDone={(newWhen) => {
            setBookings((bs) => bs.map((x) => x.id === reschedFor.id ? { ...x, scheduled_at: newWhen, reschedule_count: (x.reschedule_count || 0) + 1 } : x));
            setReschedFor(null);
          }} />
      )}
      {reviewFor && (
        <ReviewModal open booking={reviewFor} onClose={() => setReviewFor(null)}
          onDone={(review) => { setReviews((m) => ({ ...m, [reviewFor.id]: review })); setReviewFor(null); }} />
      )}
```

- [ ] **Step 4: Run — expect PASS** (both)

- [ ] **Step 5: Manual smoke** (dev servers up):
  - Log in as a guest with bookings → My Bookings.
  - Upcoming card shows Reschedule → opens modal → pick date/slot → confirm → time updates.
  - Toggle `reschedule` OFF in `/admin/features` → reload → Reschedule button gone.
  - Completed card → Leave review → submit → shows stars.
  - Completed/cancelled card → Rebook → lands on booking page.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/CustomerBookings.jsx client/src/tests/CustomerBookings.test.jsx
git commit -m "feat(my-bookings): reschedule, review, rebook actions (flag-gated)"
```

---

## Final verification

- [ ] `cd server && npm test` — all green.
- [ ] `cd client && npm test` — all green.
- [ ] `cd client && npm run build` — builds clean.
- [ ] Confirm all 3 migrations applied in Supabase.
- [ ] Re-run the Task 18 manual smoke end-to-end with `reschedule_fee` flag ON + a vendor set to ₹10: 1st reschedule free, 2nd opens Razorpay checkout, ledger entry appears in `/admin/finance/journal`.
- [ ] Update `docs/current-state.md` + `docs/current-work.md` (note the feature, the 3 migrations, the two feature flags).

---

## Self-review (spec coverage)

- Feature flags table/helper/admin API/public read → Tasks 1–3. ✅
- Admin "Feature Status" top-level nav + page → Task 5. ✅
- `reschedule` flag disables all reschedule (guest+vendor), 403 → Task 9 (guard runs for every caller). ✅
- Calendar event id stored + moved on reschedule → Tasks 6–9. ✅
- Fee: platform-kept, first-free, flat, non-refundable (no refund code), unlimited, count tracked → Tasks 10–12. ✅
- `reschedule_fee` flag off ⇒ free → Task 12 (feeFlagOn check + test). ✅
- Vendor ₹0/₹10 toggle → Task 13. ✅
- Admin abuse signal (count ≥ 3) → Task 14. ✅
- Review (completed-only) + rebook → Tasks 17–18. ✅
- Tests Jest + Vitest across all → each task. ✅

**Deviations from spec (intentional):** perm reuses `settings.manage` instead of a new `features.manage` (avoids RBAC-catalog migration); ledger reuses `PLATFORM_FEE_REVENUE` (4000) rather than a dedicated reschedule-fee account (avoids chart_of_accounts changes; distinguished by `sourceType=RESCHEDULE_FEE` + description).

**Open items resolved here:** migration numbers v3.2/3.3/3.4; vendor toggle in `ProfileSetup`; GST treatment = fee is GST-inclusive at 18%; admin flag = amber badge in `AdminBookings`; nav icon `zap`.
