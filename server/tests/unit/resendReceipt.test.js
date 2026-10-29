/**
 * resendReceipt.test.js — subscriptionService.resendReceiptForPayment(), the
 * shared logic behind the admin endpoint and the CLI. Picks PURCHASED vs RENEWED
 * from the charge's kind and dispatches the receipt email.
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({
  normalizeSlug: (s) => (s || '').toLowerCase(),
  getPlan: jest.fn(() => Promise.resolve({ slug: 'creator', name: 'Creator', monthly_price: 99, annual_price: 999 })),
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn(() => Promise.resolve({ gstRate: 0.18 })) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../services/razorpaySubscriptions', () => ({}));
jest.mock('../../services/invoiceService', () => ({ generateInvoice: jest.fn(() => Promise.resolve({ id: 'inv-1' })) }));
jest.mock('../../services/ledger/journalTemplates', () => ({ subscriptionPaymentEntry: jest.fn(() => ({ lines: [] })) }));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/posthog', () => ({ capture: jest.fn(), resolveGuestId: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { send: notifySend } = require('../../services/notificationEngine');
const svc = require('../../services/subscriptionService');

// subscription_payments.maybeSingle → `row` (null = not found). profiles queries
// return a superset covering every select used downstream.
const wire = (row) => {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'subscription_payments') {
      const c = {};
      c.select = jest.fn(() => c); c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: row, error: null }));
      return c;
    }
    if (table === 'profiles') {
      const c = {};
      c.select = jest.fn(() => c); c.eq = jest.fn(() => c);
      const data = { name: 'Atish', email: 'a@x.com', billing_details: null, plan_expires_at: '2027-06-29T18:30:00Z' };
      c.maybeSingle = jest.fn(() => Promise.resolve({ data, error: null }));
      c.single = jest.fn(() => Promise.resolve({ data, error: null }));
      return c;
    }
    // invoices (generateInvoice is mocked, so no real query needed here)
    return { select: jest.fn(() => ({ eq: jest.fn(() => ({ in: jest.fn(() => Promise.resolve({ data: [], error: null })), maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })) };
  });
};

const ROW = (kind) => ({
  id: 'pay-row-1', vendor_id: 'v1', plan_type: 'creator', billing_cadence: 'monthly',
  kind, razorpay_payment_id: 'pay_X', billing_period_end: '2027-06-29',
});

beforeEach(() => jest.clearAllMocks());

describe('resendReceiptForPayment', () => {
  test('initial charge → resends SUBSCRIPTION_PURCHASED', async () => {
    wire(ROW('initial'));
    const r = await svc.resendReceiptForPayment('pay_X');
    expect(r).toEqual({ ok: true, event: 'SUBSCRIPTION_PURCHASED', vendorId: 'v1' });
    expect(notifySend).toHaveBeenCalledTimes(1);
    expect(notifySend.mock.calls[0][0].event).toBe('SUBSCRIPTION_PURCHASED');
    expect(notifySend.mock.calls[0][0].data.emailData.amount_charged).toBe('₹116.82');
  });

  test('renewal charge → resends SUBSCRIPTION_RENEWED', async () => {
    wire(ROW('renewal'));
    const r = await svc.resendReceiptForPayment('pay_X');
    expect(r.event).toBe('SUBSCRIPTION_RENEWED');
    expect(notifySend.mock.calls[0][0].event).toBe('SUBSCRIPTION_RENEWED');
  });

  test('unknown payment id → ok:false, no email', async () => {
    wire(null);
    const r = await svc.resendReceiptForPayment('pay_missing');
    expect(r.ok).toBe(false);
    expect(notifySend).not.toHaveBeenCalled();
  });

  test('missing payment id → ok:false', async () => {
    wire(null);
    const r = await svc.resendReceiptForPayment('');
    expect(r.ok).toBe(false);
  });
});
