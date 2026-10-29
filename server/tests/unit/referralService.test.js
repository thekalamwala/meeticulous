'use strict';
/**
 * referralService — money-critical branches: retention gating, hold release,
 * churn clawback, and the self-referral guard. Supabase is mocked with a
 * per-table result QUEUE consumed in call order (reads shift the queue; writes
 * are captured, not queued). Ledger posting is mocked.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/ledger/postingService', () => ({ post: jest.fn().mockResolvedValue('j1') }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));

const { supabaseAdmin } = require('../../config/supabase');
const { post } = require('../../services/ledger/postingService');
const { send: notifySend } = require('../../services/notificationEngine');
const referralService = require('../../services/referralService');

let queues, updates, inserts;
const nextRes = (table) => (queues[table] && queues[table].length ? queues[table].shift() : { data: null });

beforeEach(() => {
  jest.clearAllMocks();
  queues = {}; updates = []; inserts = [];
  supabaseAdmin.from.mockImplementation((table) => {
    const ctx = { op: 'select' };
    const chain = {};
    for (const m of ['select', 'eq', 'lte', 'gte', 'in', 'order', 'limit', 'not']) chain[m] = jest.fn(() => chain);
    chain.insert = jest.fn((p) => { ctx.op = 'insert'; inserts.push({ table, payload: p }); return chain; });
    chain.update = jest.fn((p) => { ctx.op = 'update'; updates.push({ table, payload: p }); return chain; });
    // Reads shift the queue; writes resolve to an empty ack WITHOUT consuming a slot.
    const val = () => (ctx.op === 'select' ? nextRes(table) : { data: null, error: null });
    chain.maybeSingle = () => Promise.resolve(val());
    chain.single = () => Promise.resolve(val());
    chain.then = (resolve) => resolve(val());
    return chain;
  });
});

const NOW = Date.UTC(2026, 6, 20); // 2026-07-20
const pending = (o = {}) => ({ id: 'r1', referrer_id: 'A', referred_id: 'B', status: 'pending', ...o });

// ── onReferredCharge: qualify + retention gate ────────────────────────────────

test('annual referral qualifies on the first paid charge (min 1)', async () => {
  queues.referrals = [{ data: pending() }, { count: 0 }]; // pending row, then monthly-cap count
  queues.referral_reward_rules = [{ data: { reward_type: 'cash_inr', reward_value: 200, min_qualifying_charges: 1, hold_days: 14, monthly_cap: 10 } }];
  queues.subscription_payments = [{ count: 1 }];

  const r = await referralService.onReferredCharge({ referredId: 'B', planSlug: 'creator', cadence: 'annual' });
  expect(r.qualified).toBe(true);
  const q = updates.find((u) => u.payload.status === 'qualified');
  expect(q.payload).toMatchObject({ reward_value: 200, referred_plan: 'creator', cadence: 'annual' });
  expect(typeof q.payload.release_at).toBe('string'); // hold applied
});

test('monthly referral is HELD until the retention threshold (min 2)', async () => {
  queues.referrals = [{ data: pending() }];
  queues.referral_reward_rules = [{ data: { reward_type: 'cash_inr', reward_value: 50, min_qualifying_charges: 2, hold_days: 14, monthly_cap: 10 } }];
  queues.subscription_payments = [{ count: 1 }]; // only first charge so far

  const r = await referralService.onReferredCharge({ referredId: 'B', planSlug: 'creator', cadence: 'monthly' });
  expect(r.qualified).toBe(false);
  expect(updates.some((u) => u.payload.status === 'qualified')).toBe(false); // not rewarded yet
});

test('no active rule → no qualification', async () => {
  queues.referrals = [{ data: pending() }];
  queues.referral_reward_rules = [{ data: null }];
  const r = await referralService.onReferredCharge({ referredId: 'B', planSlug: 'creator', cadence: 'annual' });
  expect(r.qualified).toBe(false);
});

// ── releaseDue: hold release + clawback ───────────────────────────────────────

const qualified = (o = {}) => ({ id: 'r1', referrer_id: 'A', referred_id: 'B', status: 'qualified', reward_type: 'cash_inr', reward_value: 200, release_at: '2026-07-01T00:00:00Z', ...o });

test('release: hold passed + referred still paying → rewarded + ledger posted', async () => {
  queues.referrals = [{ data: [qualified()] }];
  queues.profiles = [{ data: { plan: 'creator', plan_expires_at: '2027-01-01T00:00:00Z', subscription_status: 'active' } }];
  const r = await referralService.releaseDue(NOW);
  expect(r).toEqual({ released: 1, clawed: 0 });
  expect(post).toHaveBeenCalledTimes(1);
  expect(updates.find((u) => u.table === 'referrals').payload.status).toBe('rewarded');
});

test('release: rewarded referrer is notified (email + in-app REFERRAL_REWARD_RELEASED)', async () => {
  queues.referrals = [{ data: [qualified()] }];
  queues.profiles = [
    { data: { plan: 'creator', plan_expires_at: '2027-01-01T00:00:00Z', subscription_status: 'active' } }, // referred: still paying
    { data: { id: 'A', name: 'Referrer Rao', email: 'ref@x.com' } },                                        // referrer lookup for the notice
  ];
  const r = await referralService.releaseDue(NOW);
  expect(r.released).toBe(1);

  const call = notifySend.mock.calls.find((c) => c[0].event === 'REFERRAL_REWARD_RELEASED');
  expect(call).toBeTruthy();
  expect(call[0].data.recipientUserId).toBe('A');
  expect(call[0].data.email).toBe('ref@x.com');
  expect(call[0].data.inApp.link).toBe('/dashboard/referrals');
  expect(call[0].data.emailData.reward_amount).toMatch(/₹/);
});

test('clawback: referred churned to free tier → rejected, no ledger', async () => {
  queues.referrals = [{ data: [qualified()] }];
  queues.profiles = [{ data: { plan: 'starter', plan_expires_at: null, subscription_status: 'active' } }];
  const r = await referralService.releaseDue(NOW);
  expect(r).toEqual({ released: 0, clawed: 1 });
  expect(post).not.toHaveBeenCalled();
  expect(updates.find((u) => u.table === 'referrals').payload).toMatchObject({ status: 'rejected', rejected_reason: 'referred_churned' });
});

test('clawback: referred cancelled subscription inside hold → rejected', async () => {
  queues.referrals = [{ data: [qualified({ reward_value: 500 })] }];
  queues.profiles = [{ data: { plan: 'professional', plan_expires_at: '2027-01-01T00:00:00Z', subscription_status: 'cancelled' } }];
  const r = await referralService.releaseDue(NOW);
  expect(r.clawed).toBe(1);
  expect(post).not.toHaveBeenCalled();
});

// ── capture: attribution guards ───────────────────────────────────────────────

test('capture: self-referral is rejected, no row written', async () => {
  queues.profiles = [{ data: { id: 'X', is_host: true } }];
  const r = await referralService.capture({ referredId: 'X', ref: 'myname' });
  expect(r).toMatchObject({ captured: false, reason: 'self-referral' });
  expect(inserts).toHaveLength(0);
});

test('capture: unknown referrer username is rejected', async () => {
  queues.profiles = [{ data: null }];
  const r = await referralService.capture({ referredId: 'B', ref: 'ghost' });
  expect(r.captured).toBe(false);
  expect(inserts).toHaveLength(0);
});

test('capture: valid referrer + un-converted referred writes a pending referral', async () => {
  queues.profiles = [{ data: { id: 'A', is_host: true } }];
  queues.subscription_payments = [{ count: 0 }];
  const r = await referralService.capture({ referredId: 'B', ref: 'hostA' });
  expect(r.captured).toBe(true);
  expect(inserts[0].payload).toMatchObject({ referrer_id: 'A', referred_id: 'B', status: 'pending' });
});

test('capture: already-converted referred is NOT retro-attributed', async () => {
  queues.profiles = [{ data: { id: 'A', is_host: true } }];
  queues.subscription_payments = [{ count: 2 }]; // already paid
  const r = await referralService.capture({ referredId: 'B', ref: 'hostA' });
  expect(r).toMatchObject({ captured: false, reason: 'already converted' });
  expect(inserts).toHaveLength(0);
});
