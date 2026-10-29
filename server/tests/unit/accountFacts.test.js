'use strict';
// Guardrail for the corrected account-fact logic (PR: crm-logic-corrections):
//   #1 earnings = host GROSS booking revenue (customer_total), not platform fee
//   #2 plan price = the cadence they bought (monthly vs annual)
//   #5 Retained also counts long-tenure paid hosts
//   #7 paid = real paid plan + activation evidence, excluding comped/Supreme
// computeAccountFacts + grossEarningsPaise are pure; planService's pure helpers are real.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: {}, supabase: {} }));

const { computeAccountFacts, grossEarningsPaise } = require('../../services/crm/leadService');

const PRO = { plan: 'professional', razorpay_subscription_id: 'sub_1', subscription_status: 'active', onboarding_completed: true };
const planPro = { annual_price: 3650, monthly_price: 555 };

describe('grossEarningsPaise (#1 — host revenue, not platform fee)', () => {
  test('sums customer_total on non-dead bookings, in paise', () => {
    expect(grossEarningsPaise([{ customer_total: 1000 }, { customer_total: 2000, status: 'completed' }])).toBe(300000);
  });
  test('drops cancelled / no_show / refunded', () => {
    expect(grossEarningsPaise([
      { customer_total: 1000, status: 'cancelled' },
      { customer_total: 500, status: 'refunded' },
      { customer_total: 300 },
    ])).toBe(30000);
  });
});

describe('computeAccountFacts — isPaid (#7)', () => {
  test('paid plan + Razorpay sub → paid', () => {
    expect(computeAccountFacts({ profile: PRO, plan: planPro }).isPaid).toBe(true);
  });
  test('paid plan + only a charge (no sub id) → paid (legacy monthly)', () => {
    expect(computeAccountFacts({ profile: { plan: 'creator', subscription_status: 'active' }, plan: planPro, subsCount: 1 }).isPaid).toBe(true);
  });
  test('paid plan + only plan_activated_at (no Razorpay evidence) → NOT paid', () => {
    // plan_activated_at is stamped by onboarding/admin without any charge, so it is
    // no longer accepted as money evidence — real annual subs carry a sub id.
    expect(computeAccountFacts({ profile: { plan: 'professional', plan_activated_at: '2025-01-01' }, plan: planPro }).isPaid).toBe(false);
  });
  test('free plan → NOT paid', () => {
    expect(computeAccountFacts({ profile: { plan: 'starter', plan_activated_at: '2025-01-01' }, plan: planPro }).isPaid).toBe(false);
  });
  test('Supreme (comped) → NOT paid, even with a subscription', () => {
    expect(computeAccountFacts({ profile: { plan: 'supreme', razorpay_subscription_id: 'sub_x', plan_activated_at: '2025-01-01' }, plan: planPro }).isPaid).toBe(false);
  });
  test('cancelled → NOT paid', () => {
    expect(computeAccountFacts({ profile: { ...PRO, subscription_status: 'cancelled' }, plan: planPro }).isPaid).toBe(false);
  });
  test('non-free plan but NO activation evidence → NOT paid', () => {
    expect(computeAccountFacts({ profile: { plan: 'professional' }, plan: planPro }).isPaid).toBe(false);
  });
});

describe('computeAccountFacts — plan price by cadence (#2)', () => {
  test('annual → annual price', () => {
    expect(computeAccountFacts({ profile: { ...PRO, billing_cadence: 'annual' }, plan: planPro }).planPricePaise).toBe(365000);
  });
  test('monthly → monthly price', () => {
    expect(computeAccountFacts({ profile: { ...PRO, billing_cadence: 'monthly' }, plan: planPro }).planPricePaise).toBe(55500);
  });
  test('missing cadence → annual (default)', () => {
    expect(computeAccountFacts({ profile: PRO, plan: planPro }).planPricePaise).toBe(365000);
  });
});

describe('computeAccountFacts — long tenure (#5, Retained-eligible)', () => {
  const now = Date.parse('2026-06-01T00:00:00Z');
  test('annual sub activated > 1yr ago → longTenure', () => {
    expect(computeAccountFacts({ profile: { ...PRO, billing_cadence: 'annual', plan_activated_at: '2025-01-01' }, plan: planPro, now }).longTenure).toBe(true);
  });
  test('annual sub activated < 1yr ago → not longTenure', () => {
    expect(computeAccountFacts({ profile: { ...PRO, billing_cadence: 'annual', plan_activated_at: '2026-03-01' }, plan: planPro, now }).longTenure).toBe(false);
  });
  test('monthly sub activated > 1 month ago → longTenure', () => {
    expect(computeAccountFacts({ profile: { ...PRO, billing_cadence: 'monthly', plan_activated_at: '2026-04-01' }, plan: planPro, now }).longTenure).toBe(true);
  });
  test('unpaid host is never longTenure', () => {
    expect(computeAccountFacts({ profile: { plan: 'starter', plan_activated_at: '2020-01-01' }, plan: planPro, now }).longTenure).toBe(false);
  });
});

describe('computeAccountFacts — no isEnterprise (dropped, #3)', () => {
  test('does not emit an isEnterprise fact', () => {
    expect(computeAccountFacts({ profile: PRO, plan: planPro }).isEnterprise).toBeUndefined();
  });
});
