# Admin Payout Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a working queue to approve, reject, and mark-paid vendor payout requests, with the paid event posting a balanced journal entry that relieves Vendor Payables.

**Architecture:** Pragmatic manual workflow (`pending → approved → paid` | `pending → rejected`). Money moves manually off-platform; admin records a payment reference at mark-paid. Mark-paid posts a `SETTLEMENT` ledger entry (debit Vendor Payables 2000 → credit Bank 1000) via the existing `post()` RPC path, idempotent on `(source_type, source_id)`. New admin controller + routes (gated by existing `payouts.*` perms) + a new `AdminPayouts` page replacing the empty `AdminEarnings` shell.

**Tech Stack:** Express 4, Supabase (`supabaseAdmin` service-role), Jest (server), React 18 + Vite + Vitest (client), Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-15-admin-payout-approval-design.md`

**Branch:** `feat/admin-payout-approval` (already created; spec committed there).

> ⚠️ **OneDrive hazard:** this repo lives under OneDrive, which has twice silently reverted the working tree / switched HEAD mid-session. After EVERY task's commit, run `git rev-parse --abbrev-ref HEAD` and confirm you are still on `feat/admin-payout-approval`. If HEAD moved, `git checkout feat/admin-payout-approval` before continuing.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `server/migrations/v3.8_payout_approval.sql` | Extend `payout_requests` (status `paid`, audit cols) | Create + apply live |
| `server/services/ledger/journalTemplates.js` | Add `payoutEntry` builder | Modify |
| `server/controllers/vendorController.js` | Count `paid` in withdrawn/claimed balance | Modify |
| `server/controllers/payoutAdminController.js` | Admin list/approve/reject/pay handlers | Create |
| `server/routes/adminRoutes.js` | Mount payout admin routes | Modify |
| `server/tests/unit/payoutEntry.test.js` | Ledger template test | Create |
| `server/tests/unit/payoutBalance.test.js` | Balance-includes-paid test | Create |
| `server/tests/unit/payoutAdminController.test.js` | Controller behavior tests | Create |
| `client/src/services/api.js` | 4 admin payout API wrappers | Modify |
| `client/src/pages/admin/AdminPayouts.jsx` | Admin payout queue UI | Create |
| `client/src/App.jsx` | Route `/admin/finance/payouts` | Modify |
| `client/src/components/common/AdminLayout.jsx` | Sidebar "Payouts" + breadcrumb label | Modify |
| `client/src/pages/admin/SuperDashboard.jsx` | Repoint earnings links → payouts | Modify |

---

## Task 1: DB migration — extend `payout_requests`

**Files:**
- Create: `server/migrations/v3.8_payout_approval.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- v3.8_payout_approval.sql — admin payout approval workflow.
-- Adds 'paid' status + approval/payment audit columns to payout_requests.
-- Idempotent (IF EXISTS / IF NOT EXISTS). Reject reason reuses admin_note.

ALTER TABLE payout_requests DROP CONSTRAINT IF EXISTS payout_requests_status_check;
ALTER TABLE payout_requests ADD CONSTRAINT payout_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'paid'));

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS approved_by       UUID,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by           UUID,
  ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at       TIMESTAMPTZ;
```

- [ ] **Step 2: Apply to live Supabase**

Apply via the Supabase MCP `apply_migration` tool (name `v3_8_payout_approval`, project `STAGING_PROJECT_REF`) with the SQL above. This is a LIVE schema change — additive only, safe on existing rows.

- [ ] **Step 3: Verify the schema landed**

Run this query via the Supabase MCP `execute_sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'payout_requests'
  AND column_name IN ('approved_by','approved_at','paid_by','paid_at','payment_reference','rejected_at')
ORDER BY column_name;
```

Expected: all 6 rows returned. Also confirm the CHECK now allows `paid`:

```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'payout_requests_status_check';
```

Expected: contains `'paid'`.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/v3.8_payout_approval.sql
git commit -m "feat(payouts): v3.8 migration — paid status + approval audit columns"
git rev-parse --abbrev-ref HEAD   # confirm still on feat/admin-payout-approval
```

