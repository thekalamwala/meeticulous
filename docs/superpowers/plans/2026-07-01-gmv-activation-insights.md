# GMV + Activation North-Star Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GMV (gross value transacted to hosts) and host-activation (first money-moving paid booking) KPIs to the existing admin insights surface.

**Architecture:** Extend `insightsAdminController.getKpis` with pure, exported value helpers (`bookingGrossValue`, `productGrossValue`, `median`) reused by both GMV and activation so the two metrics can never diverge. Add one `product_purchases` scan that degrades to empty on any error. Render two new tiles on `AdminInsights.jsx`. No migration, no new route/permission/nav.

**Tech Stack:** Node.js/Express, Supabase (`supabaseAdmin`), Jest (server), React + Vite + Vitest (client), Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-01-gmv-activation-insights-design.md` (canonical metric definitions D1–D8; read it before starting).

## Global Constraints

- Metric semantics are governed by the spec's canonical definitions D1–D8, business rules 1–9, and edge-case table. Do not deviate; the code follows the doc.
- Money rounded to 2 decimals (`round2`); rates/percentages to 1 decimal (`round1`). INR, major units.
- Only `payment_status === 'paid'` rows count. Free (grossValue 0) bookings excluded from activation.
- `getKpis` is gated by `requireAdmin('analytics.view')` in `routes/adminRoutes.js` — DO NOT change the route, permission, or add a nav item.
- The existing `revenue` KPI stays bookings-only and unchanged; take-rate uses a separate product-inclusive `platformRevenue` (spec D8).
- Client: reuse the existing `Tile` component, `inr()` and `delta()` helpers. No new design tokens/colors. Keep `rounded-xl` bordered tiles.
- Preserve backward compatibility: existing payload keys (`revenue`, `bookings`, `conversion`, `hosts`, `guests`, `generatedAt`) keep their shape and values.

---

### Task 1: Pure value + median helpers

**Files:**
- Modify: `server/controllers/insightsAdminController.js`
- Test: `server/tests/unit/insightsAdminController.test.js`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces:
  - `bookingGrossValue(b) -> number` — gross service value of one booking row, ≥0 (spec D2).
  - `productGrossValue(p) -> number` — gross value of one product purchase, ≥0 (spec D3).
  - `median(arr: number[]) -> number | null` — median rounded to 1 decimal, `null` if empty (spec D6).
  - Module now also exports these three alongside `getKpis`.

- [ ] **Step 1: Write the failing tests**

Append to `server/tests/unit/insightsAdminController.test.js`:

```javascript
const {
  bookingGrossValue, productGrossValue, median,
} = require('../../controllers/insightsAdminController');

describe('bookingGrossValue (spec D2)', () => {
  test('primary: customer_total minus platform fee and its GST', () => {
    expect(bookingGrossValue({ customer_total: 1180, platform_fee_amount: 10, platform_fee_gst: 1.8 }))
      .toBe(1168.2);
  });
  test('free booking (customer_total 0) => 0', () => {
    expect(bookingGrossValue({ customer_total: 0, platform_fee_amount: 0, platform_fee_gst: 0 })).toBe(0);
  });
  test('NULL fee/gst coalesced to 0', () => {
    expect(bookingGrossValue({ customer_total: 500 })).toBe(500);
  });
  test('pre-v2.2 fallback: NULL customer_total => vendor_amount + commission_applied', () => {
    expect(bookingGrossValue({ customer_total: null, vendor_amount: 900, commission_applied: 50 })).toBe(950);
  });
  test('negative reconstruction clamped to 0', () => {
    expect(bookingGrossValue({ customer_total: 5, platform_fee_amount: 10, platform_fee_gst: 1.8 })).toBe(0);
  });
});

describe('productGrossValue (spec D3)', () => {
  test('uses amount_paid', () => {
    expect(productGrossValue({ amount_paid: 299, platform_fee: 10 })).toBe(299);
  });
  test('free product (0) => 0; null => 0', () => {
    expect(productGrossValue({ amount_paid: 0 })).toBe(0);
    expect(productGrossValue({})).toBe(0);
  });
});

