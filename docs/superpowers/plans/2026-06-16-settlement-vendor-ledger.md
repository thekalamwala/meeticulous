# Settlement Engine P2 — Accurate Vendor Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the vendor payout balance accurate by gating withdrawable money on service completion + a configurable clearing window (default 7 days), instead of counting every paid booking.

**Architecture:** A pure helper `computeSettlementBalance(hostId, clearingDays, nowMs)` in a new `settlementService.js` is the single source of truth for both `getPayoutBalance` and `requestPayout`. It reads `bookings` + `payout_requests` and buckets money into available / clearing / pendingCompletion. The clearing window comes from `platform_settings.settlement_clearing_days` via the existing `platformConfig.js`. The P1 ledger remains the accounting source of truth and is untouched.

**Tech Stack:** Node.js + Express, Supabase (`supabaseAdmin`), Jest (server), React + Vite + Vitest (client).

**Spec:** `docs/superpowers/specs/2026-06-16-settlement-vendor-ledger-design.md`

---

### Task 1: Migration — clearing-window config

**Files:**
- Create: `server/migrations/v3.12_settlement_clearing.sql`

- [ ] **Step 1: Write the migration**

```sql
-- v3.12_settlement_clearing.sql
-- Settlement Engine P2: configurable clearing window (days after a booking's
-- completion before the vendor's earning becomes withdrawable). Idempotent.

INSERT INTO platform_settings (key, value)
VALUES ('settlement_clearing_days', '7')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Commit** (migration is applied to live Supabase manually later; not run by tests)

```bash
git add server/migrations/v3.12_settlement_clearing.sql
git commit -m "feat(settlement): v3.12 migration — settlement_clearing_days config"
```

---

### Task 2: platformConfig — expose clearingDays

**Files:**
- Modify: `server/services/platformConfig.js`
- Test: `server/tests/unit/platformConfig.test.js` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `server/tests/unit/platformConfig.test.js`:

```js
'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const platformConfig = require('../../services/platformConfig');

const chain = (result) => {
  const c = {};
  for (const m of ['select', 'in']) c[m] = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  return c;
};

beforeEach(() => { jest.clearAllMocks(); platformConfig.clearCache(); });

test('getConfig returns settlement clearingDays from settings', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [
    { key: 'settlement_clearing_days', value: '3' },
  ] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.clearingDays).toBe(3);
});

test('getConfig defaults clearingDays to 7 when unset', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.clearingDays).toBe(7);
});

test('getConfig clamps negative clearingDays to default', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [
    { key: 'settlement_clearing_days', value: '-5' },
  ] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.clearingDays).toBe(7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/platformConfig.test.js -t clearingDays`
Expected: FAIL (`cfg.clearingDays` is `undefined`).

- [ ] **Step 3: Implement — extend platformConfig**

In `server/services/platformConfig.js`:

Change the DEFAULTS line:
```js
const DEFAULTS = { platformFee: 10, gstRate: 0.18, clearingDays: 7 };
```

In `getConfig`, add the local + read + guard. After `let gstRate = DEFAULTS.gstRate;` add:
```js
  let clearingDays = DEFAULTS.clearingDays;
```

Change the `.in(...)` list to include the new key:
```js
      .in('key', ['platform_fee', 'platform_fee_gst_rate', 'settlement_clearing_days']);
```

Inside the `for (const row of data || [])` loop, add:
```js
      if (row.key === 'settlement_clearing_days') clearingDays = toNumber(row.value, DEFAULTS.clearingDays);
```

After the existing guards, add:
```js
  if (!Number.isFinite(clearingDays) || clearingDays < 0) clearingDays = DEFAULTS.clearingDays;
  clearingDays = Math.floor(clearingDays);
```

Change the cache/return object:
```js
  _cache = { at: now, value: { platformFee, gstRate, clearingDays } };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/platformConfig.test.js`
Expected: PASS (all clearingDays tests + any existing).

- [ ] **Step 5: Commit**

```bash
git add server/services/platformConfig.js server/tests/unit/platformConfig.test.js
git commit -m "feat(settlement): platformConfig exposes settlement clearingDays"
```

---

### Task 3: settlementService.computeSettlementBalance (core logic)

**Files:**
- Create: `server/services/settlementService.js`
- Test: `server/tests/unit/settlementService.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/settlementService.test.js`:

```js
'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const { computeSettlementBalance } = require('../../services/settlementService');

const chain = (result) => {
  const c = {};
  for (const m of ['select', 'eq']) c[m] = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  return c;
};

const NOW = Date.UTC(2026, 5, 20, 0, 0, 0); // 2026-06-20
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

const mockData = (bookings, payouts) => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'bookings') return chain({ data: bookings });
    if (t === 'payout_requests') return chain({ data: payouts });
    return chain({ data: [] });
  });
};

