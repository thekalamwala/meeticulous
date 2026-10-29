/**
 * tests/unit/bookingInvoice.test.js — v3.67 GST invoicing.
 * generateBookingInvoice mints the platform-fee tax invoice for a paid booking
 * (verify + webhook capture paths share this helper). Best-effort: skips when
 * there's no platform fee to invoice (free/zero-fee bookings).
 */
'use strict';

// Mock preamble mirrors verifyPaymentLoadStub.test.js so paymentController imports.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn() }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: String(e && e.message || e) }) }));
jest.mock('../../utils/razorpaySignature', () => ({ verifySignature: jest.fn() }));
jest.mock('../../services/razorpayConfig', () => ({ getKeySecret: jest.fn(), getClient: jest.fn(), getWebhookSecret: jest.fn() }));
jest.mock('../../services/planService', () => ({ normalizeSlug: (s) => (s || '').toLowerCase(), isFreeSlug: (s) => ['starter','explorer','free','starter_legacy'].includes((s || '').toLowerCase().trim()), getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/razorpaySubscriptions', () => ({ getClient: jest.fn() }));
jest.mock('../../services/subscriptionService', () => ({ activateFromSubscription: jest.fn() }));
jest.mock('../../services/ledger/journalTemplates', () => ({ subscriptionPaymentEntry: jest.fn(() => ({ lines: [] })), orderPaymentEntry: jest.fn(() => ({ lines: [] })) }));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: jest.fn((v) => v) }));

const mockGen = jest.fn(() => Promise.resolve({ id: 'inv-1', access_token: 'tok-1' }));
jest.mock('../../services/invoiceService', () => ({ generateInvoice: (...a) => mockGen(...a) }));

const { generateBookingInvoice } = require('../../controllers/paymentController');

beforeEach(() => jest.clearAllMocks());

test('mints an invoice for a paid booking with a platform fee', async () => {
  const booking = {
    id: 'b1',
    razorpay_payment_id: 'pay_1',
    platform_fee_amount: 10,
    platform_fee_gst: 1.8,
    guest_name: 'Guest Name',
    billing_details: {
      name: 'Buyer Name',
      gstin: '29ABCDE1234F1Z5',
      state_code: '29',
      address: '123 MG Road',
    },
  };

  const result = await generateBookingInvoice(booking);

  expect(mockGen).toHaveBeenCalledTimes(1);
  const arg = mockGen.mock.calls[0][0];
  expect(arg.sourceType).toBe('booking');
  expect(arg.sourceId).toBe('b1');
  expect(arg.taxableValue).toBe(10);
  expect(arg.gstAmount).toBe(1.8);
  expect(arg.buyer).toMatchObject({
    name: 'Buyer Name',
    gstin: '29ABCDE1234F1Z5',
    stateCode: '29',
    address: '123 MG Road',
  });
  expect(result).toEqual({ id: 'inv-1', access_token: 'tok-1' });
});

test('skips minting when the platform fee is zero', async () => {
  const booking = {
    id: 'b2',
    razorpay_payment_id: 'pay_2',
    platform_fee_amount: 0,
    platform_fee_gst: 0,
    guest_name: 'Guest Name',
    billing_details: null,
  };

  const result = await generateBookingInvoice(booking);

  expect(mockGen).not.toHaveBeenCalled();
  expect(result).toBeNull();
});
