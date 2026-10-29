/**
 * tests/unit/commissionInvoice.test.js — marketplace v4.
 * generateCommissionInvoice mints the commission tax invoice (BAS → host) for a
 * paid booking that carried commission (free-plan hosts). Best-effort: skips when
 * there is no commission (paid plans). buyer = the host.
 */
'use strict';

// Mock preamble mirrors bookingInvoice.test.js so paymentController imports cleanly.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn() }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: String(e && e.message || e) }) }));
jest.mock('../../utils/razorpaySignature', () => ({ verifySignature: jest.fn() }));
jest.mock('../../services/razorpayConfig', () => ({ getKeySecret: jest.fn(), getClient: jest.fn(), getWebhookSecret: jest.fn() }));
jest.mock('../../services/planService', () => ({ normalizeSlug: (s) => (s || '').toLowerCase(), isFreeSlug: () => false, getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/razorpaySubscriptions', () => ({ getClient: jest.fn() }));
jest.mock('../../services/subscriptionService', () => ({ activateFromSubscription: jest.fn() }));
jest.mock('../../services/ledger/journalTemplates', () => ({ subscriptionPaymentEntry: jest.fn(() => ({ lines: [] })), orderPaymentEntry: jest.fn(() => ({ lines: [] })) }));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: jest.fn((v) => v) }));

const mockGen = jest.fn(() => Promise.resolve({ id: 'com-1', access_token: 'tok-c' }));
jest.mock('../../services/invoiceService', () => ({ generateInvoice: (...a) => mockGen(...a) }));

const { supabaseAdmin } = require('../../config/supabase');
const { generateCommissionInvoice } = require('../../controllers/paymentController');

// profiles fetch chain: from('profiles').select('*').eq('id',..).single()
const profileChain = (result) => ({
  select: () => ({ eq: () => ({ single: () => Promise.resolve(result) }) }),
});

beforeEach(() => jest.clearAllMocks());

test('mints a commission invoice to the host for a booking with commission', async () => {
  supabaseAdmin.from.mockReturnValue(profileChain({ data: { name: 'Atish Host', business_name: null } }));

  const booking = {
    id: 'b1', host_id: 'h1', razorpay_payment_id: 'pay_1', paid_at: '2026-08-06T00:00:00.000Z',
    commission_taxable: 42.37, commission_gst: 7.63,
  };
  const result = await generateCommissionInvoice(booking);

  expect(mockGen).toHaveBeenCalledTimes(1);
  const arg = mockGen.mock.calls[0][0];
  expect(arg.sourceType).toBe('commission');
  expect(arg.sourceId).toBe('b1');
  expect(arg.buyer.name).toBe('Atish Host');
  expect(arg.taxableValue).toBe(42.37);
  expect(arg.gstAmount).toBe(7.63);
  expect(result).toEqual({ id: 'com-1', access_token: 'tok-c' });
});

test('skips when there is no commission (paid plan)', async () => {
  const result = await generateCommissionInvoice({ id: 'b2', host_id: 'h1', commission_taxable: 0, commission_gst: 0 });
  expect(mockGen).not.toHaveBeenCalled();
  expect(result).toBeNull();
});

test('host name lookup failure still mints with a fallback name', async () => {
  supabaseAdmin.from.mockReturnValue(profileChain({ data: null, error: { message: 'not found' } }));
  const result = await generateCommissionInvoice({ id: 'b3', host_id: 'h9', commission_taxable: 10, commission_gst: 1.8 });
  expect(mockGen).toHaveBeenCalledTimes(1);
  expect(mockGen.mock.calls[0][0].buyer.name).toBe('Host');
  expect(result).toEqual({ id: 'com-1', access_token: 'tok-c' });
});
