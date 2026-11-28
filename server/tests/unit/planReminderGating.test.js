/**
 * planService — reminder/reschedule plan-gating helpers.
 *
 * Forces the FALLBACK_PLANS path (subscription_plans query returns empty) so the
 * assertions pin the intended tiering independent of live DB rows. Pricing v2:
 *   free 2 flows → 24h + 1h, but NO host reschedule alert (spec §4 item 8),
 *   premium -1   → 24h + 1h + reschedule notifications.
 */

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

const planService = require('../../services/planService');

beforeEach(() => planService.clearCache());

describe('reminderWindowsForPlan', () => {
  test('free → 24h + 1h', async () => {
    expect(await planService.reminderWindowsForPlan('free')).toEqual([24, 1]);
  });
  test('premium → 24h + 1h', async () => {
    expect(await planService.reminderWindowsForPlan('premium')).toEqual([24, 1]);
  });
  test('legacy paid tiers get the full set', async () => {
    expect(await planService.reminderWindowsForPlan('creator')).toEqual([24, 1]);
    expect(await planService.reminderWindowsForPlan('professional')).toEqual([24, 1]);
  });
  test('legacy free aliases resolve to the free row', async () => {
    expect(await planService.reminderWindowsForPlan('explorer')).toEqual([24, 1]);
    expect(await planService.reminderWindowsForPlan('starter')).toEqual([24, 1]);
  });
  test('unknown slug falls back to free, never a paid tier', async () => {
    expect(await planService.reminderWindowsForPlan('nope')).toEqual([24, 1]);
    expect(await planService.rescheduleNotifyForPlan('nope')).toBe(false);
  });
});

describe('rescheduleNotifyForPlan', () => {
  test('free does NOT get reschedule notifications, despite having both windows', async () => {
    expect(await planService.rescheduleNotifyForPlan('free')).toBe(false);
    expect(await planService.rescheduleNotifyForPlan('explorer')).toBe(false);
  });
  test('premium (full reminder set) DOES get reschedule notifications', async () => {
    expect(await planService.rescheduleNotifyForPlan('premium')).toBe(true);
    expect(await planService.rescheduleNotifyForPlan('creator')).toBe(true);
  });
});
