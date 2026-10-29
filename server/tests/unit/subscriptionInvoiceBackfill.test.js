/**
 * subscriptionInvoiceBackfill.test.js — backfillMissingInvoices() heals paid
 * subscription charges that never got a GST invoice (best-effort generation
 * failed at charge time). Asserts it only mints for charges with no existing
 * invoice, and is a no-op once every charge is invoiced.
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({ normalizeSlug: (s) => (s || '').toLowerCase(), getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn(() => Promise.resolve({ gstRate: 0.18 })) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));
jest.mock('../../services/razorpaySubscriptions', () => ({}));
jest.mock('../../services/invoiceService', () => ({ generateInvoice: jest.fn(() => Promise.resolve({ id: 'inv-new' })) }));

const { supabaseAdmin } = require('../../config/supabase');
const { generateInvoice } = require('../../services/invoiceService');
const svc = require('../../services/subscriptionService');

// charges: paid subscription_payments rows. invoiced: source_ids that already
// have an invoice. profile billing_details returned for the buyer lookup.
const wire = ({ charges, invoiced }) => {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'subscription_payments') {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.order = jest.fn(() => c);
      c.limit = jest.fn(() => Promise.resolve({ data: charges, error: null }));
      return c;
    }
    if (table === 'invoices') {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.in = jest.fn(() => Promise.resolve({ data: invoiced.map((id) => ({ source_id: id })), error: null }));
      return c;
    }
    if (table === 'profiles') {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: { name: 'Vendor', billing_details: null }, error: null }));
      return c;
    }
    return { select: jest.fn(() => ({ eq: jest.fn() })) };
  });
};

const CHARGE = (id) => ({ id, vendor_id: 'v1', plan_price: 999, gst_amount: 179.82, paid_at: '2026-06-30T13:16:00Z', razorpay_payment_id: `pay_${id}` });

beforeEach(() => jest.clearAllMocks());

describe('backfillMissingInvoices', () => {
  test('mints only for charges without an invoice', async () => {
    wire({ charges: [CHARGE('a'), CHARGE('b'), CHARGE('c')], invoiced: ['b'] });

    const r = await svc.backfillMissingInvoices();

    expect(r).toEqual({ minted: 2, scanned: 3 });
    expect(generateInvoice).toHaveBeenCalledTimes(2);
    const ids = generateInvoice.mock.calls.map((c) => c[0].sourceId).sort();
    expect(ids).toEqual(['a', 'c']);
    // money read straight off the row, never recomputed from a rate
    expect(generateInvoice.mock.calls[0][0].taxableValue).toBe(999);
    expect(generateInvoice.mock.calls[0][0].gstAmount).toBe(179.82);
  });

  test('no-op when every charge already has an invoice', async () => {
    wire({ charges: [CHARGE('a'), CHARGE('b')], invoiced: ['a', 'b'] });

    const r = await svc.backfillMissingInvoices();

    expect(r).toEqual({ minted: 0, scanned: 2 });
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  test('no charges → clean zero', async () => {
    wire({ charges: [], invoiced: [] });
    const r = await svc.backfillMissingInvoices();
    expect(r).toEqual({ minted: 0, scanned: 0 });
  });
});
