jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn() }));
jest.mock('../../services/ledger/journalTemplates', () => ({
  orderPaymentEntry: jest.fn(() => ({ description: 'o', lines: [] })),
  subscriptionPaymentEntry: jest.fn(() => ({ description: 's', lines: [] })),
  productPaymentEntry: jest.fn(() => ({ description: 'p', lines: [] })),
}));
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { supabaseAdmin } = require('../../config/supabase');
const { postSafe } = require('../../services/ledger/postingService');
const { orderPaymentEntry } = require('../../services/ledger/journalTemplates');
const reconciler = require('../../services/ledger/ledgerReconciler');

// A chain whose terminal awaited value resolves to `result`. Every builder
// method returns the same chain; awaiting it (via .then) yields `result`.
const makeChain = (result) => {
  const chain = {};
  for (const m of ['select', 'eq', 'gt', 'is', 'not', 'in', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve) => resolve(result);
  return chain;
};

beforeEach(() => jest.clearAllMocks());

test('reposts a paid booking that has no journal entry', async () => {
  const booking = {
    id: 'b1', host_id: 'v1', paid_at: '2026-06-13T00:00:00Z',
    customer_total: 1011.8, vendor_amount: 917.4, platform_fee_amount: 10,
    platform_fee_gst: 1.8, commission_applied: 50, commission_gst: 9,
    razorpay_fee_actual: 20, razorpay_tax_actual: 3.6, services: { price: 1000 },
  };
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'bookings') return makeChain({ data: [booking], error: null });
    if (table === 'journal_entries') return makeChain({ data: [], error: null }); // none posted yet
    if (table === 'subscription_payments') return makeChain({ data: [], error: null });
    return makeChain({ data: [], error: null });
  });
  postSafe.mockResolvedValue('entry-uuid');

  const result = await reconciler.reconcile();
  expect(postSafe).toHaveBeenCalledTimes(1);
  expect(postSafe.mock.calls[0][0].sourceType).toBe('ORDER_PAYMENT');
  expect(postSafe.mock.calls[0][0].sourceId).toBe('b1');
  expect(result.reposted).toBe(1);
});

test('skips a booking that already has a journal entry', async () => {
  const booking = { id: 'b1', host_id: 'v1', paid_at: '2026-06-13T00:00:00Z', customer_total: 1011.8, vendor_amount: 917.4, platform_fee_amount: 10, platform_fee_gst: 1.8, commission_applied: 50, commission_gst: 9, razorpay_fee_actual: 20, razorpay_tax_actual: 3.6, services: { price: 1000 } };
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'bookings') return makeChain({ data: [booking], error: null });
    if (table === 'journal_entries') return makeChain({ data: [{ source_id: 'b1' }], error: null }); // already posted
    if (table === 'subscription_payments') return makeChain({ data: [], error: null });
    return makeChain({ data: [], error: null });
  });
  const result = await reconciler.reconcile();
  expect(postSafe).not.toHaveBeenCalled();
  expect(result.reposted).toBe(0);
});

test('reposts a paid product purchase with no journal entry', async () => {
  const purchase = {
    id: 'pp1', host_id: 'v1', created_at: '2026-06-25T00:00:00Z',
    amount_paid: 500, platform_fee: 10, customer_total: 510, vendor_amount: 487.96,
    razorpay_fee_actual: 10.2, razorpay_tax_actual: 1.84,
  };
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'product_purchases') return makeChain({ data: [purchase], error: null });
    if (table === 'journal_entries') return makeChain({ data: [], error: null });
    return makeChain({ data: [], error: null });
  });
  postSafe.mockResolvedValue('e');
  const result = await reconciler.reconcile();
  expect(postSafe).toHaveBeenCalledTimes(1);
  expect(postSafe.mock.calls[0][0].sourceType).toBe('PRODUCT_PAYMENT');
  expect(postSafe.mock.calls[0][0].sourceId).toBe('pp1');
  expect(result.reposted).toBe(1);
});

test('skips a product purchase that already has a journal entry', async () => {
  const purchase = { id: 'pp1', host_id: 'v1', created_at: '2026-06-25T00:00:00Z', amount_paid: 500, platform_fee: 10, customer_total: 510, vendor_amount: 487.96, razorpay_fee_actual: 10.2, razorpay_tax_actual: 1.84 };
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'product_purchases') return makeChain({ data: [purchase], error: null });
    if (table === 'journal_entries') return makeChain({ data: [{ source_id: 'pp1' }], error: null });
    return makeChain({ data: [], error: null });
  });
  const result = await reconciler.reconcile();
  expect(postSafe).not.toHaveBeenCalled();
  expect(result.reposted).toBe(0);
});

test('reposts a subscription payment with no journal entry', async () => {
  const sub = { id: 's1', vendor_id: 'v1', plan_price: 999, gst_amount: 179.82, total_charged: 1178.82, razorpay_fee: 23.58, razorpay_tax: 4.24, paid_at: '2026-06-13T00:00:00Z', status: 'paid', plan_type: 'creator' };
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'bookings') return makeChain({ data: [], error: null });
    if (table === 'subscription_payments') return makeChain({ data: [sub], error: null });
    if (table === 'journal_entries') return makeChain({ data: [], error: null });
    return makeChain({ data: [], error: null });
  });
  postSafe.mockResolvedValue('e');
  const result = await reconciler.reconcile();
  expect(postSafe).toHaveBeenCalledTimes(1);
  expect(postSafe.mock.calls[0][0].sourceType).toBe('SUBSCRIPTION_PAYMENT');
  expect(result.reposted).toBe(1);
});

// LOOPHOLE REGRESSION: the heal used to drop v4 TDS/TCS/commission_taxable, so
// the healed ORDER_PAYMENT came out unbalanced and the DB RPC rejected it — the
// booking's money could NEVER reach the books. Assert the reconciler now passes
// those fields into the template.
test('order heal passes v4 TDS/TCS/commission_taxable into orderPaymentEntry', async () => {
  const booking = {
    id: 'b9', host_id: 'v1', paid_at: '2026-08-22T00:00:00Z',
    customer_total: 1011.8, vendor_amount: 959.76, platform_fee_amount: 10, platform_fee_gst: 1.8,
    commission_applied: 0, commission_gst: 0, commission_taxable: 0,
    tds_amount: 10, tcs_amount: 10, razorpay_fee_actual: 20.24, razorpay_tax_actual: 0,
    services: { price: 1000 },
  };
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'bookings') return makeChain({ data: [booking], error: null });
    if (table === 'journal_entries') return makeChain({ data: [], error: null });
    if (table === 'subscription_payments') return makeChain({ data: [], error: null });
    return makeChain({ data: [], error: null });
  });
  postSafe.mockResolvedValue('e');
  await reconciler.reconcile();
  const snap = orderPaymentEntry.mock.calls[0][0];
  expect(snap.tds_amount).toBe(10);
  expect(snap.tcs_amount).toBe(10);
  expect(snap.commission_taxable).toBe(0);
  expect(snap.service_price).toBe(1000);
});

// The pure mapper builds a v4-complete snapshot.
test('orderSnapshotFromBooking carries the fields the heal used to drop', () => {
  const s = reconciler.orderSnapshotFromBooking({
    id: 'b1', host_id: 'v1', commission_taxable: 42.37, tds_amount: 10, tcs_amount: 10,
    services: { price: 1000 },
  });
  expect(s.tds_amount).toBe(10);
  expect(s.tcs_amount).toBe(10);
  expect(s.commission_taxable).toBe(42.37);
  expect(s.service_price).toBe(1000);
});
