jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: async () => false }));
jest.mock('../../services/notificationEngine', () => ({ send: async () => ({}) }));

const {
  runHumanMoments, prevMonthWindow, isoWeekKey, hasThreeWeekStreak, firstName,
} = require('../../services/humanMoments');

describe('humanMoments.firstName', () => {
  test('splits on whitespace, falls back to "there"', () => {
    expect(firstName('Shubham Datarkar')).toBe('Shubham');
    expect(firstName('   Alex  Pereira ')).toBe('Alex');
    expect(firstName('')).toBe('there');
    expect(firstName(null)).toBe('there');
  });
});

describe('humanMoments.prevMonthWindow', () => {
  test('wraps months across year boundary', () => {
    const w = prevMonthWindow(new Date(Date.UTC(2027, 0, 15))); // Jan 2027
    expect(w.startIso.startsWith('2026-12-01')).toBe(true);
    expect(w.endIso.startsWith('2027-01-01')).toBe(true);
    expect(w.monthName).toMatch(/December/);
  });
  test('mid-year month', () => {
    const w = prevMonthWindow(new Date(Date.UTC(2027, 5, 10))); // June
    expect(w.startIso.startsWith('2027-05-01')).toBe(true);
    expect(w.endIso.startsWith('2027-06-01')).toBe(true);
  });
});

describe('humanMoments.isoWeekKey', () => {
  test('Sunday and Monday adjacent dates map to different weeks', () => {
    // Monday 2026-11-09 and Sunday 2026-11-15 should share a week; Monday 2026-11-16 a new one.
    expect(isoWeekKey('2026-11-09T10:00:00Z')).toBe(isoWeekKey('2026-11-15T10:00:00Z'));
    expect(isoWeekKey('2026-11-09T10:00:00Z')).not.toBe(isoWeekKey('2026-11-16T10:00:00Z'));
  });
});

describe('humanMoments.hasThreeWeekStreak', () => {
  // "now" chosen so this-week-Monday = 2026-11-09.
  const now = new Date('2026-11-12T10:00:00Z');
  test('returns true for bookings in each of the last 3 weeks', () => {
    const dates = [
      '2026-11-10T09:00:00Z', // this week
      '2026-11-05T09:00:00Z', // last week
      '2026-10-29T09:00:00Z', // two weeks ago
    ];
    expect(hasThreeWeekStreak(dates, now)).toBe(true);
  });
  test('returns false when a week is missing', () => {
    const dates = [
      '2026-11-10T09:00:00Z',
      '2026-10-29T09:00:00Z', // skips middle week
    ];
    expect(hasThreeWeekStreak(dates, now)).toBe(false);
  });
  test('empty list → false', () => {
    expect(hasThreeWeekStreak([], now)).toBe(false);
    expect(hasThreeWeekStreak(null, now)).toBe(false);
  });
});

describe('humanMoments.runHumanMoments', () => {
  test('short-circuits when flag off', async () => {
    const r = await runHumanMoments();
    expect(r).toEqual({ skipped: 'flag_off' });
  });
});