describe('median (spec D6)', () => {
  test('empty => null', () => expect(median([])).toBeNull());
  test('odd => middle', () => expect(median([3, 1, 2])).toBe(2));
  test('even => mean of two middle', () => expect(median([1, 2, 3, 4])).toBe(2.5));
  test('rounds to 1 decimal', () => expect(median([1, 2, 2])).toBe(1.7));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/unit/insightsAdminController.test.js -t "grossValue|median" -v`
Expected: FAIL — `bookingGrossValue is not a function` (helpers not exported yet).

- [ ] **Step 3: Add the helpers and export them**

In `server/controllers/insightsAdminController.js`, after the `const DAY = ...` line add:

```javascript
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// Gross service value of a paid booking (GMV contribution) — spec D2.
//   primary: customer_total − platform_fee − platform_fee_gst  (= service price)
//   fallback (pre-v2.2 row, customer_total NULL): vendor_amount + commission_applied
// Clamped to ≥0. Reused by BOTH gmv and activation so they cannot diverge.
const bookingGrossValue = (b) => {
  let v;
  if (b.customer_total != null) {
    v = Number(b.customer_total)
      - (Number(b.platform_fee_amount) || 0)
      - (Number(b.platform_fee_gst) || 0);
  } else {
    v = (Number(b.vendor_amount) || 0) + (Number(b.commission_applied) || 0);
  }
  return Math.max(0, round2(v));
};

// Gross value of a paid product purchase (GMV contribution) — spec D3.
const productGrossValue = (p) => Math.max(0, round2(Number(p.amount_paid) || 0));

// Median of a numeric array, 1-decimal; null when empty — spec D6.
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return round1(m);
};
```

Change the final export line from `module.exports = { getKpis };` to:

```javascript
module.exports = { getKpis, bookingGrossValue, productGrossValue, median };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/unit/insightsAdminController.test.js -t "grossValue|median" -v`
Expected: PASS (all helper tests green).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/insightsAdminController.js server/tests/unit/insightsAdminController.test.js
git commit -m "feat(insights): add reusable GMV value + median helpers"
```

---

### Task 2: GMV aggregation in getKpis

**Files:**
- Modify: `server/controllers/insightsAdminController.js` (`getKpis`)
- Test: `server/tests/unit/insightsAdminController.test.js`

**Interfaces:**
- Consumes: `bookingGrossValue`, `productGrossValue` (Task 1); existing `bookingRevenue`.
- Produces: `getKpis` response gains a `gmv` object:
  `{ total, last30, prev30, bookings, products, platformRevenue, takeRate }` (all `round2` money; `takeRate` `round1` %).

> **IMPORTANT (query order):** this task adds a `product_purchases` scan **after** the bookings query (incl. its retry) and **before** the `Promise.all` hosts/guests. Any test mocking `supabaseAdmin.from` must insert one extra `makeQuery(...)` for products in that position. This task updates the two pre-existing tests accordingly.

- [ ] **Step 1: Update the two existing tests for the new product scan, then write failing GMV tests**

In the FIRST existing test (`computes revenue, conversion, bookings and host tiles...`), change the mock chain to insert a products query between bookings and hosts:

```javascript
  supabaseAdmin.from
    .mockReturnValueOnce(makeQuery({ data: bookings, error: null }))            // bookings
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))                  // product_purchases
    .mockReturnValueOnce(makeQuery({ data: [{ id: 'h1', created_at: nowIso }, { id: 'h2', created_at: nowIso }], error: null })) // hosts
    .mockReturnValueOnce(makeQuery({ count: 42, error: null }));                // guests
```

In the SECOND existing test (`falls back to fee-only select...`), insert the products mock after the retry:

```javascript
  supabaseAdmin.from
    .mockReturnValueOnce(errQuery)                                              // bookings (errors)
    .mockReturnValueOnce(retryQuery)                                            // bookings retry
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))                  // product_purchases
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))                  // hosts
    .mockReturnValueOnce(makeQuery({ count: 0, error: null }));                 // guests
```

Then append new GMV tests:

```javascript
test('computes GMV from paid bookings (gross) + paid products, with windows', async () => {
  const nowIso = new Date().toISOString();
  const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(); // in prev30 window
  const bookings = [
    { id: 1, host_id: 'h1', payment_status: 'paid',   customer_total: 1180, platform_fee_amount: 10, platform_fee_gst: 1.8, created_at: nowIso }, // gross 1168.2
    { id: 2, host_id: 'h1', payment_status: 'paid',   customer_total: 236,  platform_fee_amount: 10, platform_fee_gst: 1.8, created_at: old },    // gross 224.2 (prev30)
    { id: 3, host_id: 'h2', payment_status: 'unpaid',  customer_total: 999, platform_fee_amount: 10, platform_fee_gst: 1.8, created_at: nowIso }, // excluded
    { id: 4, host_id: 'h2', payment_status: 'refunded',customer_total: 500, platform_fee_amount: 10, platform_fee_gst: 1.8, created_at: nowIso }, // excluded
  ];
  const products = [
    { id: 'p1', payment_status: 'paid', amount_paid: 299, platform_fee: 10, created_at: nowIso },
    { id: 'p2', payment_status: 'unpaid', amount_paid: 999, platform_fee: 0, created_at: nowIso }, // excluded
  ];
  supabaseAdmin.from
    .mockReturnValueOnce(makeQuery({ data: bookings, error: null }))
    .mockReturnValueOnce(makeQuery({ data: products, error: null }))
    .mockReturnValueOnce(makeQuery({ data: [{ id: 'h1', created_at: nowIso }, { id: 'h2', created_at: nowIso }], error: null }))
    .mockReturnValueOnce(makeQuery({ count: 0, error: null }));

  const r = res();
  await getKpis({}, r);
  const p = r.json.mock.calls[0][0];
  expect(p.gmv.bookings).toBe(1392.4);       // 1168.2 + 224.2
  expect(p.gmv.products).toBe(299);
  expect(p.gmv.total).toBe(1691.4);          // 1392.4 + 299
  expect(p.gmv.last30).toBe(1467.2);         // 1168.2 (booking) + 299 (product)
  expect(p.gmv.prev30).toBe(224.2);          // the 45-day-old booking
  // platformRevenue = booking(fee+commission) + product platform_fee
  //   booking1 fee 10 + booking2 fee 10 = 20 (commission 0) ; product fee 10 => 30
  expect(p.gmv.platformRevenue).toBe(30);
  expect(p.gmv.takeRate).toBe(1.8);          // round1(30 / 1691.4 * 100)
});

test('product scan error degrades product GMV to 0 without failing', async () => {
  const nowIso = new Date().toISOString();
  supabaseAdmin.from
    .mockReturnValueOnce(makeQuery({ data: [{ id: 1, host_id: 'h1', payment_status: 'paid', customer_total: 100, platform_fee_amount: 0, platform_fee_gst: 0, created_at: nowIso }], error: null }))
    .mockReturnValueOnce(makeQuery({ data: null, error: { message: 'relation "product_purchases" does not exist' } }))
    .mockReturnValueOnce(makeQuery({ data: [{ id: 'h1', created_at: nowIso }], error: null }))
    .mockReturnValueOnce(makeQuery({ count: 0, error: null }));

  const r = res();
  await getKpis({}, r);
  const p = r.json.mock.calls[0][0];
  expect(p.gmv.products).toBe(0);
  expect(p.gmv.bookings).toBe(100);
  expect(p.gmv.total).toBe(100);
});
```

- [ ] **Step 2: Run to verify the new GMV tests fail (existing two still pass)**

Run: `cd server && npx jest tests/unit/insightsAdminController.test.js -v`
Expected: the two `GMV`/`product scan` tests FAIL (`Cannot read properties of undefined (reading 'bookings')`); the original revenue/fallback tests PASS.

- [ ] **Step 3: Extend the bookings select, add the product scan + GMV computation**

In `getKpis`, replace the bookings select block. Change the existing:

```javascript
    let bookingsRes = await supabaseAdmin
      .from('bookings')
      .select('id, payment_status, platform_fee_amount, commission_applied, created_at');
    if (bookingsRes.error && /Could not find the|column.*does not exist/i.test(bookingsRes.error.message)) {
      bookingsRes = await supabaseAdmin
        .from('bookings')
        .select('id, payment_status, platform_fee_amount, created_at');
    }
```

to:

```javascript
    const FULL_COLS = 'id, host_id, payment_status, platform_fee_amount, platform_fee_gst, commission_applied, vendor_amount, customer_total, created_at';
    const CORE_COLS = 'id, host_id, payment_status, platform_fee_amount, created_at';
    let bookingsRes = await supabaseAdmin.from('bookings').select(FULL_COLS);
    if (bookingsRes.error && /Could not find the|column.*does not exist/i.test(bookingsRes.error.message)) {
      bookingsRes = await supabaseAdmin.from('bookings').select(CORE_COLS);
    }
```

Immediately AFTER the existing `revenuePrev30` computation (and before the hosts/guests `Promise.all`), insert:

```javascript
    // ── Product purchases (GMV only; degrade to [] on any error) — spec D3/edge table ──
    let products = [];
    const prodRes = await supabaseAdmin
      .from('product_purchases')
      .select('id, payment_status, amount_paid, platform_fee, created_at');
    if (!prodRes.error) products = (prodRes.data || []).filter((p) => p.payment_status === 'paid');

    // ── GMV (spec D4/D8) ──
    const inWindow = (rows, valfn, lo, hi) =>
      rows
        .filter((x) => x.created_at >= lo && (hi ? x.created_at < hi : true))
        .reduce((s, x) => s + valfn(x), 0);
    const bookingGmvAll = paid.reduce((s, b) => s + bookingGrossValue(b), 0);
    const productGmvAll = products.reduce((s, p) => s + productGrossValue(p), 0);
    const gmvLast30 = inWindow(paid, bookingGrossValue, since30, null)
                    + inWindow(products, productGrossValue, since30, null);
    const gmvPrev30 = inWindow(paid, bookingGrossValue, since60, since30)
                    + inWindow(products, productGrossValue, since60, since30);
    const gmvTotal = round2(bookingGmvAll + productGmvAll);
    // Take-rate uses a GMV-consistent revenue base (booking fee+commission + product fee).
    const productPlatformRev = products.reduce((s, p) => s + (Number(p.platform_fee) || 0), 0);
    const gmvPlatformRevenue = revenueTotal + productPlatformRev;
    const takeRate = gmvTotal > 0 ? round1((gmvPlatformRevenue / gmvTotal) * 100) : 0;
```

Add the `gmv` block to the `res.json({...})` payload (insert after the `conversion` key):

```javascript
      gmv: {
        total: gmvTotal,
        last30: round2(gmvLast30),
        prev30: round2(gmvPrev30),
        bookings: round2(bookingGmvAll),
        products: round2(productGmvAll),
        platformRevenue: round2(gmvPlatformRevenue),
        takeRate,
      },
```

- [ ] **Step 4: Run all insights tests to verify they pass**

Run: `cd server && npx jest tests/unit/insightsAdminController.test.js -v`
Expected: PASS (original revenue/fallback + helper + GMV + product-degrade tests all green).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/insightsAdminController.js server/tests/unit/insightsAdminController.test.js
git commit -m "feat(insights): compute GMV (bookings gross + products) with take-rate"
```

---

### Task 3: Host activation in getKpis

**Files:**
- Modify: `server/controllers/insightsAdminController.js` (`getKpis`)
- Test: `server/tests/unit/insightsAdminController.test.js`

**Interfaces:**
- Consumes: `bookingGrossValue`, `median` (Task 1); the `hosts` array and `paid` bookings already in `getKpis`.
- Produces: `getKpis` response gains an `activation` object:
  `{ activatedCount, totalHosts, activationRate, new30, medianTimeToFirstBookingDays }`.

- [ ] **Step 1: Write the failing activation tests**

Append to `server/tests/unit/insightsAdminController.test.js`:

```javascript
test('activation counts only hosts with a money-moving paid booking', async () => {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const host1Created = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();  // h1 signed up 5d ago
  const h1FirstPaid = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();   // first paid 2d after signup
  const bookings = [
    { id: 1, host_id: 'h1', payment_status: 'paid', customer_total: 500, platform_fee_amount: 0, platform_fee_gst: 0, created_at: h1FirstPaid }, // gross>0 => activates h1
    { id: 2, host_id: 'h2', payment_status: 'paid', customer_total: 0,   platform_fee_amount: 0, platform_fee_gst: 0, created_at: nowIso },       // free => NOT activation
    { id: 3, host_id: 'h3', payment_status: 'unpaid',customer_total: 999, platform_fee_amount: 0, platform_fee_gst: 0, created_at: nowIso },      // unpaid => excluded
  ];
  supabaseAdmin.from
    .mockReturnValueOnce(makeQuery({ data: bookings, error: null }))
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))                                        // products
    .mockReturnValueOnce(makeQuery({ data: [
      { id: 'h1', created_at: host1Created }, { id: 'h2', created_at: nowIso }, { id: 'h3', created_at: nowIso },
    ], error: null }))                                                                                // hosts (3)
    .mockReturnValueOnce(makeQuery({ count: 0, error: null }));                                       // guests

  const r = res();
  await getKpis({}, r);
  const p = r.json.mock.calls[0][0];
  expect(p.activation.activatedCount).toBe(1);            // only h1
  expect(p.activation.totalHosts).toBe(3);
  expect(p.activation.activationRate).toBe(33.3);         // 1/3
  expect(p.activation.new30).toBe(1);                     // h1 first-paid within 30d
  expect(p.activation.medianTimeToFirstBookingDays).toBe(2); // 5d signup -> 3d ago first paid = 2 days
});

