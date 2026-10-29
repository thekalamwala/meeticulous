'use strict';
// Refund-aware revenue + exact phone match. Pure helpers, no DB.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { computeRevenuePaise, matchByPhone } = require('../../services/crm/attribution');

describe('computeRevenuePaise', () => {
  test('sums successful subs + live bookings (rupees → paise)', () => {
    const { paise, subTimes } = computeRevenuePaise({
      subs: [{ total_charged: 100, paid_at: '2025-01-01', status: 'paid' }],
      bookings: [{ platform_fee_amount: 10, status: 'completed' }],
    });
    expect(paise).toBe(11000);
    expect(subTimes).toEqual(['2025-01-01']);
  });

  test('drops cancelled / no_show / refunded booking fees', () => {
    const { paise } = computeRevenuePaise({
      bookings: [
        { platform_fee_amount: 10, status: 'completed' },
        { platform_fee_amount: 10, status: 'cancelled' },
        { platform_fee_amount: 10, status: 'no_show' },
        { platform_fee_amount: 10, status: 'refunded' },
      ],
    });
    expect(paise).toBe(1000); // only the completed one
  });

  test('drops non-success sub rows but keeps NULL-status (legacy) rows', () => {
    const { paise } = computeRevenuePaise({
      subs: [
        { total_charged: 100, status: 'paid' },
        { total_charged: 100, status: 'refunded' },
        { total_charged: 100, status: null },      // legacy/backfill → counts
      ],
    });
    expect(paise).toBe(20000);
  });

  test('empty input → zero', () => {
    expect(computeRevenuePaise()).toEqual({ paise: 0, subTimes: [] });
  });
});

describe('matchByPhone', () => {
  test('matches a profile whose phone ends in the exact last-10', () => {
    const cands = [{ id: 'a', phone: '9876543210' }, { id: 'b', phone: '1112223334' }];
    expect(matchByPhone(cands, '9876543210')?.id).toBe('a');
  });
  test('rejects a substring collision the DB %like% filter would return', () => {
    // '98765432109' contains the run but does NOT end in it → not a match.
    expect(matchByPhone([{ id: 'x', phone: '98765432109' }], '9876543210')).toBeNull();
  });
  test('no last10 → null', () => {
    expect(matchByPhone([{ id: 'a', phone: '9876543210' }], '')).toBeNull();
  });
});