---

## Task 2: Ledger template — `payoutEntry`

**Files:**
- Modify: `server/services/ledger/journalTemplates.js`
- Test: `server/tests/unit/payoutEntry.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/payoutEntry.test.js
'use strict';
const { payoutEntry } = require('../../services/ledger/journalTemplates');

test('payoutEntry debits Vendor Payables and credits Bank, balanced + vendor-tagged', () => {
  const t = payoutEntry({ host_id: 'host-1', amount: 500, reference: 'UTR123' });
  expect(t.description).toBe('Vendor payout UTR123');
  const debit = t.lines.find(l => l.account_code === '2000');
  const credit = t.lines.find(l => l.account_code === '1000');
  expect(debit).toMatchObject({ debit: 500, credit: 0, vendor_id: 'host-1' });
  expect(credit).toMatchObject({ debit: 0, credit: 500, vendor_id: 'host-1' });
  const sumD = t.lines.reduce((s, l) => s + l.debit, 0);
  const sumC = t.lines.reduce((s, l) => s + l.credit, 0);
  expect(sumD).toBe(sumC); // balanced
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/payoutEntry.test.js`
Expected: FAIL — `payoutEntry is not a function`.

- [ ] **Step 3: Add the template**

In `server/services/ledger/journalTemplates.js`, add this function after `bankTransferEntry` (before `rescheduleFeeEntry`):

```js
/** SETTLEMENT (vendor payout) — relieve Vendor Payables when cash is sent. */
function payoutEntry({ host_id, amount, reference }) {
  const tags = { vendor_id: host_id };
  return {
    description: `Vendor payout ${reference || ''}`.trim(),
    lines: [
      line(ACCOUNTS.VENDOR_PAYABLES, 'debit', amount, tags),
      line(ACCOUNTS.BANK, 'credit', amount, tags),
    ],
  };
}
```

Add `payoutEntry,` to the `module.exports` object.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/payoutEntry.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/ledger/journalTemplates.js server/tests/unit/payoutEntry.test.js
git commit -m "feat(payouts): payoutEntry ledger template (Vendor Payables -> Bank)"
git rev-parse --abbrev-ref HEAD
```

---

## Task 3: Balance counts `paid` as withdrawn

**Files:**
- Modify: `server/controllers/vendorController.js` (`getPayoutBalance` ~L80, `requestPayout` ~L143)
- Test: `server/tests/unit/payoutBalance.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/payoutBalance.test.js
'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
const { supabaseAdmin } = require('../../config/supabase');
const ctrl = require('../../controllers/vendorController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const chain = (result) => {
  const c = {};
  for (const m of ['select', 'eq', 'order']) c[m] = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  return c;
};

beforeEach(() => jest.clearAllMocks());

