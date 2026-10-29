'use strict';
// Honest conversion metric + follow-up window bounds. Pure, no DB.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { conversionSummary, followupWindow } = require('../../services/crm/leadService');

describe('conversionSummary', () => {
  test('paid customers = every MONEY state (Relations is subscription-only)', () => {
    // paid(Subscribed) + activated(Onboarded) + won all count; Presale statuses do not.
    expect(conversionSummary({ paid: 10, activated: 5, won: 2, qualified: 30, new: 100 }, 200))
      .toEqual({ paidCustomers: 17, activeFree: 0, conversionRate: 8.5 });
  });
  test('does NOT count Presale statuses (new / contacted / qualified) as paid', () => {
    const { paidCustomers } = conversionSummary({ qualified: 40, contacted: 20, new: 40 }, 100);
    expect(paidCustomers).toBe(0);
  });
  test('zero total → 0% (no divide-by-zero)', () => {
    expect(conversionSummary({}, 0)).toEqual({ paidCustomers: 0, activeFree: 0, conversionRate: 0 });
  });
});

describe('followupWindow', () => {
  const now = new Date('2026-08-27T15:00:00Z');
  test('overdue → strictly before now', () => {
    expect(followupWindow('overdue', now)).toEqual({ to: now.toISOString(), inclusive: false });
  });
  test('today → up to and including end of today', () => {
    const { to, inclusive } = followupWindow('today', now);
    expect(inclusive).toBe(true);
    expect(new Date(to) > now).toBe(true);      // end-of-day is after now
  });
  test('open → no date bound', () => {
    expect(followupWindow('open', now)).toEqual({});
  });
});
