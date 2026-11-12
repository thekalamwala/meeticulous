// Fake supabase: thenable chain resolving to {data: tables[table]} (filters ignored).
const mockTables = {};
jest.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: (t) => {
      const c = {};
      for (const m of ['select', 'eq', 'in', 'gte', 'lt', 'maybeSingle', 'limit']) c[m] = jest.fn(() => c);
      c.then = (res, rej) => Promise.resolve({ data: mockTables[t] ?? [], error: null }).then(res, rej);
      return c;
    },
  },
}));
jest.mock('../../../services/notificationEngine', () => ({ send: jest.fn(async () => ({})) }));
jest.mock('../../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn(async () => true) }));

const engine = require('../../../services/notificationEngine');
const { isFeatureEnabled } = require('../../../services/featureFlags');
const { sendWelcome, runSweep, STEPS } = require('../../../services/community/onboardingSequence');

const prof = (id, o = {}) => ({ id, email: `${id}@x.com`, first_name: id.toUpperCase(), is_host: false, is_banned: false, ...o });

beforeEach(() => {
  jest.clearAllMocks();
  isFeatureEnabled.mockResolvedValue(true);
  mockTables.notification_logs = [];
  mockTables.community_members = [];
  mockTables.profiles = [];
});

describe('sendWelcome', () => {
  test('fires once on first acceptance', async () => {
    await sendWelcome(prof('A'), { isFirstAcceptance: true });
    expect(engine.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'COMMUNITY_WELCOME' }));
  });

  test('silent when not first acceptance', async () => {
    await sendWelcome(prof('A'), { isFirstAcceptance: false });
    expect(engine.send).not.toHaveBeenCalled();
  });

  test('silent when flag off', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    await sendWelcome(prof('A'), { isFirstAcceptance: true });
    expect(engine.send).not.toHaveBeenCalled();
  });

  test('silent when profile has no email', async () => {
    await sendWelcome(prof('A', { email: null }), { isFirstAcceptance: true });
    expect(engine.send).not.toHaveBeenCalled();
  });
});

describe('runSweep', () => {
  test('skips when flag off', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    const r = await runSweep();
    expect(r).toEqual({ skipped: 'flag_off' });
    expect(engine.send).not.toHaveBeenCalled();
  });

  test('exposes exactly 4 scheduled steps (WELCOME is inline, not in sweep)', () => {
    expect(STEPS.map((s) => s.event)).toEqual([
      'COMMUNITY_ONBOARD_HOW',
      'COMMUNITY_ONBOARD_HOT',
      'COMMUNITY_ONBOARD_FIRSTPOST',
      'COMMUNITY_ONBOARD_WINDDOWN',
    ]);
    // Step 4 + 5 require zero activity (first-post nudge + wind-down).
    expect(STEPS.filter((s) => s.requireZero).map((s) => s.event)).toEqual([
      'COMMUNITY_ONBOARD_FIRSTPOST',
      'COMMUNITY_ONBOARD_WINDDOWN',
    ]);
  });
});
