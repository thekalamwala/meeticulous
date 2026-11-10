jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: async () => false }));
jest.mock('../../services/notificationEngine', () => ({ send: async () => ({}) }));

const { isLowRatingsRun, firstName, runEmpathyScans } = require('../../services/empathyScans');

describe('empathyScans.isLowRatingsRun', () => {
  test('under 3 reviews → false', () => {
    expect(isLowRatingsRun([])).toBe(false);
    expect(isLowRatingsRun([2])).toBe(false);
    expect(isLowRatingsRun([2, 3])).toBe(false);
  });
  test('three low in a row → true', () => {
    expect(isLowRatingsRun([3, 3, 3])).toBe(true);
    expect(isLowRatingsRun([1, 2, 3])).toBe(true);
  });
  test('any of last 3 above threshold → false', () => {
    expect(isLowRatingsRun([5, 2, 2])).toBe(false); // newest is 5
    expect(isLowRatingsRun([2, 5, 2])).toBe(false);
    expect(isLowRatingsRun([2, 2, 4])).toBe(false);
  });
  test('only the last 3 count — older history ignored', () => {
    expect(isLowRatingsRun([2, 2, 2, 5, 5])).toBe(true);
  });
  test('string ratings coerce', () => {
    expect(isLowRatingsRun(['2', '3', '1'])).toBe(true);
  });
  test('null / non-array → false', () => {
    expect(isLowRatingsRun(null)).toBe(false);
    expect(isLowRatingsRun(undefined)).toBe(false);
  });
});

describe('empathyScans.firstName', () => {
  test('first token or fallback', () => {
    expect(firstName('Shubham Datarkar')).toBe('Shubham');
    expect(firstName('')).toBe('there');
  });
});

describe('empathyScans.runEmpathyScans', () => {
  test('short-circuits when flag off', async () => {
    const r = await runEmpathyScans();
    expect(r).toEqual({ skipped: 'flag_off' });
  });
});
