/**
 * tests/unit/bookingCapture.test.js — security audit H-3.
 * The shared finaliser used by verify + webhook + reconciler: flips a captured
 * booking to paid/confirmed, finalises the vendor payout with the real Razorpay
 * fee subtracted, and posts the ledger. Uses the REAL pricingEngine so the money
 * math is actually exercised; supabase + ledger are mocked.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/ledger/journalTemplates', () => ({
  orderPaymentEntry: jest.fn((a) => ({ description: 'ORDER_PAYMENT', lines: [], args: a })),
  refundEntry: jest.fn((a) => ({ description: 'REFUND', lines: [], args: a })),
}));
jest.mock('../../services/ledger/postingService', () => ({
  postSafe: jest.fn(() => Promise.resolve('je-1')),
  post: jest.fn(() => Promise.resolve('je-refund')),
}));
jest.mock('../../services/routeAutoPayoutService', () => ({
  reverseByPaymentId: jest.fn(() => Promise.resolve({ ok: true })),
  createHeldTransferForBooking: jest.fn(() => Promise.resolve()),
}));

const { supabaseAdmin } = require('../../config/supabase');
const { orderPaymentEntry, refundEntry } = require('../../services/ledger/journalTemplates');
const { postSafe, post } = require('../../services/ledger/postingService');
const { reverseByPaymentId } = require('../../services/routeAutoPayoutService');
const { calculateVendorPayout } = require('../../lib/pricingEngine');
const { finalizeBookingCapture, recordBookingRefund } = require('../../services/bookingCapture');

// Update chain that captures the patch and resolves to `result` when awaited.
const chainOf = (result) => {
  const c = { patch: null };
  c.update = jest.fn((p) => { c.patch = p; return c; });
  c.eq = jest.fn(() => c);
  c.neq = jest.fn(() => c);
  c.select = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  return c;
};

// v4 marketplace snapshot: free-plan host, ₹1000, 5% GST-inclusive commission.
const PRICING = {
  service_price: 1000, commission_applied: 50, commission_gst: 7.63, commission_taxable: 42.37,
  tds_amount: 10, tcs_amount: 10,
  platform_fee_amount: 10, platform_fee_gst: 1.8, customer_total: 1011.8, host_id: 'h1',
};

beforeEach(() => jest.clearAllMocks());

test('finalises payout with the real fee subtracted + posts the ledger', async () => {
  const chain = chainOf({ data: [{ id: 'b1', host_id: 'h1', services: { title: 'X' } }], error: null });
  supabaseAdmin.from.mockReturnValue(chain);

  const r = await finalizeBookingCapture({
    bookingId: 'b1', paymentId: 'pay_1', feePaise: 2360, taxPaise: 360, pricing: PRICING,
  });

  // fee 2360p = ₹23.60 (incl ₹3.60 tax) → excl-tax ₹20.00
  expect(chain.patch.payment_status).toBe('paid');
  expect(chain.patch.status).toBe('confirmed');
  expect(chain.patch.razorpay_payment_id).toBe('pay_1');
  expect(chain.patch.razorpay_tax_actual).toBeCloseTo(3.6, 5);
  expect(chain.patch.razorpay_fee_actual).toBeCloseTo(20, 5);
  // v4: payout = price − commission(incl GST) − PG − TDS − TCS
  expect(chain.patch.vendor_amount).toBe(calculateVendorPayout(1000, 50, 23.6, 10, 10));
  expect(chain.patch.tds_amount).toBe(10);
  expect(chain.patch.tcs_amount).toBe(10);
  expect(chain.patch.commission_taxable).toBe(42.37);
  // idempotency + anti-resurrection guards present
  expect(chain.neq).toHaveBeenCalledWith('payment_status', 'paid');
  expect(chain.neq).toHaveBeenCalledWith('status', 'cancelled');
  expect(postSafe).toHaveBeenCalledTimes(1);
  expect(postSafe.mock.calls[0][0].sourceType).toBe('ORDER_PAYMENT');
  expect(r.updated.id).toBe('b1');
});

test('no fee available → payout finalises without subtracting a fee (fee=0)', async () => {
  const chain = chainOf({ data: [{ id: 'b1' }], error: null });
  supabaseAdmin.from.mockReturnValue(chain);

  await finalizeBookingCapture({ bookingId: 'b1', paymentId: 'pay_1', pricing: PRICING });

  expect(chain.patch.razorpay_fee_actual).toBe(0);
  expect(chain.patch.razorpay_tax_actual).toBe(0);
  expect(chain.patch.vendor_amount).toBe(calculateVendorPayout(1000, 50, 0, 10, 10));
});

test('legacy row without TDS/TCS/taxable snapshot → recomputed at default rate', async () => {
  const chain = chainOf({ data: [{ id: 'b1' }], error: null });
  supabaseAdmin.from.mockReturnValue(chain);

  // Pre-v3.93 snapshot: no tds_amount / tcs_amount / commission_taxable.
  const legacy = { service_price: 1000, commission_applied: 50, commission_gst: 7.63,
    platform_fee_amount: 10, platform_fee_gst: 1.8, customer_total: 1011.8, host_id: 'h1' };
  await finalizeBookingCapture({ bookingId: 'b1', paymentId: 'pay_1', pricing: legacy });

  expect(chain.patch.tds_amount).toBe(10);        // 1% of 1000, recomputed
  expect(chain.patch.tcs_amount).toBe(10);
  expect(chain.patch.commission_taxable).toBe(42.37);
  expect(chain.patch.vendor_amount).toBe(calculateVendorPayout(1000, 50, 0, 10, 10));
});

test('idempotent: zero rows transitioned → updated null, no ledger post', async () => {
  const chain = chainOf({ data: [], error: null });
  supabaseAdmin.from.mockReturnValue(chain);

  const r = await finalizeBookingCapture({ bookingId: 'b1', paymentId: 'pay_1', feePaise: 100, pricing: PRICING });

  expect(r.updated).toBeNull();
  expect(postSafe).not.toHaveBeenCalled();
});

test('skips the ledger for a row without a customer_total snapshot', async () => {
  const chain = chainOf({ data: [{ id: 'b1' }], error: null });
  supabaseAdmin.from.mockReturnValue(chain);

  await finalizeBookingCapture({
    bookingId: 'b1', paymentId: 'pay_1', feePaise: 100,
    pricing: { ...PRICING, customer_total: 0 },
  });

  expect(postSafe).not.toHaveBeenCalled();
});

describe('recordBookingRefund', () => {
  // maybeSingle chain returning one booking row.
  const singleOf = (row) => {
    const c = {};
    c.select = jest.fn(() => c);
    c.eq = jest.fn(() => c);
    c.maybeSingle = jest.fn(() => Promise.resolve({ data: row, error: null }));
    return c;
  };
  const BK = {
    id: 'b1', host_id: 'h1', razorpay_payment_id: 'pay_1',
    vendor_amount: 959.76, commission_taxable: 0, commission_gst: 0,
    platform_fee_amount: 10, platform_fee_gst: 1.8, tds_amount: 10, tcs_amount: 10,
    customer_total: 1011.8, services: { price: 1000 },
  };

  test('by bookingId: posts REFUND from the snapshot and reverses the held payout', async () => {
    supabaseAdmin.from.mockReturnValue(singleOf(BK));
    const r = await recordBookingRefund({ bookingId: 'b1', refundAmount: 1000, refundId: 'rfnd_1' });
    expect(r.posted).toBe(true);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'REFUND' }));
    expect(refundEntry).toHaveBeenCalledWith(expect.objectContaining({
      booking_id: 'b1', refund_amount: 1000, service_price: 1000, vendor_amount: 959.76,
    }));
    expect(reverseByPaymentId).toHaveBeenCalledWith('pay_1', expect.any(String));
    expect(r.transferReversed).toBe(true);
  });

  test('reverse_payout=false skips the transfer reversal', async () => {
    supabaseAdmin.from.mockReturnValue(singleOf(BK));
    await recordBookingRefund({ bookingId: 'b1', refundAmount: 500, reverseTransfer: false });
    expect(reverseByPaymentId).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalled();
  });

  test('unknown booking → not posted, no ledger write', async () => {
    supabaseAdmin.from.mockReturnValue(singleOf(null));
    const r = await recordBookingRefund({ bookingId: 'nope', refundAmount: 100 });
    expect(r.posted).toBe(false);
    expect(r.reason).toBe('booking_not_found');
    expect(post).not.toHaveBeenCalled();
  });
});
