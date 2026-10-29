/**
 * rescheduleFeeBinding.test.js — security tests for the reschedule-fee order-binding fix.
 *
 * Attack vector: a guest pays a reschedule fee on Booking A (host fee ₹10), then reuses
 * those valid Razorpay fee tokens (fee_order_id / fee_payment_id / fee_signature) to
 * reschedule Booking B which has a ₹500 fee. The HMAC signature only covers
 * fee_order_id|fee_payment_id — it does NOT bind to which booking the order was for,
 * nor the amount.
 *
 * The fix: after the HMAC passes, fetch the Razorpay order and assert that
 * notes.booking_id matches the booking being rescheduled AND the order amount equals
 * vendorFee * 100. Both checks must pass; either failing → 402.
 */
'use strict';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../config/google', () => ({
  updateCalendarEvent: jest.fn().mockResolvedValue({}),
  createCalendarEvent: jest.fn(),
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/cryptoTokens', () => ({ decryptToken: (v) => v, decrypt: (v) => v }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn() }));
jest.mock('../../utils/httpError', () => ({
  safeError: (res, e) => res.status(500).json({ message: String(e?.message || e) }),
}));
jest.mock('../../utils/razorpaySignature', () => ({ verifySignature: jest.fn() }));
jest.mock('../../services/razorpayConfig', () => ({
  getKeySecret: jest.fn().mockResolvedValue('test-secret'),
  getClient: jest.fn(),
}));
jest.mock('../../services/ledger/postingService', () => ({
  post: jest.fn().mockResolvedValue('je1'),
  postSafe: jest.fn().mockResolvedValue(),
}));

const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
const featureFlags = require('../../services/featureFlags');
const { verifySignature } = require('../../utils/razorpaySignature');
const razorpayConfig = require('../../services/razorpayConfig');
const { rescheduleBooking } = require('../../controllers/bookingController');

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockRes = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

const FUTURE = '2099-06-01T10:00:00.000Z';

/** Build a booking fixture where the host charges vendorFee and the guest is on reschedule_count N. */
const makeBooking = ({ bookingId = 'booking-b', rescheduleCount = 1, vendorFee = 500 } = {}) => ({
  id: bookingId,
  host_id: 'host-1',
  guest_id: 'guest-1',
  status: 'confirmed',
  reschedule_count: rescheduleCount,
  scheduled_at: '2098-11-01T05:00:00.000Z',
  google_event_id: null,
  services: { duration: 30, grace_period_minutes: 10 },
  'profiles!bookings_host_id_fkey': {
    id: 'host-1',
    reschedule_fee: vendorFee,
    google_calendar_connected: false,
    google_refresh_token: null,
    google_access_token: null,
  },
});

// Module-level override: set to a row object to simulate a prior reschedule_payment existing.
// Reset to null in beforeEach so happy-path tests are unaffected.
let priorFeeRow = null;

/** Wire the Supabase mock: booking read returns `booking`; conflicts = []; update succeeds.
 *  Table-aware: reschedule_payments.maybeSingle resolves priorFeeRow (null by default),
 *  other tables use the standard booking single / timezone maybySingle / conflict then. */
const wireSupabase = (booking) => {
  mockFrom.mockImplementation((table) => {
    const c = {};
    c.select = jest.fn(() => c);
    c.eq = jest.fn(() => c);
    c.neq = jest.fn(() => c);
    c.gte = jest.fn(() => c);
    c.lte = jest.fn(() => c);
    c.limit = jest.fn(() => c);
    c.order = jest.fn(() => c);
    c.update = jest.fn(() => c);
    c.insert = jest.fn(() => c);
    if (table === 'reschedule_payments') {
      // idempotency pre-check: returns priorFeeRow when set, else null (no prior payment)
      c.single = jest.fn().mockResolvedValue({ data: null, error: null });
      c.maybeSingle = jest.fn().mockResolvedValue({ data: priorFeeRow });
      c.then = (resolve) => resolve({ data: [], error: null });
    } else {
      c.single = jest.fn().mockResolvedValue({ data: booking, error: null });
      c.maybeSingle = jest.fn().mockResolvedValue({
        data: { timezone: 'Asia/Kolkata', buffer_minutes: 0 },
      });
      // awaiting the chain directly (conflict query) resolves to empty list
      c.then = (resolve) => resolve({ data: [], error: null });
    }
    return c;
  });
};

