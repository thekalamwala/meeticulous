// Mock supabase config to force fallback to FALLBACK_PLANS
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: null, error: new Error('subscription_plans table missing') }) })
    })
  }
}));

const planService = require('../../services/planService');

// FALLBACK_PLANS is only consulted when subscription_plans is unreadable, so it
// must mirror migration v3.165: Sloth keeps a countable AI quota (real Anthropic
// spend), every paid row is unlimited.
describe('ai_generations fallback limits', () => {
  // Clear cache before each test to force fresh read from fallback
  beforeEach(() => {
    planService.clearCache?.();
  });

  test('free (Sloth) allows 10', async () => {
    const limit = await planService.getLimit('free', 'ai_generations');
    expect(limit).toBe(10);
  });

  test('legacy free slugs resolve to the same quota', async () => {
    expect(await planService.getLimit('starter', 'ai_generations')).toBe(10);
    expect(await planService.getLimit('explorer', 'ai_generations')).toBe(10);
  });

  test('premium (Sloth Active) is unlimited', async () => {
    const limit = await planService.getLimit('premium', 'ai_generations');
    expect(limit).toBe(-1);
  });

  test('legacy paid tiers carry Sloth Active entitlements', async () => {
    expect(await planService.getLimit('creator', 'ai_generations')).toBe(-1);
    expect(await planService.getLimit('professional', 'ai_generations')).toBe(-1);
  });
});
