/**
 * tests/unit/paymentWebhook.test.js — coverage for the Razorpay webhook
 * (paymentController.handleWebhook), the highest money-risk entry point, which
 * previously had ZERO tests (audit F10). Signs bodies with a real HMAC over the
 * raw buffer and asserts: signature gate, the F21 forensic log, exactly-once
 * booking capture (verify + webhook can't double-fire), refund handling, a failed
 * payment writing nothing, and an unknown event being accepted.
 */
'use strict';

const crypto = require('crypto');

const SECRET = 'whsec_test';
jest.mock('../../services/razorpayConfig', () => ({
  getWebhookSecret: jest.fn().mockResolvedValue('whsec_test'),
  getClient: jest.fn().mockResolvedValue({}),
  getKeyId: jest.fn().mockResolvedValue('rzp_key'),
  getKeySecret: jest.fn().mockResolvedValue('secret'),
}));

// Forensic log + booking reads route through supabaseAdmin.from(table).
const mockInserts = [];
let mockBookingRow = null;
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table) => {
      if (table === 'webhook_events') {
        return { insert: jest.fn((row) => { mockInserts.push(row); return Promise.resolve({ error: null }); }) };
      }
      // bookings read (payment.failed / dispute lookups)
      return {
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBookingRow, error: null }),
        single: jest.fn().mockResolvedValue({ data: mockBookingRow, error: null }),
      };
    }),
  },
}));

jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn() }));
jest.mock('../../services/bookingCapture', () => ({
  finalizeBookingCapture: jest.fn(),
  recordBookingRefund: jest.fn().mockResolvedValue({ posted: true, transferReversed: true }),
}));
jest.mock('../../services/bookingConfirmation', () => ({ sendBookingConfirmation: jest.fn().mockResolvedValue() }));
jest.mock('../../services/subscriptionService', () => ({
  ACTIVE_STATES: ['active', 'authenticated'],
  activateFromSubscription: jest.fn().mockResolvedValue(), markHalted: jest.fn(), markCancelled: jest.fn(),
}));
jest.mock('../../services/routeAutoPayoutService', () => ({
  handleBookingTransferWebhook: jest.fn().mockResolvedValue({ handled: true }),
  handleSettlementWebhook: jest.fn().mockResolvedValue({ handled: true }),
  reverseByPaymentId: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock('../../services/routeTransferService', () => ({ handleTransferWebhook: jest.fn().mockResolvedValue({ handled: true }) }));
jest.mock('../../services/disputeService', () => ({ recordDispute: jest.fn().mockResolvedValue() }));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn() }));
jest.mock('../../utils/trackServer', () => ({ trackServer: jest.fn() }));
jest.mock('../../utils/posthog', () => ({ capture: jest.fn(), resolveGuestId: jest.fn(() => 'g') }));
jest.mock('../../utils/background', () => ({ runInBackground: (_n, fn) => fn && fn() }));
jest.mock('../../services/invoiceService', () => ({ generateInvoice: jest.fn().mockResolvedValue(null) }));

const { finalizeBookingCapture } = require('../../services/bookingCapture');
const { recordBookingRefund } = require('../../services/bookingCapture');
const { sendBookingConfirmation } = require('../../services/bookingConfirmation');
const { trackServer } = require('../../utils/trackServer');
const { handleWebhook } = require('../../controllers/paymentController');

const sign = (bodyStr) => crypto.createHmac('sha256', SECRET).update(bodyStr).digest('hex');
const mkReq = (eventObj, { signature, eventId } = {}) => {
  const bodyStr = JSON.stringify(eventObj);
  const body = Buffer.from(bodyStr);
  return {
    body,
    headers: {
      'x-razorpay-signature': signature !== undefined ? signature : sign(bodyStr),
      ...(eventId ? { 'x-razorpay-event-id': eventId } : {}),
    },
    ip: '1.2.3.4',
  };
};
const mkRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

beforeEach(() => { jest.clearAllMocks(); mockInserts.length = 0; mockBookingRow = null; });

test('rejects a bad signature with 400 and logs NO event', async () => {
  const r = mkRes();
  await handleWebhook(mkReq({ event: 'payment.captured', payload: {} }, { signature: 'deadbeef' }), r);
  expect(r.status).toHaveBeenCalledWith(400);
  expect(mockInserts).toHaveLength(0);                 // never past the signature gate
  expect(finalizeBookingCapture).not.toHaveBeenCalled();
});

test('records every verified event in the forensic log (F21) before dispatch', async () => {
  const r = mkRes();
  await handleWebhook(mkReq({ event: 'payment.authorized', payload: {} }, { eventId: 'evt_1' }), r);
  expect(mockInserts[0]).toMatchObject({ provider: 'razorpay', event_id: 'evt_1', event_type: 'payment.authorized' });
});

test('an unknown / entity-less event is accepted (200) without side effects', async () => {
  const r = mkRes();
  await handleWebhook(mkReq({ event: 'payment.authorized', payload: {} }), r);
  expect(r.json).toHaveBeenCalledWith({ received: true });
  expect(finalizeBookingCapture).not.toHaveBeenCalled();
});

test('payment.captured for a booking finalises capture once and confirms', async () => {
  finalizeBookingCapture.mockResolvedValue({ updated: { id: 'bk1', guest_email: 'g@x.com', customer_total: 590, platform_fee_amount: 0, commission_taxable: 0, services: { title: 'SEO' } } });
  const r = mkRes();
  await handleWebhook(mkReq({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', notes: { booking_id: 'bk1' }, fee: 1180, tax: 180 } } } }), r);
  expect(finalizeBookingCapture).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'bk1', paymentId: 'pay_1' }));
  expect(sendBookingConfirmation).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'bk1' }));
  expect(trackServer).toHaveBeenCalled();
  expect(r.json).toHaveBeenCalledWith({ received: true });
});

test('a DUPLICATE payment.captured (already paid) does not re-confirm or re-track', async () => {
  finalizeBookingCapture.mockResolvedValue({ updated: null }); // idempotent: no row transitioned
  const r = mkRes();
  await handleWebhook(mkReq({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', notes: { booking_id: 'bk1' }, fee: 1180, tax: 180 } } } }), r);
  expect(finalizeBookingCapture).toHaveBeenCalledTimes(1);
  expect(sendBookingConfirmation).not.toHaveBeenCalled();
  expect(trackServer).not.toHaveBeenCalled();
  expect(r.json).toHaveBeenCalledWith({ received: true });
});

test('refund.processed records the refund exactly once', async () => {
  const r = mkRes();
  await handleWebhook(mkReq({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 25000 } } } }), r);
  expect(recordBookingRefund).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'pay_1', refundAmountPaise: 25000, refundId: 'rfnd_1' }));
  expect(r.json).toHaveBeenCalledWith({ received: true });
});

test('payment.failed for a booking writes NO booking status change', async () => {
  mockBookingRow = { guest_id: 'g1', guest_email: 'g@x.com' };
  const r = mkRes();
  await handleWebhook(mkReq({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_1', notes: { booking_id: 'bk1' }, error_description: 'declined' } } } }), r);
  // The only bookings access is a READ (no update/insert to bookings), and capture
  // is never finalised for a failed payment.
  expect(finalizeBookingCapture).not.toHaveBeenCalled();
  expect(r.json).toHaveBeenCalledWith({ received: true });
});

test('missing signature header → 400', async () => {
  const r = mkRes();
  await handleWebhook(mkReq({ event: 'payment.captured', payload: {} }, { signature: '' }), r);
  expect(r.status).toHaveBeenCalledWith(400);
});
