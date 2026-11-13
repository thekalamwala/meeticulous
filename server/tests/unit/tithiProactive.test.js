// Tithi's proactive in-app nudges (Slice 5). supabase / featureFlags / inAppNotify mocked.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn(), resolveInApp: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../../services/featureFlags');
const { inAppNotify } = require('../../utils/inAppNotify');
const { runProactiveNudges, STAGE_RULES } = require('../../services/bot/tithiProactive');

// A chainable query builder that resolves to `result` (supports the methods we use).
function qb(result) {
  const b = {};
  ['select', 'eq', 'not', 'gt', 'lte', 'order', 'limit'].forEach((m) => { b[m] = () => b; });
  b.then = (res) => res(result);
  return b;
}
// Per-table result queue: each from(table) call shifts the next queued result.
function wire(map) {
  supabaseAdmin.from.mockImplementation((t) => qb((map[t] || []).shift() || { data: [] }));
}
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
const daysAhead = (d) => new Date(Date.now() + d * 86400000).toISOString();
const NOON_IST = new Date('2026-12-01T06:30:00Z'); // 12:00 IST — within quiet hours
const TENPM_IST = new Date('2026-12-01T16:30:00Z'); // 22:00 IST — outside

// host_activation is queried once per stage rule, in order; then profiles (plan expiry).
const stages = (...results) => results.map((data) => ({ data }));

beforeEach(() => {
  jest.clearAllMocks();
  isFeatureEnabled.mockResolvedValue(true);
});

describe('runProactiveNudges — gates', () => {
  test('flag OFF → no-op', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    expect(await runProactiveNudges(NOON_IST)).toEqual({ skipped: 'flag_off' });
    expect(inAppNotify).not.toHaveBeenCalled();
  });
  test('outside quiet hours → no-op', async () => {
    expect(await runProactiveNudges(TENPM_IST)).toEqual({ skipped: 'quiet_hours' });
    expect(inAppNotify).not.toHaveBeenCalled();
  });
});

describe('runProactiveNudges — detectors', () => {
  test('a KYC-stuck host (signed up >2d ago) gets ONE deduped Tithi nudge', async () => {
    wire({
      host_activation: stages(
        [{ host_id: 'h1', name: 'Asha Rao', signed_up_at: daysAgo(5), stage: '1_signed_up', is_internal: false }],
        [], [],
      ),
      profiles: [{ data: [] }],
    });
    const r = await runProactiveNudges(NOON_IST);
    expect(r.nudged).toBe(1);
    expect(inAppNotify).toHaveBeenCalledTimes(1);
    expect(inAppNotify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'h1', role: 'vendor', type: 'TITHI_KYC_STUCK', dedupeKey: 'TITHI_KYC_STUCK', link: '/dashboard/kyc',
    }));
    expect(inAppNotify.mock.calls[0][0].body).toMatch(/Asha/); // first name, Tithi's voice
  });

  test('a host who just landed on the stage (< minSignupDays) is NOT nudged', async () => {
    wire({
      host_activation: stages(
        [{ host_id: 'h1', name: 'New Host', signed_up_at: daysAgo(1), stage: '1_signed_up', is_internal: false }],
        [], [],
      ),
      profiles: [{ data: [] }],
    });
    expect((await runProactiveNudges(NOON_IST)).nudged).toBe(0);
    expect(inAppNotify).not.toHaveBeenCalled();
  });

  test('a plan expiring within the window gets a renewal nudge', async () => {
    wire({
      host_activation: stages([], [], []),
      profiles: [{ data: [{ id: 'p1', name: 'Ravi K', plan: 'premium', plan_expires_at: daysAhead(2) }] }],
    });
    const r = await runProactiveNudges(NOON_IST);
    expect(r.nudged).toBe(1);
    expect(inAppNotify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'p1', type: 'TITHI_PLAN_EXPIRING', dedupeKey: 'TITHI_PLAN_EXPIRING' }));
  });

  test('a failing query fails soft (no throw, nudges the rest)', async () => {
    wire({
      host_activation: stages([{ host_id: 'h1', name: 'Asha', signed_up_at: daysAgo(5), stage: '1_signed_up' }], [], []),
      profiles: [{ data: null, error: { message: 'boom' } }],
    });
    const r = await runProactiveNudges(NOON_IST);
    expect(r.nudged).toBe(1); // the stage nudge still fired
  });
});

describe('STAGE_RULES', () => {
  test('each rule has a unique dedupe type, a title and a voiced body', () => {
    const types = STAGE_RULES.map((r) => r.type);
    expect(new Set(types).size).toBe(types.length);
    for (const r of STAGE_RULES) {
      expect(r.type).toMatch(/^TITHI_/);
      expect(typeof r.title).toBe('string');
      expect(r.body('Sam')).toMatch(/Sam/);
    }
  });
});