test('activation is null/zero-safe on empty data', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))   // bookings
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))   // products
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))   // hosts
    .mockReturnValueOnce(makeQuery({ count: 0, error: null }));  // guests

  const r = res();
  await getKpis({}, r);
  const p = r.json.mock.calls[0][0];
  expect(p.activation).toEqual({
    activatedCount: 0, totalHosts: 0, activationRate: 0, new30: 0, medianTimeToFirstBookingDays: null,
  });
});
```

- [ ] **Step 2: Run to verify the activation tests fail**

Run: `cd server && npx jest tests/unit/insightsAdminController.test.js -t "activation" -v`
Expected: FAIL (`Cannot read properties of undefined (reading 'activatedCount')`).

- [ ] **Step 3: Compute activation after the hosts query**

In `getKpis`, the hosts block currently is:

```javascript
    const hosts = hostsRes.data || [];
    const hostsNew30 = hosts.filter((h) => h.created_at >= since30).length;
```

Add directly below it:

```javascript
    // ── Activation: host's first money-moving paid booking (spec D5/D6) ──
    const hostCreatedAt = new Map(hosts.map((h) => [h.id, h.created_at]));
    const firstQualifyingByHost = new Map(); // host_id -> earliest qualifying created_at
    for (const b of paid) {
      if (!b.host_id || bookingGrossValue(b) <= 0) continue; // skip null host + free bookings
      const prev = firstQualifyingByHost.get(b.host_id);
      if (!prev || b.created_at < prev) firstQualifyingByHost.set(b.host_id, b.created_at);
    }
    const activatedCount = firstQualifyingByHost.size;
    const totalHosts = hosts.length;
    let activatedNew30 = 0;
    const ttfbDays = [];
    for (const [hostId, firstAt] of firstQualifyingByHost) {
      if (firstAt >= since30) activatedNew30 += 1;
      const created = hostCreatedAt.get(hostId);
      if (created) {
        const diff = (new Date(firstAt).getTime() - new Date(created).getTime()) / DAY;
        ttfbDays.push(Math.max(0, diff)); // clamp negatives (data anomaly)
      }
    }
