/**
 * subscriptionInvoice.test.js — v3.67 GST invoice generation wired into
 * recordSubscriptionCharge. Supabase, plan/config, ledger and invoiceService
 * are mocked; asserts generateInvoice fires once per recorded charge with the
 * subscription_payments row id and the plan price as the taxable value.
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({
  normalizeSlug: (s) => (s || '').toLowerCase(),
  getPlan: jest.fn(() => Promise.resolve({ slug: 'creator', name: 'Creator', monthly_price: 99, annual_price: 999 })),
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn(() => Promise.resolve({ gstRate: 0.18 })) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../services/razorpaySubscriptions', () => ({
  fetchPayment: jest.fn(() => Promise.resolve({ fee: 2360, tax: 360 })),
  fetchSubscriptionInvoices: jest.fn(() => Promise.resolve([])),
}));
jest.mock('../../services/ledger/journalTemplates', () => ({ subscriptionPaymentEntry: jest.fn(() => ({ lines: [] })) }));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/posthog', () => ({ capture: jest.fn(), resolveGuestId: jest.fn() }));
jest.mock('../../services/invoiceService', () => ({ generateInvoice: jest.fn(() => Promise.resolve({ id: 'inv-1' })) }));

const { supabaseAdmin } = require('../../config/supabase');
const { generateInvoice } = require('../../services/invoiceService');
const svc = require('../../services/subscriptionService');

const RZP_SUB = {
  id: 'sub_123',
  status: 'active',
  current_start: 1735689600, // 2025-01-01
  current_end: 1738368000,   // 2025-02-01
  notes: { vendor_id: 'vendor-1', plan: 'creator', cadence: 'monthly' },
};

// Mirrors subscriptionService.test.js's per-table mock. priorPayment toggles
// the idempotency branch; the inserted row gets id 'pay-row-1'.
const wireSupabase = ({ priorPayment = null, priorCount = 0, billingDetails = null } = {}) => {
  const insert = jest.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'pay-row-1' }, error: null }) }) }));

  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'subscription_payments') {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: priorPayment, error: null })); // idempotency
      c.then = (resolve) => resolve({ count: priorCount, data: [], error: null });          // count query
      c.insert = insert;
      return c;
    }
    if (table === 'profiles') {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: { name: 'Vendor', billing_details: billingDetails }, error: null }));
      return c;
    }
    return { select: jest.fn(() => ({ eq: jest.fn() })) };
  });
  return { insert };
};

beforeEach(() => jest.clearAllMocks());

describe('recordSubscriptionCharge → invoice generation', () => {
  test('generates a subscription invoice keyed on the inserted payment id', async () => {
    wireSupabase({ priorPayment: null, priorCount: 0 });

    const r = await svc.recordSubscriptionCharge({
      vendorId: 'vendor-1', planSlug: 'creator', cadence: 'monthly', rzpSub: RZP_SUB,
      payment: { id: 'pay_new', order_id: 'order_1', amount: 11682, fee: 2360, tax: 360 },
    });

    expect(r.recorded).toBe(true);
    expect(generateInvoice).toHaveBeenCalledTimes(1);
    const call = generateInvoice.mock.calls[0][0];
    expect(call.sourceType).toBe('subscription');
    expect(call.sourceId).toBe('pay-row-1');
    expect(call.taxableValue).toBe(99); // monthly_price
    expect(call.paymentId).toBe('pay_new');
  });

  test('billing_details on the profile flow through as the invoice buyer', async () => {
    wireSupabase({
      priorPayment: null, priorCount: 0,
      billingDetails: { name: 'Acme LLP', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', state_code: '27' },
    });

    await svc.recordSubscriptionCharge({
      vendorId: 'vendor-1', planSlug: 'creator', cadence: 'monthly', rzpSub: RZP_SUB,
      payment: { id: 'pay_new2', amount: 11682, fee: 2360, tax: 360 },
    });

    const buyer = generateInvoice.mock.calls[0][0].buyer;
    expect(buyer.name).toBe('Acme LLP');
    expect(buyer.gstin).toBe('27ABCDE1234F1Z5');
    expect(buyer.stateCode).toBe('27');
  });

  test('auth-token charge (amount << plan price) is skipped before invoicing', async () => {
    wireSupabase({ priorPayment: null, priorCount: 0 });

    const r = await svc.recordSubscriptionCharge({
      vendorId: 'vendor-1', planSlug: 'creator', cadence: 'monthly', rzpSub: RZP_SUB,
      payment: { id: 'pay_auth', amount: 118 }, // ₹1.18, well below ₹99 plan price
    });

    expect(r.recorded).toBe(false);
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  test('already-recorded payment is idempotent — no duplicate invoice', async () => {
    wireSupabase({ priorPayment: { id: 'pay-row-1' } });

    const r = await svc.recordSubscriptionCharge({
      vendorId: 'vendor-1', planSlug: 'creator', cadence: 'monthly', rzpSub: RZP_SUB,
      payment: { id: 'pay_dup', amount: 11682 },
    });

    expect(r.recorded).toBe(false);
    expect(generateInvoice).not.toHaveBeenCalled();
  });
});
