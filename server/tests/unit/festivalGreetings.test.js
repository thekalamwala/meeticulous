jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: async () => false }));
jest.mock('../../services/notificationEngine', () => ({ send: async () => ({}) }));

const { parseFilter, runFestivalGreetings, todayIstDate } = require('../../services/festivalGreetings');

describe('festivalGreetings.parseFilter', () => {
  test('null / empty / "all" → all', () => {
    expect(parseFilter(null)).toEqual({ kind: 'all' });
    expect(parseFilter('')).toEqual({ kind: 'all' });
    expect(parseFilter('all')).toEqual({ kind: 'all' });
  });
  test('single profession', () => {
    expect(parseFilter('profession:yoga')).toEqual({ kind: 'profession', slugs: ['yoga'] });
  });
  test('multiple professions', () => {
    expect(parseFilter('profession:coach,mentor,teacher')).toEqual({
      kind: 'profession', slugs: ['coach', 'mentor', 'teacher'],
    });
  });
  test('unknown filter degrades to kind: unknown', () => {
    expect(parseFilter('plan:pro')).toEqual({ kind: 'unknown', raw: 'plan:pro' });
  });
});

describe('festivalGreetings.todayIstDate', () => {
  test('returns ISO date (YYYY-MM-DD)', () => {
    expect(todayIstDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('festivalGreetings.runFestivalGreetings', () => {
  test('short-circuits when flag off', async () => {
    const r = await runFestivalGreetings();
    expect(r).toEqual({ skipped: 'flag_off' });
  });
});