```

Add the `activation` block to `res.json({...})` (insert after the `gmv` key):

```javascript
      activation: {
        activatedCount,
        totalHosts,
        activationRate: totalHosts ? round1((activatedCount / totalHosts) * 100) : 0,
        new30: activatedNew30,
        medianTimeToFirstBookingDays: median(ttfbDays),
      },
```

- [ ] **Step 4: Run all insights tests to verify they pass**

Run: `cd server && npx jest tests/unit/insightsAdminController.test.js -v`
Expected: PASS (all tests, incl. the two activation tests).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/insightsAdminController.js server/tests/unit/insightsAdminController.test.js
git commit -m "feat(insights): compute host activation rate + time-to-first-booking"
```

---

### Task 4: Client GMV + Activation tiles + full verification

**Files:**
- Modify: `client/src/pages/admin/AdminInsights.jsx`
- Test: `client/src/pages/admin/__tests__/AdminInsights.test.jsx` (create)

**Interfaces:**
- Consumes: `getKpis` payload `gmv` (Task 2) + `activation` (Task 3) via `adminGetInsights()`.
- Produces: two rendered tiles; no exported API.

- [ ] **Step 1: Write a failing render test**

Create `client/src/pages/admin/__tests__/AdminInsights.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import AdminInsights from '../AdminInsights';

vi.mock('../../../services/api', () => ({
  adminGetInsights: () => Promise.resolve({ data: {
    revenue: { total: 100, last30: 100, prev30: 0 },
    bookings: { total: 1, paid: 1, last30: 1 },
    conversion: { created: 1, paid: 1, rate: 100 },
    gmv: { total: 1691.4, last30: 1467.2, prev30: 224.2, bookings: 1392.4, products: 299, platformRevenue: 30, takeRate: 1.8 },
    activation: { activatedCount: 1, totalHosts: 3, activationRate: 33.3, new30: 1, medianTimeToFirstBookingDays: 2 },
    hosts: { total: 3, new30: 1 },
    guests: { total: 0 },
    generatedAt: new Date().toISOString(),
  } }),
}));

describe('AdminInsights GMV + activation tiles', () => {
  test('renders GMV total and activation rate', async () => {
    render(<AdminInsights />);
    expect(await screen.findByText('₹1,691.4')).toBeInTheDocument();
    expect(await screen.findByText('33.3%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/__tests__/AdminInsights.test.jsx`
