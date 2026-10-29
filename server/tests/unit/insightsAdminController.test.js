/**
 * Unit tests for insightsAdminController.getKpis — owned KPI tiles.
 * Mocks supabaseAdmin with thenable query builders (select/eq chain + awaitable).
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({
  safeError: jest.fn((res, err) => res.status(500).json({ message: err?.message || 'error' })),
}));

const { supabaseAdmin } = require('../../config/supabase');
const { getKpis } = require('../../controllers/insightsAdminController');

// Query builder that supports .select().eq() chaining and resolves to `result`.
const makeQuery = (result) => {
  const q = {
    select: jest.fn(() => q),
    eq: jest.fn(() => q),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
};

const res = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

beforeEach(() => jest.clearAllMocks());

test('computes revenue, conversion, bookings and host tiles from Postgres rows', async () => {
  const nowIso = new Date().toISOString();
  const bookings = [
    { id: 1, payment_status: 'paid',   platform_fee_amount: 10, commission_applied: 5,  created_at: nowIso },
    { id: 2, payment_status: 'paid',   platform_fee_amount: 20, commission_applied: 0,  created_at: nowIso },
    { id: 3, payment_status: 'unpaid', platform_fee_amount: 0,  commission_applied: 0,  created_at: nowIso },
    { id: 4, payment_status: 'failed', platform_fee_amount: 0,  commission_applied: 0,  created_at: nowIso },
  ];
  supabaseAdmin.from
    .mockReturnValueOnce(makeQuery({ data: bookings, error: null }))            // bookings
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))                  // product_purchases
    .mockReturnValueOnce(makeQuery({ data: [{ id: 'h1', created_at: nowIso }, { id: 'h2', created_at: nowIso }], error: null })) // hosts
    .mockReturnValueOnce(makeQuery({ count: 42, error: null }));                // guests

  const r = res();
  await getKpis({}, r);

  expect(r.json).toHaveBeenCalledTimes(1);
  const p = r.json.mock.calls[0][0];
  // Revenue is EX-GST. commission_applied is GST-INCLUSIVE, so the ₹5 commission
  // contributes ₹4.24 (₹5 / 1.18), not ₹5 — the old ₹35 counted the commission's
  // ₹0.76 of GST as revenue while the same rupees were also reported as tax.
  expect(p.revenue.total).toBe(34.24);       // (10 + 4.24) + 20
  expect(p.revenue.last30).toBe(34.24);
  expect(p.bookings).toEqual({ total: 4, paid: 2, last30: 2 });
  expect(p.conversion).toEqual({ created: 4, paid: 2, rate: 50 }); // 2/4 = 50%
  expect(p.hosts).toEqual({ total: 2, new30: 2 });
  expect(p.guests).toEqual({ total: 42 });
  expect(p.generatedAt).toEqual(expect.any(String));
});

test('falls back to fee-only select when commission_applied column is missing', async () => {
  const nowIso = new Date().toISOString();
  // First bookings query errors with missing-column; controller retries.
  const errQuery = makeQuery({ data: null, error: { message: 'column bookings.commission_applied does not exist' } });
  const retryQuery = makeQuery({ data: [{ id: 1, payment_status: 'paid', platform_fee_amount: 10, created_at: nowIso }], error: null });
  supabaseAdmin.from
    .mockReturnValueOnce(errQuery)                                              // bookings (errors)
    .mockReturnValueOnce(retryQuery)                                            // bookings retry
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))                  // product_purchases
    .mockReturnValueOnce(makeQuery({ data: [], error: null }))                  // hosts
    .mockReturnValueOnce(makeQuery({ count: 0, error: null }));                 // guests

  const r = res();
  await getKpis({}, r);
  const p = r.json.mock.calls[0][0];
  expect(p.revenue.total).toBe(10);
  expect(p.bookings.paid).toBe(1);
});

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
  test('rounds to 1 decimal', () => expect(median([1.2, 2.2])).toBe(1.7));
});

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