test('getPayoutBalance counts paid payouts as withdrawn (available not inflated)', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'bookings') return chain({ data: [{ vendor_amount: 1000 }] });
    if (t === 'payout_requests') return chain({ data: [
      { amount: 300, status: 'paid' },
      { amount: 100, status: 'approved' },
    ] });
    return chain({ data: [] });
  });
  const res = mockRes();
  await ctrl.getPayoutBalance({ user: { id: 'h1' } }, res);
  const body = res.json.mock.calls[0][0];
  // earned 1000 - paid 300 - approved 100 - pending 0 = 600
  expect(body.available).toBe(600);
  expect(body.totalWithdrawn).toBe(400); // approved + paid
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/payoutBalance.test.js`
Expected: FAIL — `available` is 700 and `totalWithdrawn` is 100 (paid not counted).

- [ ] **Step 3: Update `getPayoutBalance`**

In `server/controllers/vendorController.js`, change the `totalWithdrawn` filter to include `paid`:

```js
    const totalWithdrawn = (payouts || [])
      .filter(p => p.status === 'approved' || p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
```

(The `pendingPayout` line and `available = Math.max(0, totalEarned - totalWithdrawn - pendingPayout)` stay as-is — `available` now correctly subtracts pending + approved + paid.)

- [ ] **Step 4: Update `requestPayout`**

In the same file, change `alreadyClaimed` to include `paid`:

```js
    const alreadyClaimed = (payouts || [])
      .filter(p => p.status === 'approved' || p.status === 'pending' || p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/payoutBalance.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/vendorController.js server/tests/unit/payoutBalance.test.js
git commit -m "fix(payouts): count paid payouts as withdrawn in balance math"
git rev-parse --abbrev-ref HEAD
```

---

## Task 4: Admin payout controller

**Files:**
- Create: `server/controllers/payoutAdminController.js`
- Test: `server/tests/unit/payoutAdminController.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// server/tests/unit/payoutAdminController.test.js
'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
jest.mock('../../services/ledger/postingService', () => ({ post: jest.fn(() => Promise.resolve('entry-uuid')) }));

const { supabaseAdmin } = require('../../config/supabase');
const { audit } = require('../../services/auditService');
const { post } = require('../../services/ledger/postingService');
const ctrl = require('../../controllers/payoutAdminController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
// fetchPayout uses .select().eq().maybeSingle(); updates use .update().eq().eq().select().single()
const fetchChain = (row) => {
  const c = {};
  c.select = jest.fn(() => c); c.eq = jest.fn(() => c);
  c.maybeSingle = jest.fn(() => Promise.resolve({ data: row }));
  c.update = jest.fn(() => c);
  c.single = jest.fn(() => Promise.resolve({ data: { ...row, _updated: true }, error: null }));
  return c;
};
const admin = { id: 'adm1', email: 'a@x.com', role: 'finance' };
beforeEach(() => jest.clearAllMocks());

test('approve: pending -> approved, stamps approver, audits', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'pending', host_id: 'h1', amount: 500 }));
  const res = mockRes();
  await ctrl.approvePayout({ params: { id: 'p1' }, admin }, res);
  expect(res.json).toHaveBeenCalled();
  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'payout.approve' }));
});

test('approve: non-pending -> 409', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'approved', host_id: 'h1', amount: 500 }));
  const res = mockRes();
  await ctrl.approvePayout({ params: { id: 'p1' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(409);
});

test('reject: requires a reason', async () => {
  const res = mockRes();
  await ctrl.rejectPayout({ params: { id: 'p1' }, admin, body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('pay: requires a payment reference', async () => {
  const res = mockRes();
  await ctrl.markPayoutPaid({ params: { id: 'p1' }, admin, body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(post).not.toHaveBeenCalled();
});

test('pay: approved -> posts SETTLEMENT once then marks paid', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'approved', host_id: 'h1', amount: 500 }));
  const res = mockRes();
  await ctrl.markPayoutPaid({ params: { id: 'p1' }, admin, body: { payment_reference: 'UTR9' } }, res);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'SETTLEMENT', sourceId: 'p1', createdBy: 'adm1' }));
  expect(res.json).toHaveBeenCalled();
});

