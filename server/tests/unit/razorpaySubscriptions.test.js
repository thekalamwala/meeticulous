/**
 * razorpaySubscriptions.test.js — call-site guard for the UPI AutoPay mandate
 * duration cap.
 *
 * BUG: createSubscription passed a fixed total_count (annual = 100), producing a
 * ~100-year UPI AutoPay mandate. UPI mandates are valid for at most ~10 years
 * (enforced by the bank/NPCI at checkout), so the mandate was rejected on
 * POST .../payments/create/ajax before any payment was created. These tests assert
 * the count handed to Razorpay caps the mandate at the 10-year window: annual → 10,
 * monthly → 120 (unchanged — already 10yr and proven to authorize).
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({ clearCache: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/razorpayConfig', () => {
  const create = jest.fn(() => Promise.resolve({ id: 'sub_X' }));
  return {
    __create: create,
    getClient: jest.fn(() => Promise.resolve({ subscriptions: { create } })),
    getKeyId: jest.fn(() => Promise.resolve('rzp_test')),
  };
});

const razorpayConfig = require('../../services/razorpayConfig');
const create = razorpayConfig.__create;
const { subscriptionTotalCount } = require('../../lib/subscriptionPricing');
const razorpaySubscriptions = require('../../services/razorpaySubscriptions');

beforeEach(() => jest.clearAllMocks());

describe('createSubscription — total_count capped to the 10-year UPI mandate window', () => {
  test('annual is capped to 10 cycles (10 years), not the naive 100', async () => {
    await razorpaySubscriptions.createSubscription({ planId: 'plan_a', cadence: 'annual' });
    const arg = create.mock.calls[0][0];
    expect(arg.plan_id).toBe('plan_a');
    expect(arg.total_count).toBe(10);
    expect(arg.total_count).toBe(subscriptionTotalCount('annual'));
  });

  test('monthly is unchanged at 120 cycles (10 years)', async () => {
    await razorpaySubscriptions.createSubscription({ planId: 'plan_m', cadence: 'monthly' });
    expect(create.mock.calls[0][0].total_count).toBe(120);
  });

  test('a deferred start_at (switch) is passed through; the count stays cadence-based', async () => {
    const startAt = 1782000000 + 200 * 86400;
    await razorpaySubscriptions.createSubscription({ planId: 'plan_a', cadence: 'annual', startAt });
    const arg = create.mock.calls[0][0];
    expect(arg.start_at).toBe(startAt);
    expect(arg.total_count).toBe(10); // span cap is start-independent
  });
});
