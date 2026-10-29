/**
 * subscriptionReconciler.test.js — orphan cleanup + heal paths.
 *
 * The reconciler is the safety net for vendors stuck at subscription_status=
 * 'pending'. Beyond healing missed activation webhooks, it must RELEASE orphaned
 * mandates so they don't poll forever and so the vendor can retry:
 *   • a mandate that never authorized within the grace window (abandoned), and
 *   • a subscription Razorpay can't find (minted under a since-rotated key/mode).
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/razorpaySubscriptions', () => ({
  fetchSubscription: jest.fn(),
  cancelSubscription: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../services/subscriptionService', () => ({
  activateFromSubscription: jest.fn(() => Promise.resolve({ activated: true })),
  backfillSubscriptionPayments: jest.fn(() => Promise.resolve({ recorded: 0 })),
  backfillMissingInvoices: jest.fn(() => Promise.resolve({ minted: 0, scanned: 0 })),
  markHalted: jest.fn(() => Promise.resolve()),
  markCancelled: jest.fn(() => Promise.resolve()),
  ACTIVE_STATES: ['active', 'authenticated'],
}));

const { supabaseAdmin } = require('../../config/supabase');
const razorpaySubscriptions = require('../../services/razorpaySubscriptions');
const subscriptionService = require('../../services/subscriptionService');

// Wire profiles (pending scan returns `rows`; captures profiles.update) and the
// platform_settings status read/write the reconciler records at the end.
const wire = (rows, { priorStatus = null, activeRows = [], subPayCount = 1 } = {}) => {
  const updates = [];
  updates.status = [];   // captured platform_settings status upserts (parsed)
  let profilesCall = 0;
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'subscription_payments') {
      // Count query used by the missing-payment second pass.
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.then = (resolve) => resolve({ count: subPayCount, data: [], error: null });
      return c;
    }
    if (table === 'platform_settings') {
      const c = {};
      c.select = jest.fn(() => c);
      c.eq = jest.fn(() => c);
      c.maybeSingle = jest.fn(() => Promise.resolve({ data: priorStatus ? { value: JSON.stringify(priorStatus) } : null, error: null }));
      c.upsert = jest.fn((row) => { try { updates.status.push(JSON.parse(row.value)); } catch { /* ignore */ } return Promise.resolve({ error: null }); });
      return c;
    }
    if (table !== 'profiles') throw new Error(`unexpected table ${table}`);
    const c = {};
    // First profiles scan = pending pass (rows); second = active pass (activeRows).
    const which = profilesCall++ === 0 ? rows : activeRows;
    c.select = jest.fn(() => c);
    c.eq = jest.fn(() => c);
    c.not = jest.fn(() => c);
    c.limit = jest.fn(() => Promise.resolve({ data: which, error: null }));
    c.update = jest.fn((payload) => {
      const chain = { eq: jest.fn((_, id) => { updates.push({ id, payload }); return Promise.resolve({ error: null }); }) };
      return chain;
    });
    return c;
  });
  return updates;
};

const HOUR = 3600 * 1000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

beforeEach(() => { jest.clearAllMocks(); });

