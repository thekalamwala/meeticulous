/**
 * subscriptionAmountTruth.test.js — regression guards for the two P0 renewal bugs
 * found in the billing audit:
 *   #3 the recorded/invoiced amount must equal what Razorpay ACTUALLY captured,
 *      not the CURRENT DB plan price (which may have changed after the mandate).
 *   #2 a price INCREASE must not silently discard a genuine old-price renewal via
 *      the auth-token guard.
 * planService returns the RAISED price (199/mo); the mandate still captures the old
 * gross (₹116.82 = ₹99 + 18%).
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({
  normalizeSlug: (s) => (s || '').toLowerCase(),
  // Plan price was RAISED to 199 after the mandate was created at 99.
  getPlan: jest.fn(() => Promise.resolve({ slug: 'creator', name: 'Creator', monthly_price: 199, annual_price: 1999 })),
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn(() => Promise.resolve({ gstRate: 0.18 })) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../services/razorpaySubscriptions', () => ({
  fetchPayment: jest.fn(() => Promise.resolve({ fee: 0, tax: 0 })),
  fetchSubscriptionInvoices: jest.fn(() => Promise.resolve([])),
}));
jest.mock('../../services/ledger/journalTemplates', () => ({ subscriptionPaymentEntry: jest.fn(() => ({ lines: [] })) }));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/posthog', () => ({ capture: jest.fn(), resolveGuestId: jest.fn() }));
jest.mock('../../services/invoiceService', () => ({ generateInvoice: jest.fn(() => Promise.resolve({ id: 'inv-1' })) }));
jest.mock('../../services/referralService', () => ({ onReferredCharge: jest.fn(() => Promise.resolve()) }));

const { supabaseAdmin } = require('../../config/supabase');
const { generateInvoice } = require('../../services/invoiceService');
const svc = require('../../services/subscriptionService');

const RZP_SUB = {
  id: 'sub_1', current_start: 1735689600, current_end: 1738368000,
  notes: { vendor_id: 'v1', plan: 'creator', cadence: 'monthly' },
};

const wire = ({ priorCount = 1 } = {}) => {
  const insert = jest.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'row-1' }, error: null }) }) }));
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'subscription_payments') {
      const c = {};
      c.select = jest.fn(() => c); c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
      c.then = (resolve) => resolve({ count: priorCount, data: [], error: null });
      c.insert = insert;
      return c;
    }
    if (table === 'profiles') {
      const c = {};
      c.select = jest.fn(() => c); c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: { name: 'V', billing_details: { state_code: '21' } }, error: null }));
      return c;
    }
    return { select: jest.fn(() => ({ eq: jest.fn() })) };
  });
  return { insert };
};

beforeEach(() => jest.clearAllMocks());

describe('renewal amount-truth (#3) + renewal-discard (#2)', () => {
  test('records the ACTUAL captured gross, not the raised DB price', async () => {
    const { insert } = wire();
    // Mandate captures the OLD gross (₹99 + 18% = ₹116.82 = 11682 paise).
    const r = await svc.recordSubscriptionCharge({
      vendorId: 'v1', planSlug: 'creator', cadence: 'monthly', rzpSub: RZP_SUB,
      payment: { id: 'pay_old_price', amount: 11682 },
    });
    expect(r.recorded).toBe(true);

    const row = insert.mock.calls[0][0];
    expect(row.total_charged).toBe(116.82);       // == captured, NOT 199+GST
    expect(row.plan_price).toBe(99);              // backed out of the gross
    expect(row.gst_amount).toBe(17.82);
    // Invoice taxable value matches the captured base, not the raised price.
    expect(generateInvoice.mock.calls[0][0].taxableValue).toBe(99);
  });

  test('a genuine old-price renewal is NOT discarded after a price increase', async () => {
    const { insert } = wire();
    const r = await svc.recordSubscriptionCharge({
      vendorId: 'v1', planSlug: 'creator', cadence: 'monthly', rzpSub: RZP_SUB,
      payment: { id: 'pay_renew', amount: 11682 }, // < raised ₹199 base, but a real charge
    });
    expect(r.recorded).toBe(true);
    expect(insert).toHaveBeenCalled();
  });

  test('a real UPI auth-token charge (₹1.18) is still skipped', async () => {
    const { insert } = wire();
    const r = await svc.recordSubscriptionCharge({
      vendorId: 'v1', planSlug: 'creator', cadence: 'monthly', rzpSub: RZP_SUB,
      payment: { id: 'pay_auth', amount: 118 },
    });
    expect(r.recorded).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  test('no captured amount → falls back to the expected breakdown', async () => {
    const { insert } = wire();
    await svc.recordSubscriptionCharge({
      vendorId: 'v1', planSlug: 'creator', cadence: 'monthly', rzpSub: RZP_SUB,
      payment: { id: 'pay_no_amount' }, // webhook entity without an amount
    });
    const row = insert.mock.calls[0][0];
    expect(row.plan_price).toBe(199);             // current DB price fallback
    expect(row.total_charged).toBe(234.82);       // 199 + 18%
  });
});
