'use strict';
/**
 * Tests for the onboarding completion state-machine helpers:
 *   getActivePlan, activateFreePlan, advanceToLive, markComplete
 *
 * Contract being tested:
 *   - activateFreePlan / advanceToLive: set onboarding_step_completed=6
 *     but do NOT set onboarding_completed (that stays false/absent)
 *   - markComplete: the ONLY writer of onboarding_completed=true, gated on plan
 *   - getActivePlan: 'explorer' always active; paid needs future plan_expires_at
 */

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() }, signInWithPassword: jest.fn() }));
jest.mock('../../utils/notify', () => ({ sendWhatsAppOtp: jest.fn() }));
jest.mock('../../services/email/communicationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));

const { supabaseAdmin } = require('../../config/supabase');
const ctrl = require('../../controllers/vendorOnboardingController');

beforeEach(() => jest.clearAllMocks());

// ─── getActivePlan ──────────────────────────────────────────────────────────

describe('getActivePlan', () => {
  const mockProfileSelect = (profile) => {
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: profile }) }) }),
    });
  };

  test('returns "explorer" for a free plan profile', async () => {
    mockProfileSelect({ plan: 'explorer', plan_expires_at: null });
    expect(await ctrl.getActivePlan('uid-1')).toBe('explorer');
  });

  test('returns the plan slug for an unexpired paid plan', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    mockProfileSelect({ plan: 'creator', plan_expires_at: future });
    expect(await ctrl.getActivePlan('uid-2')).toBe('creator');
  });

  test('returns null when plan is expired', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    mockProfileSelect({ plan: 'professional', plan_expires_at: past });
    expect(await ctrl.getActivePlan('uid-3')).toBeNull();
  });

  test('returns null when profile has no plan', async () => {
    mockProfileSelect({ plan: null, plan_expires_at: null });
    expect(await ctrl.getActivePlan('uid-4')).toBeNull();
  });

  test('returns null when profile is missing entirely', async () => {
    mockProfileSelect(null);
    expect(await ctrl.getActivePlan('uid-5')).toBeNull();
  });
});

// ─── markComplete ────────────────────────────────────────────────────────────

describe('markComplete', () => {
  test('throws when no plan is active', async () => {
    // First call: getActivePlan select → null profile
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    });
    await expect(ctrl.markComplete('uid-1')).rejects.toThrow(/choose.*plan|plan.*before/i);
  });

  test('sets onboarding_completed=true and onboarding_step_completed=6 when plan is active', async () => {
    const updatedProfile = { id: 'uid-2', onboarding_completed: true, onboarding_step_completed: 6 };
    let callIndex = 0;
    const capturedUpdates = [];

    supabaseAdmin.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            // call 0 = getActivePlan; call 1 = primary_category required-field check (P2-7)
            data: callIndex++ === 0 ? { plan: 'explorer', plan_expires_at: null } : { primary_category: 'coaching' },
          }),
        }),
      }),
      update: (payload) => {
        capturedUpdates.push(payload);
        return {
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: updatedProfile, error: null }),
            }),
          }),
        };
      },
    }));

    const result = await ctrl.markComplete('uid-2');
    expect(result.onboarding_completed).toBe(true);
    expect(result.onboarding_step_completed).toBe(6);

    // Verify the update payload contains onboarding_completed=true
    const updatePayload = capturedUpdates[0];
    expect(updatePayload.onboarding_completed).toBe(true);
    expect(updatePayload.onboarding_step_completed).toBe(6);
  });
});

// ─── activateFreePlan ────────────────────────────────────────────────────────

describe('activateFreePlan', () => {
  test(`sets plan="free" and step=6 but does NOT set onboarding_completed`, async () => {
    const capturedUpdates = [];
    // activateFreePlan call sequence:
    //   1. supabaseAdmin.from('profiles').update({plan:'explorer',...}).eq('id', vendorId)
    //      — no .select().single(), just awaited directly → must resolve { error: null }
    //   2. advanceToLive → getActivePlan:
    //      supabaseAdmin.from('profiles').select(...).eq(...).maybeSingle()
    //      — must return an active plan now that explorer was "set"
    //   3. advanceToLive → supabaseAdmin.from('profiles').update({step:6}).eq(...).select().single()
    //      — must return profile row

    let callIndex = 0;

    supabaseAdmin.from.mockImplementation((table) => {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              // getActivePlan call: explorer is now active
              Promise.resolve({ data: { plan: 'explorer', plan_expires_at: null } }),
          }),
        }),
        update: (payload) => {
          capturedUpdates.push(payload);
          const isStepUpdate = 'onboarding_step_completed' in payload;
          if (isStepUpdate) {
            // advanceToLive update — needs .eq().select().single()
            return {
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({
                    data: { id: 'uid-1', onboarding_step_completed: 6 },
                    error: null,
                  }),
                }),
              }),
            };
          } else {
            // plan activation update — only needs .eq(), returns a plain resolved promise
            return {
              eq: () => Promise.resolve({ error: null }),
            };
          }
        },
      };
    });

    const result = await ctrl.activateFreePlan('uid-1');

    // Plan activation update
    const planUpdate = capturedUpdates.find((u) => u.plan === 'free');
    expect(planUpdate).toBeDefined();
    expect(planUpdate.plan_activated_at).toBeTruthy();
    // onboarding_completed must NOT be in the plan update
    expect(planUpdate.onboarding_completed).toBeUndefined();

    // Step advance update
    const stepUpdate = capturedUpdates.find((u) => u.onboarding_step_completed === 6);
    expect(stepUpdate).toBeDefined();
    // onboarding_completed must NOT be set in the step advance either
    expect(stepUpdate.onboarding_completed).toBeUndefined();

    // Result from advanceToLive
    expect(result.onboarding_step_completed).toBe(6);
  });
});

// ─── advanceToLive ───────────────────────────────────────────────────────────

describe('advanceToLive', () => {
  test('throws when no plan is active', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    });
    await expect(ctrl.advanceToLive('uid-1')).rejects.toThrow(/choose.*plan/i);
  });

  test('sets step=6 without setting onboarding_completed when plan is active', async () => {
    const capturedUpdates = [];
    let selectCallCount = 0;

    supabaseAdmin.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            selectCallCount++;
            return Promise.resolve({
              data: { plan: 'professional', plan_expires_at: new Date(Date.now() + 999999999).toISOString() },
            });
          },
        }),
      }),
      update: (payload) => {
        capturedUpdates.push(payload);
        return {
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: { id: 'uid-2', onboarding_step_completed: 6 },
                error: null,
              }),
            }),
          }),
        };
      },
    }));

    const result = await ctrl.advanceToLive('uid-2');

    expect(result.onboarding_step_completed).toBe(6);

    const update = capturedUpdates[0];
    expect(update.onboarding_step_completed).toBe(6);
    // onboarding_completed must NOT appear in the update
    expect(update.onboarding_completed).toBeUndefined();
  });
});