Expected: FAIL — `₹1,691.4` / `33.3%` not found (tiles not rendered yet).

> Note: `toBeInTheDocument` is one of the matchers available in this client's vitest setup (jest-dom is only partially loaded — see project notes). `findByText` is async and awaits the `useEffect` fetch.

- [ ] **Step 3: Add the two tiles and a GMV delta**

In `client/src/pages/admin/AdminInsights.jsx`, after the existing `const revDelta = ...` line add:

```javascript
  const gmvDelta = kpi && delta(kpi.gmv?.last30, kpi.gmv?.prev30);
```

Change the KPI grid wrapper from `grid-cols-2 md:grid-cols-4` to `grid-cols-2 md:grid-cols-3` (6 tiles → clean 2×3 on desktop):

```jsx
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
```

Inside that grid, after the existing `Hosts` `<Tile ... />`, add:

```jsx
          <Tile
            label="GMV (bookings + products)"
            value={inr(kpi.gmv?.total)}
            sub={`${inr(kpi.gmv?.last30)} last 30d · take ${kpi.gmv?.takeRate ?? 0}%`}
            foot={
              gmvDelta != null && (
                <p className={`text-xs mt-2 font-semibold ${gmvDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {gmvDelta >= 0 ? '▲' : '▼'} {Math.abs(gmvDelta)}% vs prior 30d
                </p>
              )
            }
          />
          <Tile
            label="Host Activation"
            value={`${kpi.activation?.activationRate ?? 0}%`}
            sub={`${kpi.activation?.activatedCount ?? 0} of ${kpi.activation?.totalHosts ?? 0} hosts · +${kpi.activation?.new30 ?? 0} 30d`}
            foot={
              <p className="text-xs mt-2 text-gray-400">
                {kpi.activation?.medianTimeToFirstBookingDays != null
                  ? `~${kpi.activation.medianTimeToFirstBookingDays}d to first booking`
                  : '— no activated hosts yet'}
              </p>
            }
          />
```

- [ ] **Step 4: Run the client test to verify it passes**

Run: `cd client && npx vitest run src/pages/admin/__tests__/AdminInsights.test.jsx`
Expected: PASS.

- [ ] **Step 5: Full-suite verification (server + client)**

Run: `cd server && npm test`
Expected: all server suites PASS (no regressions).

Run: `cd client && npm test`
Expected: all client suites PASS.

Run: `cd client && npm run build`
Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/AdminInsights.jsx client/src/pages/admin/__tests__/AdminInsights.test.jsx
git commit -m "feat(insights): GMV + host-activation KPI tiles on AdminInsights"
```

---

## Notes for the implementer

- Read the spec's D1–D8 before Task 1. The formulas here mirror it exactly; if a test value looks surprising, re-derive from the spec rather than "fixing" the code to match a guess.
- Query order in `getKpis` is load-bearing for the mocked tests: **bookings → (retry) → product_purchases → hosts → guests**. Keep the product scan between bookings and the hosts/guests `Promise.all`.
- Do not touch `routes/adminRoutes.js`, `lib/adminPermissions.js`, `adminNav.js`, or any migration — this feature adds none.