/** Build a mock Razorpay client whose orders.fetch returns the given order stub. */
const mockRzpClient = (orderStub) => ({
  orders: { fetch: jest.fn().mockResolvedValue(orderStub) },
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset idempotency override so happy-path tests see no prior payment
  priorFeeRow = null;
  // Reschedule feature on; reschedule_fee feature on by default
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  // Signature always passes (we are testing the BINDING check, not the sig check)
  verifySignature.mockReturnValue(true);
});

// ═════════════════════════════════════════════════════════════════════════════
// SECURITY: token-reuse attack — order was created for a DIFFERENT booking
// ═════════════════════════════════════════════════════════════════════════════
test('SECURITY: rejects when fee order was created for a different booking_id', async () => {
  const bookingBeingRescheduled = makeBooking({ bookingId: 'booking-b', vendorFee: 500 });
  wireSupabase(bookingBeingRescheduled);

  // The Razorpay order was created for booking-a (attacker's cheap booking), not booking-b
  razorpayConfig.getClient.mockResolvedValue(
    mockRzpClient({
      id: 'order_fee_a',
      amount: Math.round(10 * 100), // ₹10 order (cheap booking's fee)
      notes: { booking_id: 'booking-a', kind: 'reschedule_fee' }, // WRONG booking
    })
  );

  const req = {
    params: { id: 'booking-b' },
    user: { id: 'guest-1' },
    body: {
      scheduled_at: FUTURE,
      fee_order_id: 'order_fee_a',
      fee_payment_id: 'pay_fee_123',
      fee_signature: 'sig_valid',
    },
  };
  const res = mockRes();
  await rescheduleBooking(req, res);

  // Must return 402 — the binding check should block this
  expect(res.status).toHaveBeenCalledWith(402);
  expect(res.json.mock.calls[0][0].message).toMatch(/reschedule fee does not match this booking/i);
});

// ═════════════════════════════════════════════════════════════════════════════
// SECURITY: underpay attack — correct booking_id but lower amount in the order
// ═════════════════════════════════════════════════════════════════════════════
test('SECURITY: rejects when fee order amount is lower than the required fee', async () => {
  const bookingBeingRescheduled = makeBooking({ bookingId: 'booking-b', vendorFee: 500 });
  wireSupabase(bookingBeingRescheduled);

  // Order references the correct booking but was created with ₹10 instead of ₹500
  razorpayConfig.getClient.mockResolvedValue(
    mockRzpClient({
      id: 'order_fee_underpay',
      amount: Math.round(10 * 100), // ₹10 — insufficient
      notes: { booking_id: 'booking-b', kind: 'reschedule_fee' }, // correct booking
    })
  );

  const req = {
    params: { id: 'booking-b' },
    user: { id: 'guest-1' },
    body: {
      scheduled_at: FUTURE,
      fee_order_id: 'order_fee_underpay',
      fee_payment_id: 'pay_fee_456',
      fee_signature: 'sig_valid',
    },
  };
  const res = mockRes();
  await rescheduleBooking(req, res);

  expect(res.status).toHaveBeenCalledWith(402);
  expect(res.json.mock.calls[0][0].message).toMatch(/reschedule fee does not match this booking/i);
});

// ═════════════════════════════════════════════════════════════════════════════
// SECURITY: order fetch failure → rejected (no rescheduling without verification)
// ═════════════════════════════════════════════════════════════════════════════
test('SECURITY: rejects when Razorpay order fetch throws (network / not found)', async () => {
  const bookingBeingRescheduled = makeBooking({ bookingId: 'booking-b', vendorFee: 500 });
  wireSupabase(bookingBeingRescheduled);

  razorpayConfig.getClient.mockResolvedValue({
    orders: { fetch: jest.fn().mockRejectedValue(new Error('Network error')) },
  });

  const req = {
    params: { id: 'booking-b' },
    user: { id: 'guest-1' },
    body: {
      scheduled_at: FUTURE,
      fee_order_id: 'order_fee_xyz',
      fee_payment_id: 'pay_fee_xyz',
      fee_signature: 'sig_valid',
    },
  };
  const res = mockRes();
  await rescheduleBooking(req, res);

  expect(res.status).toHaveBeenCalledWith(402);
  expect(res.json.mock.calls[0][0].message).toMatch(/reschedule fee order not found/i);
});