test('pay: non-approved -> 409, no ledger post', async () => {
  supabaseAdmin.from.mockReturnValue(fetchChain({ id: 'p1', status: 'pending', host_id: 'h1', amount: 500 }));
  const res = mockRes();
  await ctrl.markPayoutPaid({ params: { id: 'p1' }, admin, body: { payment_reference: 'UTR9' } }, res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(post).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/unit/payoutAdminController.test.js`
Expected: FAIL — cannot find module `payoutAdminController`.

- [ ] **Step 3: Write the controller**

```js
// server/controllers/payoutAdminController.js
'use strict';
const { safeError } = require('../utils/httpError');
const { supabaseAdmin } = require('../config/supabase');
const { audit } = require('../services/auditService');
const { post } = require('../services/ledger/postingService');
const { payoutEntry } = require('../services/ledger/journalTemplates');

const now = () => new Date().toISOString();

const fetchPayout = async (id) => {
  const { data } = await supabaseAdmin.from('payout_requests').select('*').eq('id', id).maybeSingle();
  return data;
};

// GET /admin/payouts?status=
const listPayouts = async (req, res) => {
  try {
    const { status } = req.query || {};
    let q = supabaseAdmin
      .from('payout_requests')
      .select('*, profiles:host_id(name, username, email)')
      .order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};

// POST /admin/payouts/:id/approve
const approvePayout = async (req, res) => {
  try {
    const p = await fetchPayout(req.params.id);
    if (!p) return res.status(404).json({ message: 'Payout request not found' });
    if (p.status !== 'pending') return res.status(409).json({ message: `Cannot approve a ${p.status} request` });
    const { data, error } = await supabaseAdmin.from('payout_requests')
      .update({ status: 'approved', approved_by: req.admin.id, approved_at: now(), updated_at: now() })
      .eq('id', p.id).eq('status', 'pending').select().single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'payout.approve', resource_type: 'payout_request', resource_id: p.id, before: { status: p.status }, after: { status: 'approved' } });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// POST /admin/payouts/:id/reject  { reason }
const rejectPayout = async (req, res) => {
  try {
    const reason = ((req.body && req.body.reason) || '').trim();
    if (!reason) return res.status(400).json({ message: 'A rejection reason is required' });
    const p = await fetchPayout(req.params.id);
    if (!p) return res.status(404).json({ message: 'Payout request not found' });
    if (p.status !== 'pending') return res.status(409).json({ message: `Cannot reject a ${p.status} request` });
    const { data, error } = await supabaseAdmin.from('payout_requests')
      .update({ status: 'rejected', admin_note: reason, rejected_at: now(), updated_at: now() })
      .eq('id', p.id).eq('status', 'pending').select().single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'payout.reject', resource_type: 'payout_request', resource_id: p.id, before: { status: p.status }, after: { status: 'rejected', reason } });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// POST /admin/payouts/:id/pay  { payment_reference }
const markPayoutPaid = async (req, res) => {
  try {
    const reference = ((req.body && req.body.payment_reference) || '').trim();
    if (!reference) return res.status(400).json({ message: 'A payment reference is required' });
    const p = await fetchPayout(req.params.id);
    if (!p) return res.status(404).json({ message: 'Payout request not found' });
    if (p.status !== 'approved') return res.status(409).json({ message: `Cannot pay a ${p.status} request` });

    // Post the ledger entry FIRST (throwing). If it fails, the row stays
    // approved and the admin can retry — idempotent on (SETTLEMENT, p.id).
    await post({
      sourceType: 'SETTLEMENT', sourceId: p.id,
      journalDate: now().slice(0, 10), createdBy: req.admin.id,
      template: payoutEntry({ host_id: p.host_id, amount: Number(p.amount), reference }),
    });

    const { data, error } = await supabaseAdmin.from('payout_requests')
      .update({ status: 'paid', payment_reference: reference, paid_by: req.admin.id, paid_at: now(), updated_at: now() })
      .eq('id', p.id).eq('status', 'approved').select().single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'payout.pay', resource_type: 'payout_request', resource_id: p.id, before: { status: p.status }, after: { status: 'paid', reference } });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

module.exports = { listPayouts, approvePayout, rejectPayout, markPayoutPaid };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/unit/payoutAdminController.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/payoutAdminController.js server/tests/unit/payoutAdminController.test.js
git commit -m "feat(payouts): admin payout controller (list/approve/reject/pay + ledger)"
git rev-parse --abbrev-ref HEAD
```

---

## Task 5: Mount admin payout routes

**Files:**
- Modify: `server/routes/adminRoutes.js`

- [ ] **Step 1: Add the routes**

In `server/routes/adminRoutes.js`, after the badges block (near the other feature route groups), add:

```js
// ── Payout approval ────────────────────────────────────────────
const payouts = require('../controllers/payoutAdminController');
router.get('/payouts',              requireAdmin('payouts.view'),    payouts.listPayouts);
router.post('/payouts/:id/approve', requireAdmin('payouts.approve'), payouts.approvePayout);
router.post('/payouts/:id/reject',  requireAdmin('payouts.approve'), payouts.rejectPayout);
router.post('/payouts/:id/pay',     requireAdmin('payouts.release'), payouts.markPayoutPaid);
```

- [ ] **Step 2: Verify the server boots (route wiring is valid)**

Run: `cd server && node -e "require('./routes/adminRoutes'); console.log('routes ok')"`
Expected: prints `routes ok` with no throw.

- [ ] **Step 3: Run the full server suite (nothing regressed)**

Run: `cd server && npm test`
Expected: all tests pass (previous count + the new payout tests).

- [ ] **Step 4: Commit**

```bash
git add server/routes/adminRoutes.js
git commit -m "feat(payouts): mount admin payout routes (payouts.view/approve/release)"
git rev-parse --abbrev-ref HEAD
```

---

## Task 6: Client API wrappers

**Files:**
- Modify: `client/src/services/api.js`

- [ ] **Step 1: Add the wrappers**

In `client/src/services/api.js`, after the admin finance wrappers (the `adminFinance*` block ~L137-140), add:

```js
// Admin — Payout approval
export const adminGetPayouts     = (status)         => API.get('/admin/payouts', { params: status ? { status } : {} });
export const adminApprovePayout  = (id)             => API.post(`/admin/payouts/${id}/approve`);
export const adminRejectPayout   = (id, reason)     => API.post(`/admin/payouts/${id}/reject`, { reason });
export const adminMarkPayoutPaid = (id, reference)  => API.post(`/admin/payouts/${id}/pay`, { payment_reference: reference });
```

- [ ] **Step 2: Verify the client still builds**

Run: `cd client && npm run build`
Expected: build succeeds (no import/syntax error).

- [ ] **Step 3: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(payouts): admin payout API client wrappers"
git rev-parse --abbrev-ref HEAD
```

---

## Task 7: AdminPayouts page

**Files:**
- Create: `client/src/pages/admin/AdminPayouts.jsx`
- Test: `client/src/tests/AdminPayouts.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/tests/AdminPayouts.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';
import AdminPayouts from '../pages/admin/AdminPayouts';

vi.mock('../services/api', () => ({
  adminGetPayouts: vi.fn(() => Promise.resolve({ data: [
    { id: 'p1', amount: 500, status: 'pending', created_at: '2026-06-15T10:00:00Z',
      profiles: { name: 'Asha', username: 'asha', email: 'a@x.com' } },
  ] })),
  adminApprovePayout: vi.fn(), adminRejectPayout: vi.fn(), adminMarkPayoutPaid: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));

beforeEach(() => vi.clearAllMocks());

test('renders a pending payout row with vendor + amount', async () => {
  render(<AdminPayouts />);
  await waitFor(() => expect(screen.getByText('Asha')).toBeInTheDocument());
  expect(screen.getByText(/500/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/tests/AdminPayouts.test.jsx`
Expected: FAIL — cannot resolve `../pages/admin/AdminPayouts`.

- [ ] **Step 3: Write the page**

```jsx
// client/src/pages/admin/AdminPayouts.jsx
import { useState, useEffect, useCallback } from 'react';
import { adminGetPayouts, adminApprovePayout, adminRejectPayout, adminMarkPayoutPaid } from '../../services/api';
import toast from 'react-hot-toast';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS = {
  pending:  'bg-amber-50 text-amber-700 ring-1 ring-amber-600/15',
  approved: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/15',
  paid:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15',
  rejected: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/15',
};
const TABS = ['pending', 'approved', 'paid', 'rejected', 'all'];

const Modal = ({ title, label, placeholder, confirmText, onClose, onConfirm }) => {
  const [val, setVal] = useState('');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">{title}</h3>
        <label className="block mb-3">
          <span className="text-[12px] text-gray-500">{label}</span>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
            className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FE5100]/30 focus:border-[#FE5100]" />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button disabled={!val.trim()} onClick={() => onConfirm(val.trim())}
            className="btn px-4 py-2 text-sm font-semibold bg-[#FE5100] text-white hover:bg-[#e54900] disabled:opacity-40">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

const AdminPayouts = () => {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { kind: 'reject'|'pay', id }

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await adminGetPayouts(tab); setRows(data || []); }
    catch { toast.error('Failed to load payouts'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, id, ...args) => {
    try { await fn(id, ...args); toast.success('Done'); load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Action failed'); }
  };

  return (
    <div className="max-w-[1100px]">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Payouts</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Approve, reject, and mark vendor payout requests as paid.</p>
      </div>

      <div className="flex gap-1.5 mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium capitalize transition-colors
              ${t === tab ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-white border border-gray-200/70 rounded-xl animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200/80 rounded-2xl py-16 text-center text-[13px] text-gray-400">No {tab === 'all' ? '' : tab} payout requests.</div>
      ) : (
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-400 text-left">
                <th className="px-4 py-2.5 font-semibold">Vendor</th>
                <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                <th className="px-4 py-2.5 font-semibold">Requested</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{r.profiles?.name || '—'}</p>
                    {r.profiles?.username && <p className="text-[11.5px] text-gray-400">@{r.profiles.username}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">{inr(r.amount)}</td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">{fmt(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS[r.status] || STATUS.pending}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {r.status === 'pending' && (
                        <>
                          <button onClick={() => act(adminApprovePayout, r.id)} className="btn px-2.5 py-1 text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700">Approve</button>
                          <button onClick={() => setModal({ kind: 'reject', id: r.id })} className="btn btn--outline px-2.5 py-1 text-[12px] font-medium text-rose-600 hover:bg-rose-50">Reject</button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <button onClick={() => setModal({ kind: 'pay', id: r.id })} className="btn px-2.5 py-1 text-[12px] font-medium bg-[#FE5100] text-white hover:bg-[#e54900]">Mark Paid</button>
                      )}
                      {r.status === 'paid' && <span className="text-[11.5px] text-gray-400 font-mono">{r.payment_reference || '—'}</span>}
                      {r.status === 'rejected' && <span className="text-[11.5px] text-gray-400 truncate max-w-[200px]" title={r.admin_note}>{r.admin_note || '—'}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.kind === 'reject' && (
        <Modal title="Reject payout request" label="Reason (shown to vendor)" placeholder="e.g. Bank details missing" confirmText="Reject"
          onClose={() => setModal(null)}
          onConfirm={(reason) => { setModal(null); act(adminRejectPayout, modal.id, reason); }} />
      )}
      {modal?.kind === 'pay' && (
        <Modal title="Mark payout as paid" label="Payment reference (UTR / txn id)" placeholder="e.g. UTR1234567890" confirmText="Mark Paid"
          onClose={() => setModal(null)}
          onConfirm={(ref) => { setModal(null); act(adminMarkPayoutPaid, modal.id, ref); }} />
      )}
    </div>
  );
};

export default AdminPayouts;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/tests/AdminPayouts.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/AdminPayouts.jsx client/src/tests/AdminPayouts.test.jsx
git commit -m "feat(payouts): AdminPayouts queue page (tabs, approve/reject/pay modals)"
git rev-parse --abbrev-ref HEAD
```

---

## Task 8: Route + nav — point Finance to Payouts

**Files:**
- Modify: `client/src/App.jsx` (lazy import + route ~L86, L241)
- Modify: `client/src/components/common/AdminLayout.jsx` (sidebar ~L149, PATH_LABELS)
- Modify: `client/src/pages/admin/SuperDashboard.jsx` (links ~L104, L166)

- [ ] **Step 1: Add the lazy import + route in App.jsx**

In `client/src/App.jsx`, add near the other admin lazy imports (alongside `AdminEarnings` ~L86):

```jsx
const AdminPayouts = lazy(() => import('./pages/admin/AdminPayouts'));
```

Replace the earnings route (~L241) with the payouts route:

```jsx
          <Route path="/admin/finance/payouts" element={<AdminWrapper><AdminPayouts /></AdminWrapper>} />
```

(Remove the `/admin/finance/earnings` Route line and the now-unused `AdminEarnings` lazy import. The empty `AdminEarnings.jsx` file may be left on disk; it is no longer routed.)

- [ ] **Step 2: Repoint the sidebar item in AdminLayout.jsx**

In `client/src/components/common/AdminLayout.jsx`, change the Provider Earnings nav item (~L149):

```jsx
    { label:'Payouts', icon:'wallet',  to:'/admin/finance/payouts', perm:'payouts.view' },
```

And add a breadcrumb label to `PATH_LABELS` (in the finance group, near `earnings:'Provider Earnings'`):

```jsx
  payouts:'Payouts',
```

- [ ] **Step 3: Repoint SuperDashboard links**

In `client/src/pages/admin/SuperDashboard.jsx`, change both `/admin/finance/earnings` occurrences (~L104, L166) to `/admin/finance/payouts`. Update the card title/desc at ~L104 to:

```jsx
          { title: 'Payouts', desc: 'Approve and release vendor payout requests', to: '/admin/finance/payouts', icon: 'dollar', color: 'text-[#FE5100] bg-orange-50' },
```

- [ ] **Step 4: Verify the client builds**

Run: `cd client && npm run build`
Expected: build succeeds, no unresolved `AdminEarnings` reference.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx client/src/components/common/AdminLayout.jsx client/src/pages/admin/SuperDashboard.jsx
git commit -m "feat(payouts): route /admin/finance/payouts + nav, retire empty earnings shell"
git rev-parse --abbrev-ref HEAD
```

---

## Task 9: Full verification + finish

- [ ] **Step 1: Run the full server suite**

Run: `cd server && npm test`
Expected: all green (includes payoutEntry, payoutBalance, payoutAdminController).

- [ ] **Step 2: Run the full client suite**

Run: `cd client && npm test`
Expected: all green (includes AdminPayouts).

- [ ] **Step 3: Manual smoke (requires admin login — cannot be automated)**

The admin UI is gated by `/hello-sloth` login (finance or super account). Preview tools cannot reach it without creds, so the implementer hands this to the user:
1. Log in at `/hello-sloth`, go to `/admin/finance/payouts`.
2. Create a test `payout_requests` row (vendor requests a payout, or insert one via SQL) → it appears under Pending.
3. Approve → moves to Approved tab.
4. Mark Paid with a reference → moves to Paid; verify a `SETTLEMENT` journal entry exists:
   ```sql
   SELECT source_type, source_id, description FROM journal_entries WHERE source_type = 'SETTLEMENT';
   ```
5. Confirm ledger still balances:
   ```sql
   SELECT SUM(debit) - SUM(credit) AS imbalance FROM journal_lines;  -- expect 0.00
   ```

- [ ] **Step 4: Finish the branch**

Invoke the `superpowers:finishing-a-development-branch` skill to choose merge / PR / cleanup. (Repo pattern: merge `--no-ff` to `main`, delete branch, push — but confirm with the user first.)

---

## Self-Review Notes

- **Spec coverage:** status model → Task 4; DB cols → Task 1; balance fix → Task 3; ledger relief → Tasks 2+4; server API + perms → Tasks 4+5; client api + page → Tasks 6+7; route/nav fix → Task 8; tests → each task + Task 9; out-of-scope items intentionally untouched. ✓
- **Source type:** uses `SETTLEMENT` (in the live CHECK), not `PAYOUT` (not in CHECK). Consistent across spec, Task 2 comment, Task 4 controller + test. ✓
- **Naming consistency:** `payoutEntry`, `listPayouts/approvePayout/rejectPayout/markPayoutPaid`, `adminGetPayouts/adminApprovePayout/adminRejectPayout/adminMarkPayoutPaid` — used identically in every task. ✓
- **Ledger ordering:** `post()` before status update in `markPayoutPaid`; failure leaves row `approved` for idempotent retry. ✓
