'use strict';
// Membership money gets written down. Before this, a charge left no row at all, so
// the payout rail, the settlement balance and the TDS/TCS filings could not see it.
//
// The two rules under test are the ones that cost real money if they break:
//   one payment is one row (a duplicate would later become a duplicate payout)
//   bookkeeping never blocks entitlement (the member paid; they keep the access)

let mockInsertErr = null;
let mockHost = { id: 'h1', plan: 'free', host_entity_type: 'individual_huf', billing_details: {} };
let mockPanRow = null;
const inserted = [];

jest.mock('../../../config/supabase', () => {
  const builder = (table) => {
    const q = {
      _t: table, _not: false,
      select: () => q, eq: () => q, not: () => { q._not = true; return q; },
      insert: (row) => { q._row = row; return q; },
      maybeSingle: async () => {
        if (q._t === 'kyc_submissions') return { data: mockPanRow, error: null };
        if (q._t === 'profiles') return { data: mockHost, error: null };
        return { data: null, error: null };
      },
      single: async () => {
        if (q._row) {
          if (mockInsertErr) return { data: null, error: mockInsertErr };
          inserted.push({ table: q._t, row: q._row });
          return { data: { id: 'charge1' }, error: null };
        }
        return { data: null, error: null };
      },
    };
    return q;
  };
  return { supabaseAdmin: { from: (t) => builder(t) } };
});

jest.mock('../../../services/platformConfig', () => ({
  getConfig: async () => ({ platformFee: 10, gstRate: 0.18, tds_rate: 0.001, tcs_rate: 0.005 }),
}));
jest.mock('../../../services/planService', () => ({
  resolveVendorPlan: () => 'free',
  getPlan: async () => ({ slug: 'free', commission_percentage: 5 }),
}));
let mockWithholdingOn = false;
jest.mock('../../../services/featureFlags', () => ({
  isFeatureEnabled: async () => mockWithholdingOn,
}));
jest.mock('../../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn() }));

const charges = require('../../../services/membershipCharges');

const rzpSub = { id: 'sub_1', notes: { kind: 'membership', member_id: 'm1', host_id: 'h1', tier_id: 't1' } };
// ₹499 charged, Razorpay took ₹11.78 + ₹2.12 tax.
const rzpPayment = { id: 'pay_1', amount: 49900, fee: 1178, tax: 212, created_at: 1763000000 };

beforeEach(() => {
  inserted.length = 0; mockInsertErr = null; mockWithholdingOn = false; mockPanRow = null;
  mockHost = { id: 'h1', plan: 'free', host_entity_type: 'individual_huf', billing_details: {} };
});

describe('recordSubscriptionCharge', () => {
  test('writes the money snapshot for a charged subscription', async () => {
    const r = await charges.recordSubscriptionCharge({ rzpSub, rzpPayment });
    expect(r.recorded).toBe(true);
    const row = inserted[0].row;
    expect(inserted[0].table).toBe('membership_charges');
    expect(row.kind).toBe('subscription');
    expect(row.razorpay_payment_id).toBe('pay_1');
    expect(row.customer_total).toBe(499);
    expect(row.platform_fee_amount).toBe(0);      // no fee on top of a tier price
    expect(row.commission_applied).toBe(24.95);   // 5% of 499
    expect(row.razorpay_fee_actual).toBe(11.78);
    // legacy withholding (flag off): 1% + 1% of 499
    expect(row.tds_amount).toBe(4.99);
    expect(row.tcs_amount).toBe(4.99);
    // 499 - 24.95 - 11.78 - 4.99 - 4.99
    expect(row.vendor_amount).toBe(452.29);
  });

  test('statutory rates apply when tds_tcs_v2 is on and the host has PAN', async () => {
    mockWithholdingOn = true;
    mockPanRow = { user_id: 'h1' };
    await charges.recordSubscriptionCharge({ rzpSub, rzpPayment });
    const row = inserted[0].row;
    expect(row.tds_amount).toBe(0.5);  // 0.1% of 499
    expect(row.tcs_amount).toBe(0);    // no GSTIN -> no TCS
  });

  test('a redelivered webhook does not write a second row', async () => {
    mockInsertErr = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const r = await charges.recordSubscriptionCharge({ rzpSub, rzpPayment });
    expect(r.duplicate).toBe(true);
    expect(r.recorded).toBe(false);
  });

  test('subscription.activated with no payment records nothing', async () => {
    const r = await charges.recordSubscriptionCharge({ rzpSub, rzpPayment: null });
    expect(r.recorded).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  test('a missing table degrades to a no-op, never a throw', async () => {
    mockInsertErr = { message: 'relation "membership_charges" does not exist' };
    const r = await charges.recordSubscriptionCharge({ rzpSub, rzpPayment });
    expect(r.recorded).toBe(false);
    expect(r.reason).toBe('missing_table');
  });

  test('an unexpected DB failure is swallowed — entitlement must not depend on bookkeeping', async () => {
    mockInsertErr = { code: '08006', message: 'connection failure' };
    const r = await charges.recordSubscriptionCharge({ rzpSub, rzpPayment });
    expect(r.recorded).toBe(false);
    expect(r.error).toMatch(/connection failure/);
  });

  test('a subscription without membership notes records nothing', async () => {
    const r = await charges.recordSubscriptionCharge({ rzpSub: { id: 's', notes: {} }, rzpPayment });
    expect(r.recorded).toBe(false);
    expect(inserted).toHaveLength(0);
  });
});

describe('recordUpgradeCharge', () => {
  const notes = { member_id: 'm1', host_id: 'h1', tier_id: 't_founding', due_now_inr: 1249.5 };

  test('records the prorated difference as its own charge', async () => {
    const r = await charges.recordUpgradeCharge({
      notes, orderId: 'order_up1', paymentId: 'pay_up1', amountInr: 1249.5,
    });
    expect(r.recorded).toBe(true);
    const row = inserted[0].row;
    expect(row.kind).toBe('upgrade');
    expect(row.razorpay_order_id).toBe('order_up1');
    expect(row.customer_total).toBe(1249.5);
    expect(row.commission_applied).toBe(62.48); // 5% of 1249.5
    expect(row.vendor_amount).toBeGreaterThan(0);
  });

  test('a replayed verify does not write a second row', async () => {
    mockInsertErr = { code: '23505', message: 'duplicate key' };
    const r = await charges.recordUpgradeCharge({ notes, orderId: 'order_up1', amountInr: 1249.5 });
    expect(r.duplicate).toBe(true);
  });

  test('a zero amount records nothing', async () => {
    const r = await charges.recordUpgradeCharge({ notes, orderId: 'order_up1', amountInr: 0 });
    expect(r.recorded).toBe(false);
    expect(inserted).toHaveLength(0);
  });
});
