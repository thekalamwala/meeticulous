// Shape-only smoke tests: module loads, exports what we expect.
// Network-touching behaviour lives behind the feature flag and is validated
// by the double-gated manual flip (see migration v3.194 + server.js cron).

jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: async () => false }));
jest.mock('../../services/notificationEngine', () => ({ send: async () => ({}) }));

const reviewNudges = require('../../services/reviewNudges');
const activationNudges = require('../../services/activationNudges');

describe('reviewNudges', () => {
  test('exports runReviewNudges', () => {
    expect(typeof reviewNudges.runReviewNudges).toBe('function');
  });
  test('short-circuits when review_nudges flag off', async () => {
    const r = await reviewNudges.runReviewNudges();
    expect(r).toEqual({ skipped: 'flag_off' });
  });
});

describe('activationNudges KYC-start rule', () => {
  test('exports runActivationNudges', () => {
    expect(typeof activationNudges.runActivationNudges).toBe('function');
  });
  test('short-circuits when activation_nudges flag off', async () => {
    const r = await activationNudges.runActivationNudges();
    expect(r).toEqual({ skipped: 'flag_off' });
  });
});