beforeEach(() => jest.clearAllMocks());

test('matured eligible booking (completed > window ago) counts as available', async () => {
  mockData(
    [{ vendor_amount: 500, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(500);
  expect(b.clearing).toBe(0);
});

test('eligible booking still in clearing window is clearing, not available', async () => {
  mockData(
    [{ vendor_amount: 300, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(2), payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
  expect(b.clearing).toBe(300);
});

test('paid-but-not-completed booking is pendingCompletion only', async () => {
  mockData(
    [{ vendor_amount: 200, settlement_status: 'pending_completion', completed_at: null, payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
  expect(b.clearing).toBe(0);
  expect(b.pendingCompletion).toBe(200);
});

test('cancelled and not_eligible bookings are excluded from all buckets', async () => {
  mockData(
    [
      { vendor_amount: 999, settlement_status: 'cancelled', completed_at: daysAgo(30), payment_status: 'paid' },
      { vendor_amount: 888, settlement_status: 'not_eligible', completed_at: daysAgo(30), payment_status: 'paid' },
    ],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
  expect(b.clearing).toBe(0);
  expect(b.pendingCompletion).toBe(0);
  expect(b.lifetimeEarned).toBe(0);
});

test('payouts (pending/approved/paid) reduce available; report inflight and paidOut', async () => {
  mockData(
    [{ vendor_amount: 1000, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' }],
    [
      { amount: 200, status: 'paid' },
      { amount: 100, status: 'approved' },
      { amount: 50, status: 'pending' },
      { amount: 999, status: 'rejected' },
    ]
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(650);   // 1000 - (200+100+50)
  expect(b.paidOut).toBe(200);
  expect(b.inflight).toBe(150);    // approved + pending
});

test('available never negative when over-claimed', async () => {
  mockData(
    [{ vendor_amount: 100, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' }],
    [{ amount: 500, status: 'paid' }]
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
});

test('booking completed exactly at cutoff counts as matured (<= cutoff)', async () => {
  mockData(
    [{ vendor_amount: 400, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(7), payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(400);
});

test('zero-day window makes eligible bookings immediately available', async () => {
  mockData(
    [{ vendor_amount: 250, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(0), payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 0, NOW);
  expect(b.available).toBe(250);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/settlementService.test.js`
Expected: FAIL (`Cannot find module '../../services/settlementService'`).

- [ ] **Step 3: Implement the service**

Create `server/services/settlementService.js`:

```js
/**
 * settlementService.js — vendor settlement balance (Financial Ledger P2).
 *
 * Single source of truth for a vendor's withdrawable balance. Withdrawable
 * money is gated on service COMPLETION plus a clearing window:
 *   pending_completion -> clearing (completed, in window) -> available (matured)
 * Cancelled / not_eligible bookings are excluded. The P1 ledger remains the
 * accounting record (Vendor Payables credited at payment); this derives
 * eligibility from bookings, which is authoritative for what is truly owed
 * (a cancelled paid booking still credits the ledger until P3 refunds reverse it).
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {string} hostId
 * @param {number} clearingDays  days after completion before money matures
 * @param {number} [nowMs]       injectable clock for tests
 * @returns {Promise<{available:number, clearing:number, pendingCompletion:number,
 *                     inflight:number, paidOut:number, lifetimeEarned:number}>}
 */
async function computeSettlementBalance(hostId, clearingDays, nowMs = Date.now()) {
  const cutoff = nowMs - (Number(clearingDays) || 0) * 86400000;

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('vendor_amount, settlement_status, completed_at, payment_status')
    .eq('host_id', hostId);

  let matured = 0, clearing = 0, pendingCompletion = 0;
  for (const b of bookings || []) {
    const amt = Number(b.vendor_amount) || 0;
    const ss = b.settlement_status;
    if (ss === 'cancelled' || ss === 'not_eligible') continue;
    if (ss === 'eligible_for_settlement' && b.completed_at) {
      const completedMs = new Date(b.completed_at).getTime();
      if (Number.isFinite(completedMs) && completedMs <= cutoff) matured += amt;
      else clearing += amt;
    } else if (b.payment_status === 'paid' && ss === 'pending_completion') {
      pendingCompletion += amt;
    }
  }

  const { data: payouts } = await supabaseAdmin
    .from('payout_requests')
    .select('amount, status')
    .eq('host_id', hostId);

  let claimed = 0, inflight = 0, paidOut = 0;
  for (const p of payouts || []) {
    const amt = Number(p.amount) || 0;
    if (p.status === 'paid') { claimed += amt; paidOut += amt; }
    else if (p.status === 'approved' || p.status === 'pending') { claimed += amt; inflight += amt; }
  }

  const available = Math.max(0, matured - claimed);
  return {
    available: round2(available),
    clearing: round2(clearing),
    pendingCompletion: round2(pendingCompletion),
    inflight: round2(inflight),
    paidOut: round2(paidOut),
    lifetimeEarned: round2(matured + clearing + pendingCompletion),
  };
}

module.exports = { computeSettlementBalance };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/settlementService.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/settlementService.js server/tests/unit/settlementService.test.js
git commit -m "feat(settlement): computeSettlementBalance with completion+window gate"
```

---

### Task 4: Rewire getPayoutBalance

**Files:**
- Modify: `server/controllers/vendorController.js` (`getPayoutBalance`, ~lines 59-99; imports at top)
- Test: `server/tests/unit/payoutBalance.test.js` (rewrite the existing assertion to the new shape)

- [ ] **Step 1: Update the failing test**

Replace the body of `server/tests/unit/payoutBalance.test.js` with:

```js
'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
const { supabaseAdmin } = require('../../config/supabase');
const platformConfig = require('../../services/platformConfig');
const ctrl = require('../../controllers/vendorController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const chain = (result) => {
  const c = {};
  for (const m of ['select', 'eq', 'order']) c[m] = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  return c;
};

const NOW = Date.now();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  platformConfig.getConfig.mockResolvedValue({ clearingDays: 7 });
});

test('getPayoutBalance gates available on completion + clearing window', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'bookings') return chain({ data: [
      { vendor_amount: 1000, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' },
      { vendor_amount: 300, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(2), payment_status: 'paid' },
      { vendor_amount: 200, settlement_status: 'pending_completion', completed_at: null, payment_status: 'paid' },
    ] });
    if (t === 'payout_requests') return chain({ data: [{ amount: 100, status: 'paid' }] });
    return chain({ data: [] });
  });
  const res = mockRes();
  await ctrl.getPayoutBalance({ user: { id: 'h1' } }, res);
  const body = res.json.mock.calls[0][0];
  expect(body.available).toBe(900);          // 1000 matured - 100 paid
  expect(body.clearing).toBe(300);           // completed 2 days ago
  expect(body.pendingCompletion).toBe(200);  // not yet completed
  expect(body.paidOut).toBe(100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/payoutBalance.test.js`
Expected: FAIL (`body.available` is `1500`/old logic; `clearing` undefined).

- [ ] **Step 3: Implement — rewrite getPayoutBalance**

In `server/controllers/vendorController.js`, add to the top-of-file requires (near the `supabaseAdmin` import):

```js
const platformConfig = require('../services/platformConfig');
const { computeSettlementBalance } = require('../services/settlementService');
```

Replace the entire `getPayoutBalance` function (lines ~59-99) with:

```js
const getPayoutBalance = async (req, res) => {
  try {
    const hostId = req.user.id;
    const { clearingDays } = await platformConfig.getConfig();
    const balance = await computeSettlementBalance(hostId, clearingDays);
    res.json(balance);
  } catch (error) {
    safeError(res, error);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/payoutBalance.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/vendorController.js server/tests/unit/payoutBalance.test.js
git commit -m "feat(settlement): getPayoutBalance uses settlement gate + breakdown"
```

---

### Task 5: Rewire requestPayout (cap at available)

**Files:**
- Modify: `server/controllers/vendorController.js` (`requestPayout`, ~lines 118-172)
- Test: `server/tests/unit/requestPayout.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/requestPayout.test.js`:

```js
'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/settlementService', () => ({ computeSettlementBalance: jest.fn() }));
const { supabaseAdmin } = require('../../config/supabase');
const platformConfig = require('../../services/platformConfig');
const { computeSettlementBalance } = require('../../services/settlementService');
const ctrl = require('../../controllers/vendorController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const insertChain = (result) => {
  const c = {};
  c.insert = jest.fn(() => c); c.select = jest.fn(() => c); c.single = () => Promise.resolve(result);
  return c;
};

beforeEach(() => {
  jest.clearAllMocks();
  platformConfig.getConfig.mockResolvedValue({ clearingDays: 7 });
});

test('rejects amount above available', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 100 });
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 500 } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].message).toMatch(/exceed/i);
});

test('rejects amount below minimum 100', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 1000 });
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 50 } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('accepts valid amount within available', async () => {
  computeSettlementBalance.mockResolvedValue({ available: 1000 });
  supabaseAdmin.from.mockReturnValue(insertChain({ data: { id: 'p1', amount: 500 }, error: null }));
  const res = mockRes();
  await ctrl.requestPayout({ user: { id: 'h1' }, body: { amount: 500, notes: 'upi' } }, res);
  expect(res.status).toHaveBeenCalledWith(201);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/requestPayout.test.js`
Expected: FAIL (old logic reads bookings via chain, not the mocked `computeSettlementBalance`; the accept test likely throws or asserts wrong).

- [ ] **Step 3: Implement — rewrite the balance section of requestPayout**

In `server/controllers/vendorController.js`, in `requestPayout`, replace everything from the `// Get available balance` comment through the `available` computation and the over-limit check (the block that selects paidBookings, sums totalEarned, selects payouts, computes alreadyClaimed/available, and the `if (parseFloat(amount) > available)` guard) with:

```js
    const { clearingDays } = await platformConfig.getConfig();
    const { available } = await computeSettlementBalance(hostId, clearingDays);

    if (parseFloat(amount) > available) {
      return res.status(400).json({
        message: `Cannot exceed available balance of ₹${Math.round(available)}`,
      });
    }
```

Keep the `amount < 100` guard above it and the `payout_requests` insert below it unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/requestPayout.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/vendorController.js server/tests/unit/requestPayout.test.js
git commit -m "feat(settlement): requestPayout caps withdrawal at settlement available"
```

---

### Task 6: Client — show the balance breakdown

**Files:**
- Modify: `client/src/pages/Payouts.jsx` (`balCards`, ~lines 178-200)
- Test: `client/src/tests/Payouts.test.jsx` (create)

- [ ] **Step 1: Write the failing test**

Create `client/src/tests/Payouts.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Payouts from '../pages/Payouts';

vi.mock('../services/api', () => ({
  getPayoutBalance: vi.fn(() => Promise.resolve({ data: {
    available: 900, clearing: 300, pendingCompletion: 200, inflight: 0, paidOut: 100, lifetimeEarned: 1400,
  } })),
  getPayoutRequests: vi.fn(() => Promise.resolve({ data: [] })),
  requestPayout: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

describe('Payouts breakdown', () => {
  it('shows available, clearing and pending-completion figures', async () => {
    render(<Payouts />);
    await waitFor(() => expect(screen.getByText(/Available Balance/i)).toBeInTheDocument());
    expect(screen.getByText('Rs.900.00')).toBeInTheDocument();
    expect(screen.getByText(/Clearing/i)).toBeInTheDocument();
    expect(screen.getByText('Rs.300.00')).toBeInTheDocument();
    expect(screen.getByText(/Pending Completion/i)).toBeInTheDocument();
    expect(screen.getByText('Rs.200.00')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/tests/Payouts.test.jsx`
Expected: FAIL (no "Clearing" / "Pending Completion" cards; figures absent).

- [ ] **Step 3: Implement — update balCards**

In `client/src/pages/Payouts.jsx`, replace the `balCards` array (lines ~178-200) with:

```jsx
  const balCards = [
    {
      label: "Available Balance",
      value: fmt(balance?.available),
      color: "text-primary",
      big: true,
    },
    {
      label: "Clearing",
      value: fmt(balance?.clearing),
      color: "text-amber-600",
    },
    {
      label: "Pending Completion",
      value: fmt(balance?.pendingCompletion),
      color: "text-gray-500",
    },
    {
      label: "Total Withdrawn",
      value: fmt(balance?.paidOut),
      color: "text-gray-700",
    },
  ];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/tests/Payouts.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Payouts.jsx client/src/tests/Payouts.test.jsx
git commit -m "feat(settlement): Payouts page shows clearing + pending-completion breakdown"
```

---

### Task 7: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full server suite**

Run: `cd server && npm test`
Expected: PASS (all prior tests + the new settlement/platformConfig/requestPayout tests). Fix any fixture that asserted the old `{pending,totalWithdrawn,totalEarned}` shape.

- [ ] **Step 2: Run the full client suite + build**

Run: `cd client && npm test` then `cd client && npm run build`
Expected: tests PASS, build clean.

- [ ] **Step 3: Commit any fixture fixes**

```bash
git add -A
git commit -m "test(settlement): align fixtures with new balance shape"
```

(Skip if nothing changed.)

---

## Post-implementation (manual, outside the plan)
- Apply `server/migrations/v3.12_settlement_clearing.sql` to live Supabase (project `xwvciqkayammbvsidqig`).
- Smoke: a completed booking < 7 days old shows in **Clearing**; > 7 days shows in **Available**; a paid-uncompleted booking shows in **Pending Completion**; a withdrawal request cannot exceed **Available**.