describe('subscriptionReconciler — orphan cleanup', () => {
  test('aged-out pre-auth mandate is cancelled and released', async () => {
    const updates = wire([{ id: 'v1', razorpay_subscription_id: 'sub_OLD', updated_at: iso(3 * HOUR) }]);
    razorpaySubscriptions.fetchSubscription.mockResolvedValue({ id: 'sub_OLD', status: 'created' });

    const { reconcile } = require('../../services/subscriptionReconciler');
    const r = await reconcile();

    expect(razorpaySubscriptions.cancelSubscription).toHaveBeenCalledWith('sub_OLD', false);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ id: 'v1', payload: { subscription_status: 'cancelled', razorpay_subscription_id: null } });
    expect(r).toEqual({ healed: 0, released: 1, recorded: 0, invoiced: 0 });
  });

  test('recent pre-auth mandate (inside grace window) is left pending', async () => {
    const updates = wire([{ id: 'v1', razorpay_subscription_id: 'sub_NEW', updated_at: iso(5 * 60 * 1000) }]);
    razorpaySubscriptions.fetchSubscription.mockResolvedValue({ id: 'sub_NEW', status: 'created' });

    const { reconcile } = require('../../services/subscriptionReconciler');
    const r = await reconcile();

    expect(razorpaySubscriptions.cancelSubscription).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(r).toEqual({ healed: 0, released: 0, recorded: 0, invoiced: 0 });
  });

  test('subscription Razorpay cannot find is released WITHOUT a cancel call', async () => {
    const updates = wire([{ id: 'v2', razorpay_subscription_id: 'sub_GHOST', updated_at: iso(2 * HOUR) }]);
    razorpaySubscriptions.fetchSubscription.mockRejectedValue({
      statusCode: 400, error: { description: 'The id provided does not exist' },
    });

    const { reconcile } = require('../../services/subscriptionReconciler');
    const r = await reconcile();

    expect(razorpaySubscriptions.cancelSubscription).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({ subscription_status: 'cancelled', razorpay_subscription_id: null });
    expect(r).toEqual({ healed: 0, released: 1, recorded: 0, invoiced: 0 });
  });

  test('transient fetch error leaves the row pending (no release)', async () => {
    const updates = wire([{ id: 'v3', razorpay_subscription_id: 'sub_X', updated_at: iso(2 * HOUR) }]);
    razorpaySubscriptions.fetchSubscription.mockRejectedValue(new Error('ETIMEDOUT'));

    const { reconcile } = require('../../services/subscriptionReconciler');
    const r = await reconcile();

    expect(updates).toHaveLength(0);
    expect(r).toEqual({ healed: 0, released: 0, recorded: 0, invoiced: 0 });
  });

  test('records a status summary with the cumulative released total', async () => {
    const updates = wire(
      [{ id: 'v5', razorpay_subscription_id: 'sub_GONE', updated_at: iso(2 * HOUR) }],
      { priorStatus: { released_total: 3, healed_total: 1 } },
    );
    razorpaySubscriptions.fetchSubscription.mockRejectedValue({ error: { description: 'The id provided does not exist' } });

    const { reconcile } = require('../../services/subscriptionReconciler');
    await reconcile();

    expect(updates.status).toHaveLength(1);
    expect(updates.status[0]).toMatchObject({ last_released: 1, released_total: 4, healed_total: 1 });
    expect(updates.status[0].last_run_at).toBeTruthy();
  });

  test('active subscription still heals (existing behaviour intact)', async () => {
    wire([{ id: 'v4', razorpay_subscription_id: 'sub_OK', updated_at: iso(2 * HOUR) }]);
    razorpaySubscriptions.fetchSubscription.mockResolvedValue({ id: 'sub_OK', status: 'active' });

    const { reconcile } = require('../../services/subscriptionReconciler');
    const r = await reconcile();

    expect(subscriptionService.activateFromSubscription).toHaveBeenCalledWith({ rzpSub: { id: 'sub_OK', status: 'active' } });
    expect(razorpaySubscriptions.cancelSubscription).not.toHaveBeenCalled();
    expect(r).toEqual({ healed: 1, released: 0, recorded: 0, invoiced: 0 });
  });

  test('active sub with NO booked charge is backfilled from Razorpay', async () => {
    // No pending rows; one active sub whose subscription_payments count is 0.
    wire([], { activeRows: [{ id: 'v9', razorpay_subscription_id: 'sub_UNBOOKED' }], subPayCount: 0 });
    razorpaySubscriptions.fetchSubscription.mockResolvedValue({ id: 'sub_UNBOOKED', status: 'active' });
    subscriptionService.backfillSubscriptionPayments.mockResolvedValue({ recorded: 1 });

    const { reconcile } = require('../../services/subscriptionReconciler');
    const r = await reconcile();

    expect(subscriptionService.backfillSubscriptionPayments).toHaveBeenCalledWith({ id: 'sub_UNBOOKED', status: 'active' });
    expect(r).toEqual({ healed: 0, released: 0, recorded: 1, invoiced: 0 });
  });

  test('active sub that already has a charge is NOT re-fetched', async () => {
    wire([], { activeRows: [{ id: 'v10', razorpay_subscription_id: 'sub_BOOKED' }], subPayCount: 1 });

    const { reconcile } = require('../../services/subscriptionReconciler');
    const r = await reconcile();

    expect(subscriptionService.backfillSubscriptionPayments).not.toHaveBeenCalled();
    expect(r).toEqual({ healed: 0, released: 0, recorded: 0, invoiced: 0 });
  });
});
