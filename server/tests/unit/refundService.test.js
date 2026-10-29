// Unit tests for refundService.issueBookingRefund — the single place a booking
// refund is issued (admin action + auto-refund-on-cancel). All external deps
// mocked; nothing leaves the process.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/razorpayConfig', () => ({ getClient: jest.fn() }));
jest.mock('../../services/bookingCapture', () => ({
  recordBookingRefund: jest.fn().mockResolvedValue({ posted: true, transferReversed: true }),
}));

const { supabaseAdmin } = require('../../config/supabase');
const razorpayConfig = require('../../services/razorpayConfig');
const { recordBookingRefund } = require('../../services/bookingCapture');
const { issueBookingRefund, refundTierPct } = require('../../services/refundService');

// from('bookings').select().eq().maybeSingle() → the booking; a later
// from('bookings').update().eq() → { error }. Capture the update patch.
let updatePatch;
const wire = (booking, { updateError = null } = {}) => {
  updatePatch = undefined;
  supabaseAdmin.from.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn(function eq() { return this._afterUpdate ? Promise.resolve({ error: updateError }) : this; }),
    maybeSingle: jest.fn().mockResolvedValue({ data: booking, error: null }),
    update: jest.fn(function update(patch) { updatePatch = patch; this._afterUpdate = true; return this; }),
  }));
};

const mkClient = ({ amount_refunded = 0 } = {}) => ({
  payments: {
    fetch:  jest.fn().mockResolvedValue({ amount_refunded }),
    refund: jest.fn().mockResolvedValue({ id: 'rfnd_1' }),
  },
});

// paid booking 48h out: service ₹500, guest paid ₹590, payout still held.
const booking = {
  id: 'b1', razorpay_payment_id: 'pay_1', payment_status: 'paid', transfer_status: 'pending',
  customer_total: 590, scheduled_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  services: { price: 500 },
};

beforeEach(() => jest.clearAllMocks());

test('refundTierPct: 100% ≥24h, 50% 6–24h, 0 under 6h', () => {
  expect(refundTierPct(48)).toBe(1);
  expect(refundTierPct(24)).toBe(1);
  expect(refundTierPct(10)).toBe(0.5);
  expect(refundTierPct(6)).toBe(0.5);
  expect(refundTierPct(2)).toBe(0);
  expect(refundTierPct(-1)).toBe(0);
});

test('tiered ≥24h refunds the full service price, records it, stamps refunded_amount', async () => {
  wire(booking);
  const client = mkClient();
  razorpayConfig.getClient.mockResolvedValue(client);

  const r = await issueBookingRefund({ bookingId: 'b1', mode: 'tiered' });

  expect(client.payments.refund).toHaveBeenCalledWith('pay_1', expect.objectContaining({ amount: 50000 })); // ₹500
  expect(recordBookingRefund).toHaveBeenCalledWith(expect.objectContaining({ refundAmountPaise: 50000, refundId: 'rfnd_1', reverseTransfer: true }));
  expect(updatePatch).toMatchObject({ refunded_amount: 500 });
  expect(updatePatch.payment_status).toBeUndefined(); // partial → stays 'paid'
  expect(r).toMatchObject({ ok: true, amount: 500, refundId: 'rfnd_1', paymentStatus: 'paid' });
});

test('tiered 6–24h refunds 50% of the service price', async () => {
  wire({ ...booking, scheduled_at: new Date(Date.now() + 10 * 3600 * 1000).toISOString() });
  razorpayConfig.getClient.mockResolvedValue(mkClient());
  const r = await issueBookingRefund({ bookingId: 'b1', mode: 'tiered' });
  expect(r).toMatchObject({ ok: true, amount: 250 });
});

test('tiered <6h is not eligible — no Razorpay call', async () => {
  wire({ ...booking, scheduled_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString() });
  const client = mkClient();
  razorpayConfig.getClient.mockResolvedValue(client);
  const r = await issueBookingRefund({ bookingId: 'b1', mode: 'tiered' });
  expect(r).toEqual({ ok: false, reason: 'not_eligible' });
  expect(client.payments.refund).not.toHaveBeenCalled();
  expect(recordBookingRefund).not.toHaveBeenCalled();
});

test('full mode refunds the whole customer_total and flips payment_status=refunded', async () => {
  wire(booking);
  razorpayConfig.getClient.mockResolvedValue(mkClient());
  const r = await issueBookingRefund({ bookingId: 'b1', mode: 'full' });
  expect(r).toMatchObject({ ok: true, amount: 590, paymentStatus: 'refunded' });
  expect(updatePatch).toMatchObject({ refunded_amount: 590, payment_status: 'refunded' });
});

test('blocked when the host payout is already settled — never absorb', async () => {
  wire({ ...booking, transfer_status: 'processed' });
  const client = mkClient();
  razorpayConfig.getClient.mockResolvedValue(client);
  const r = await issueBookingRefund({ bookingId: 'b1', mode: 'full' });
  expect(r).toEqual({ ok: false, blocked: 'payout_settled' });
  expect(razorpayConfig.getClient).not.toHaveBeenCalled();
});

test('already refunded at Razorpay → blocks a stacked refund', async () => {
  wire(booking);
  razorpayConfig.getClient.mockResolvedValue(mkClient({ amount_refunded: 10000 }));
  const r = await issueBookingRefund({ bookingId: 'b1', mode: 'tiered' });
  expect(r).toMatchObject({ ok: false, reason: 'already_refunded' });
  expect(recordBookingRefund).not.toHaveBeenCalled();
});

test('not_paid / no_payment / booking_not_found short-circuit', async () => {
  wire(null);
  expect(await issueBookingRefund({ bookingId: 'x' })).toEqual({ ok: false, reason: 'booking_not_found' });
  wire({ ...booking, payment_status: 'unpaid' });
  expect(await issueBookingRefund({ bookingId: 'b1' })).toEqual({ ok: false, reason: 'not_paid' });
  wire({ ...booking, razorpay_payment_id: null });
  expect(await issueBookingRefund({ bookingId: 'b1' })).toEqual({ ok: false, reason: 'no_payment' });
});

test('schema fallback: a full refund still flips payment_status when refunded_amount column is missing', async () => {
  // First update (with refunded_amount) errors "column not found"; the fallback
  // update (payment_status only) succeeds.
  updatePatch = undefined;
  let call = 0;
  supabaseAdmin.from.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn(function eq() {
      if (!this._afterUpdate) return this;
      call += 1;
      return Promise.resolve(call === 1
        ? { error: { code: '42703', message: 'column "refunded_amount" does not exist' } }
        : { error: null });
    }),
    maybeSingle: jest.fn().mockResolvedValue({ data: booking, error: null }),
    update: jest.fn(function update(patch) { updatePatch = patch; this._afterUpdate = true; return this; }),
  }));
  razorpayConfig.getClient.mockResolvedValue(mkClient());
  const r = await issueBookingRefund({ bookingId: 'b1', mode: 'full' });
  expect(r).toMatchObject({ ok: true, paymentStatus: 'refunded' });
});