// ═════════════════════════════════════════════════════════════════════════════
// HAPPY PATH: matching booking_id + correct amount → reschedule succeeds
// ═════════════════════════════════════════════════════════════════════════════
test('HAPPY PATH: booking_id + amount match → binding check passes and reschedule completes', async () => {
  const bookingBeingRescheduled = makeBooking({ bookingId: 'booking-b', vendorFee: 500 });
  wireSupabase(bookingBeingRescheduled);

  // Order matches exactly: correct booking, correct amount (₹500 = 50000 paise)
  razorpayConfig.getClient.mockResolvedValue(
    mockRzpClient({
      id: 'order_fee_correct',
      amount: Math.round(500 * 100), // 50000 paise — correct
      notes: { booking_id: 'booking-b', kind: 'reschedule_fee' },
    })
  );

  const req = {
    params: { id: 'booking-b' },
    user: { id: 'guest-1' },
    body: {
      scheduled_at: FUTURE,
      fee_order_id: 'order_fee_correct',
      fee_payment_id: 'pay_fee_ok',
      fee_signature: 'sig_valid',
    },
  };
  const res = mockRes();
  await rescheduleBooking(req, res);

  // Must NOT return 402 — the reschedule should proceed
  const statusCalls = res.status.mock.calls.map((c) => c[0]);
  expect(statusCalls).not.toContain(402);

  // Signature was checked
  expect(verifySignature).toHaveBeenCalled();

  // Razorpay order was fetched to verify binding
  const rzpClient = await razorpayConfig.getClient.mock.results[0]?.value;
  expect(rzpClient.orders.fetch).toHaveBeenCalledWith('order_fee_correct');
});

// ═════════════════════════════════════════════════════════════════════════════
// CONTROL: first reschedule (count=0) never hits the fee path
// ═════════════════════════════════════════════════════════════════════════════
test('CONTROL: first reschedule (count=0) is free; fee-binding path never entered', async () => {
  const booking = makeBooking({ bookingId: 'booking-b', rescheduleCount: 0, vendorFee: 500 });
  wireSupabase(booking);

  // razorpayConfig.getClient should not be called for the binding check
  razorpayConfig.getClient.mockResolvedValue(mockRzpClient({ notes: {} }));

  const req = {
    params: { id: 'booking-b' },
    user: { id: 'guest-1' },
    body: { scheduled_at: FUTURE },
  };
  const res = mockRes();
  await rescheduleBooking(req, res);

  // No 402
  const statusCalls = res.status.mock.calls.map((c) => c[0]);
  expect(statusCalls).not.toContain(402);
});

// ═════════════════════════════════════════════════════════════════════════════
// SECURITY: replay attack — same fee_payment_id already exists in reschedule_payments
// ═════════════════════════════════════════════════════════════════════════════
test('SECURITY: replay rejected when fee_payment_id already used in reschedule_payments', async () => {
  const bookingBeingRescheduled = makeBooking({ bookingId: 'booking-b', vendorFee: 500 });

  // Simulate a prior reschedule_payment row with the same payment id
  priorFeeRow = { id: 'rp1' };
  wireSupabase(bookingBeingRescheduled);

  // Razorpay order matches correctly (binding check passes) — we want to reach the idempotency check
  razorpayConfig.getClient.mockResolvedValue(
    mockRzpClient({
      id: 'order_fee_correct',
      amount: Math.round(500 * 100), // correct amount
      notes: { booking_id: 'booking-b', kind: 'reschedule_fee' }, // correct booking
    })
  );

  const req = {
    params: { id: 'booking-b' },
    user: { id: 'guest-1' },
    body: {
      scheduled_at: FUTURE,
      fee_order_id: 'order_fee_correct',
      fee_payment_id: 'pay_fee_already_used',
      fee_signature: 'sig_valid',
    },
  };
  const res = mockRes();
  await rescheduleBooking(req, res);

  // Must return 409 — replay blocked before booking is mutated
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json.mock.calls[0][0].message).toMatch(/already been used/i);

  // The booking UPDATE must NOT have been called
  const allFromCalls = mockFrom.mock.calls.map((c) => c[0]);
  const bookingFromCalls = mockFrom.mock.results
    .filter((_, i) => allFromCalls[i] === 'bookings')
    .map((r) => r.value);
  const anyUpdateCalled = bookingFromCalls.some((c) => c.update.mock.calls.length > 0);
  expect(anyUpdateCalled).toBe(false);
});
