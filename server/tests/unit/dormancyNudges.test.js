jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: async () => false }));
jest.mock('../../services/notificationEngine', () => ({ send: async () => ({}) }));

const { stageFor } = require('../../services/dormancyNudges');

describe('dormancyNudges.stageFor', () => {
  test('under 30 days → no stage', () => {
    expect(stageFor(0)).toBeNull();
    expect(stageFor(29)).toBeNull();
  });
  test('30–59 days → 30d event', () => {
    expect(stageFor(30).event).toBe('HOST_DORMANT_30D');
    expect(stageFor(45).event).toBe('HOST_DORMANT_30D');
    expect(stageFor(59).event).toBe('HOST_DORMANT_30D');
  });
  test('60–89 days → 60d event', () => {
    expect(stageFor(60).event).toBe('HOST_DORMANT_60D');
    expect(stageFor(89).event).toBe('HOST_DORMANT_60D');
  });
  test('90–119 days → 90d event (final)', () => {
    expect(stageFor(90).event).toBe('HOST_DORMANT_90D');
    expect(stageFor(119).event).toBe('HOST_DORMANT_90D');
  });
  test('120+ days → no stage (past final)', () => {
    expect(stageFor(120)).toBeNull();
    expect(stageFor(500)).toBeNull();
  });
});
