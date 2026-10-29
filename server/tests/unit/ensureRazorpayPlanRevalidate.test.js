/**
 * ensureRazorpayPlanRevalidate.test.js — stale plan-id self-heal.
 *
 * Razorpay Plan ids are account- AND mode-scoped. After a key/mode switch, a plan
 * id cached on subscription_plans points at the OLD account, so Razorpay 404s when
 * checkout tries to load it. ensureRazorpayPlan must verify a cached id still
 * exists under the active key and re-mint it when Razorpay says it's gone — while
 * NEVER wiping a valid id on a transient error.
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({ clearCache: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn(() => Promise.resolve({ gstRate: 0.18 })) }));
jest.mock('../../services/razorpayConfig', () => ({
  getKeyId: jest.fn(() => Promise.resolve('rzp_live_NEW')),
  getClient: jest.fn(),
}));
jest.mock('../../lib/subscriptionPricing', () => ({
  cadenceAmountPaise: jest.fn(() => 365000),
  razorpayInterval: jest.fn(() => ({ period: 'yearly', interval: 1 })),
  normCadence: (c) => (c === 'monthly' ? 'monthly' : 'annual'),
}));

const { supabaseAdmin } = require('../../config/supabase');
const planService = require('../../services/planService');
const razorpayConfig = require('../../services/razorpayConfig');
const svc = require('../../services/razorpaySubscriptions');

// Capture subscription_plans.update payloads (the null-out + re-mint persist).
const wirePlans = () => {
  const updates = [];
  supabaseAdmin.from.mockImplementation((table) => {
    if (table !== 'subscription_plans') throw new Error(`unexpected table ${table}`);
    const c = {};
    c.update = jest.fn((payload) => ({ eq: jest.fn(() => { updates.push(payload); return Promise.resolve({ error: null }); }) }));
    return c;
  });
  return updates;
};

// Distinct cached id per test — the in-process verify memo is keyed by plan id,
// so reusing one id across tests would let an earlier "present" verdict bleed in.
const rowWith = (annualId) => ({ id: 'plan-uuid', slug: 'professional', name: 'Professional', razorpay_plan_id_annual: annualId });

beforeEach(() => { jest.clearAllMocks(); });

describe('ensureRazorpayPlan — cached id revalidation', () => {
  test('cached id confirmed present is returned without re-minting', async () => {
    wirePlans();
    const create = jest.fn();
    razorpayConfig.getClient.mockResolvedValue({
      plans: { fetch: jest.fn().mockResolvedValue({ id: 'plan_PRESENT' }), create },
    });

    const id = await svc.ensureRazorpayPlan(rowWith('plan_PRESENT'), 'annual');

    expect(id).toBe('plan_PRESENT');
    expect(create).not.toHaveBeenCalled();
  });

  test('cached id gone under the active key is re-minted and persisted', async () => {
    const updates = wirePlans();
    const create = jest.fn().mockResolvedValue({ id: 'plan_FRESH' });
    razorpayConfig.getClient.mockResolvedValue({
      plans: {
        fetch: jest.fn().mockRejectedValue({ statusCode: 400, error: { description: 'The id provided does not exist' } }),
        create,
      },
    });

    const id = await svc.ensureRazorpayPlan(rowWith('plan_STALE'), 'annual');

    expect(id).toBe('plan_FRESH');
    expect(create).toHaveBeenCalled();
    // Stale id nulled out, then the fresh id persisted.
    expect(updates).toContainEqual({ razorpay_plan_id_annual: null });
    expect(updates).toContainEqual({ razorpay_plan_id_annual: 'plan_FRESH' });
    expect(planService.clearCache).toHaveBeenCalled();
  });

  test('transient verify error trusts the cache (does NOT wipe a valid id)', async () => {
    const updates = wirePlans();
    const create = jest.fn();
    razorpayConfig.getClient.mockResolvedValue({
      plans: { fetch: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')), create },
    });

    const id = await svc.ensureRazorpayPlan(rowWith('plan_TRANSIENT'), 'annual');

    expect(id).toBe('plan_TRANSIENT');
    expect(create).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});
