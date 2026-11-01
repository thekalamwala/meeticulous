'use strict';
// WON = signup + paid for a subscription. Booking commission is revenue but not
// a win. These pin the two pure helpers that encode that rule.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { isPaidSubscriber, conversionPatch } = require('../../services/crm/attribution');

describe('isPaidSubscriber', () => {
  test('a successful subscription payment wins', () => {
    expect(isPaidSubscriber(null, true)).toBe(true);
  });
  test('an active Razorpay mandate wins (even with no payment row)', () => {
    expect(isPaidSubscriber({ razorpay_subscription_id: 'sub_123' }, false)).toBe(true);
  });
  test('a paid-tier plan wins (legacy/annual with no payment row)', () => {
    expect(isPaidSubscriber({ plan: 'studio' }, false)).toBe(true);
    expect(isPaidSubscriber({ plan: 'host_plus' }, false)).toBe(true);
  });
  test('free tiers and no plan do NOT win', () => {
    for (const p of ['free', 'starter', 'starter_legacy', 'explorer', '', null, undefined]) {
      expect(isPaidSubscriber({ plan: p }, false)).toBe(false);
    }
    expect(isPaidSubscriber(null, false)).toBe(false);
  });
});

// conversionPatch now ONLY backfills converted_at. Lead STATUS is owned by the
// lifecycle engine/resolver + churn hook (single writer) — attribution no longer
// promotes/demotes status, so it can't regress the new money states (won/ROI/…).
describe('conversionPatch (converted_at backfill only)', () => {
  test('won + a money state missing converted_at → backfill it', () => {
    expect(conversionPatch({ won: true, status: 'paid', convertedAt: null, wonAt: '2025-01-01' })).toEqual({ converted_at: '2025-01-01' });
    expect(conversionPatch({ won: true, status: 'won', convertedAt: null, wonAt: '2025-01-01' })).toEqual({ converted_at: '2025-01-01' });
  });
  test('won + a money state that already has converted_at → no change', () => {
    expect(conversionPatch({ won: true, status: 'paid', convertedAt: '2024-12-01', wonAt: '2025-01-01' })).toEqual({});
    expect(conversionPatch({ won: true, status: require('../../services/crm/lifecycleRules').ROI, convertedAt: '2024-12-01', wonAt: '2025-01-01' })).toEqual({});
  });
  test('won but still in a Presale stage → NO status write (engine promotes it)', () => {
    expect(conversionPatch({ won: true, status: 'qualified', convertedAt: null, wonAt: '2025-01-01' })).toEqual({});
  });
  test('won but lost/dnc → never touched', () => {
    expect(conversionPatch({ won: true, status: 'lost', convertedAt: null, wonAt: '2025-01-01' })).toEqual({});
    expect(conversionPatch({ won: true, status: 'do_not_contact', convertedAt: null, wonAt: '2025-01-01' })).toEqual({});
  });
  test('not won → never demotes (churn/manual owns that)', () => {
    expect(conversionPatch({ won: false, status: 'paid', convertedAt: '2025-01-01', wonAt: null })).toEqual({});
    expect(conversionPatch({ won: false, status: 'contacted', convertedAt: null, wonAt: null })).toEqual({});
  });
});
