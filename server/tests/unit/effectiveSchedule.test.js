// availabilityService transitively requires config/supabase, which throws unless a
// real service_role key is present. Mock the side-effecting deps — this suite only
// exercises the pure effectiveSchedule() helper.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../config/google', () => ({ getFreeBusy: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));

const { effectiveSchedule, DEFAULT_WEEKLY_SCHEDULE } = require('../../services/availabilityService');

const EMPTY_ALL_DAYS = {
  sunday: [], monday: [], tuesday: [], wednesday: [],
  thursday: [], friday: [], saturday: [],
};

describe('effectiveSchedule — platform default availability', () => {
  test('falls back to the default when weekly_schedule is undefined', () => {
    expect(effectiveSchedule(undefined)).toBe(DEFAULT_WEEKLY_SCHEDULE);
  });

  test('falls back to the default when weekly_schedule is null', () => {
    expect(effectiveSchedule(null)).toBe(DEFAULT_WEEKLY_SCHEDULE);
  });

  test('falls back to the default when every day is an empty array (the onboarding default row)', () => {
    expect(effectiveSchedule(EMPTY_ALL_DAYS)).toBe(DEFAULT_WEEKLY_SCHEDULE);
  });

  test('default is Mon–Sat 10:00–18:00, Sunday closed', () => {
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
      expect(DEFAULT_WEEKLY_SCHEDULE[day]).toEqual([{ start: '10:00', end: '18:00' }]);
    }
    expect(DEFAULT_WEEKLY_SCHEDULE.sunday).toEqual([]);
  });

  test('a host with ANY custom window keeps their own schedule (default not applied)', () => {
    const custom = { ...EMPTY_ALL_DAYS, tuesday: [{ start: '09:00', end: '10:00' }] };
    const result = effectiveSchedule(custom);
    expect(result).toBe(custom);                 // their object, unchanged
    expect(result.monday).toEqual([]);           // a day they left empty stays closed
    expect(result.tuesday).toEqual([{ start: '09:00', end: '10:00' }]);
  });
});
