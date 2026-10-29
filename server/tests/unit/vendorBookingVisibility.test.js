/**
 * tests/unit/vendorBookingVisibility.test.js
 *
 * Regression: vendors must only ever receive PAID bookings. An unpaid/pending
 * booking is a lead — Admin-only. Both vendor-facing booking reads
 * (getHostBookings, vendor getTransactions) must hard-filter payment_status=paid.
 */
jest.mock('../../config/supabase', () => {
  const builders = [];
  const makeBuilder = (result) => {
    const b = {
      eqCalls: [],
      gteCalls: [],
      lteCalls: [],
      select: jest.fn(function () { return this; }),
      neq:    jest.fn(function () { return this; }),
      order:  jest.fn(function () { return this; }),
      range:  jest.fn(function () { return this; }),
      or:     jest.fn(function () { return this; }),
      ilike:  jest.fn(function () { return this; }),
      eq:     jest.fn(function (col, val) { this.eqCalls.push([col, val]); return this; }),
      gte:    jest.fn(function (col, val) { this.gteCalls.push([col, val]); return this; }),
      lte:    jest.fn(function (col, val) { this.lteCalls.push([col, val]); return this; }),
      // Thenable so `await query` (and `await ...order()`) resolves to `result`.
      then:   (resolve) => resolve(result),
    };
    builders.push(b);
    return b;
  };
  const result = { data: [], error: null, count: 0 };
  return {
    supabaseAdmin: {
      __builders: builders,
      __result: result,
      from: jest.fn(() => makeBuilder(result)),
    },
  };
});

const { supabaseAdmin } = require('../../config/supabase');
const { getHostBookings } = require('../../controllers/bookingController');
const { getTransactions } = require('../../controllers/vendorController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};

beforeEach(() => {
  supabaseAdmin.__builders.length = 0;
  supabaseAdmin.from.mockClear();
});

const hasPaidFilter = (b) =>
  b.eqCalls.some(([col, val]) => col === 'payment_status' && val === 'paid');

describe('vendor booking visibility — paid-only', () => {
  test('getHostBookings filters payment_status=paid', async () => {
    const req = { user: { id: 'host-1' }, query: {} };
    await getHostBookings(req, res());

    const builder = supabaseAdmin.__builders[0];
    expect(builder.eqCalls).toContainEqual(['host_id', 'host-1']);
    expect(hasPaidFilter(builder)).toBe(true);
  });

  test('vendor getTransactions filters payment_status=paid', async () => {
    const req = { user: { id: 'host-1' }, query: {} };
    await getTransactions(req, res());

    const builder = supabaseAdmin.__builders[0];
    expect(builder.eqCalls).toContainEqual(['host_id', 'host-1']);
    expect(hasPaidFilter(builder)).toBe(true);
  });

  test('getTransactions status param narrows booking status, never widens payment_status', async () => {
    const req = { user: { id: 'host-1' }, query: { status: 'unpaid' } };
    await getTransactions(req, res());

    const builder = supabaseAdmin.__builders[0];
    // payment_status is still hard-pinned to paid...
    expect(hasPaidFilter(builder)).toBe(true);
    // ...and the param is applied to the `status` (lifecycle) column, so it can
    // never be used to surface unpaid rows via payment_status.
    expect(builder.eqCalls).toContainEqual(['status', 'unpaid']);
    expect(builder.eqCalls).not.toContainEqual(['payment_status', 'unpaid']);
  });

  test('getTransactions applies date-range bounds on created_at (paid filter intact)', async () => {
    const req = {
      user: { id: 'host-1' },
      query: { dateFrom: '2026-06-01T00:00:00.000Z', dateTo: '2026-06-30T23:59:59.000Z' },
    };
    await getTransactions(req, res());

    const builder = supabaseAdmin.__builders[0];
    expect(builder.gteCalls).toContainEqual(['created_at', '2026-06-01T00:00:00.000Z']);
    expect(builder.lteCalls).toContainEqual(['created_at', '2026-06-30T23:59:59.000Z']);
    // The hard paid-only filter is never relaxed by the date params.
    expect(hasPaidFilter(builder)).toBe(true);
  });
});
