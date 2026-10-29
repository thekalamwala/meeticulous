/**
 * planService — reminder/reschedule plan-gating helpers.
 *
 * Forces the FALLBACK_PLANS path (subscription_plans query returns empty) so the
 * assertions pin the intended tiering independent of live DB rows. Since v3.165:
 *   free 1 flow → 24h only (a first booking needs a reminder to survive),
 *   premium -1  → 24h + 1h + reschedule notifications.
 */

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

const planService = require('../../services/planService');

beforeEach(() => planService.clearCache());

describe('reminderWindowsForPlan', () => {
  test('free → 24h only', async () => {
    expect(await planService.reminderWindowsForPlan('free')).toEqual([24]);
  });
  test('premium → 24h + 1h', async () => {
    expect(await planService.reminderWindowsForPlan('premium')).toEqual([24, 1]);
  });
  test('legacy paid tiers get the full set', async () => {
    expect(await planService.reminderWindowsForPlan('creator')).toEqual([24, 1]);
    expect(await planService.reminderWindowsForPlan('professional')).toEqual([24, 1]);
  });
  test('legacy free aliases resolve to the free row (24h only)', async () => {
    expect(await planService.reminderWindowsForPlan('explorer')).toEqual([24]);
    expect(await planService.reminderWindowsForPlan('starter')).toEqual([24]);
  });
  test('unknown slug falls back to free (24h only), never the paid set', async () => {
    expect(await planService.reminderWindowsForPlan('nope')).toEqual([24]);
  });
});

describe('rescheduleNotifyForPlan', () => {
  test('free does NOT get reschedule notifications', async () => {
    expect(await planService.rescheduleNotifyForPlan('free')).toBe(false);
    expect(await planService.rescheduleNotifyForPlan('explorer')).toBe(false);
  });
  test('premium (full reminder set) DOES get reschedule notifications', async () => {
    expect(await planService.rescheduleNotifyForPlan('premium')).toBe(true);
    expect(await planService.rescheduleNotifyForPlan('creator')).toBe(true);
  });
});
