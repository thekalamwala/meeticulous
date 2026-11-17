'use strict';
// M6 billing: activation is idempotent on razorpay_subscription_id, writes the
// membership subscription row, guards missing notes, and upgrades a free row on conflict.

const mockCalls = [];
let mockExisting = null;      // result of the select-by-subscription-id
let mockInsertErr = null;     // error returned by insert
jest.mock('../../../config/supabase', () => {
  const chain = (table, op) => {
    const q = {
      _t: table, _op: op, _f: {},
      select: () => q, update: (patch) => { q._patch = patch; q._op = 'update'; return q; },
      insert: (row) => { q._row = row; q._op = 'insert'; return q; },
      eq: (k, v) => { q._f[k] = v; return q; },
      in: () => q,
      maybeSingle: async () => ({ data: mockExisting, error: null }),
    };
    // insert() resolves (no .single here) via thenable
    q.then = (res, rej) => {
      mockCalls.push({ table, op: q._op, patch: q._patch, row: q._row, filter: q._f });
      const err = q._op === 'insert' ? mockInsertErr : null;
      return Promise.resolve({ data: null, error: err }).then(res, rej);
    };
    return q;
  };
  return { supabaseAdmin: { from: (t) => chain(t) } };
});
// Razorpay rail not exercised in these pure-activation tests.
jest.mock('../../../services/razorpaySubscriptions', () => ({
  planStillExists: jest.fn(), createSubscription: jest.fn(), cancelSubscription: jest.fn(),
}));
jest.mock('../../../services/razorpayConfig', () => ({ getClient: jest.fn() }));

const billing = require('../../../services/membershipBillingService');

const sub = (over) => ({
  id: 'sub_1', current_end: 1893456000,
  notes: { kind: 'membership', member_id: 'm1', host_id: 'h1', tier_id: 't1' },
  ...over,
});

beforeEach(() => { mockCalls.length = 0; mockExisting = null; mockInsertErr = null; });

describe('activateFromSubscription', () => {
  test('ignores a subscription without membership notes', async () => {
    const r = await billing.activateFromSubscription({ rzpSub: sub({ notes: { kind: 'plan', vendor_id: 'v' } }) });
    expect(r.activated).toBe(false);
    expect(mockCalls.some((c) => c.op === 'insert' || c.op === 'update')).toBe(false);
  });

  test('new subscription: inserts an active membership row', async () => {
    mockExisting = null;
    const r = await billing.activateFromSubscription({ rzpSub: sub() });
    expect(r.activated).toBe(true);
    const ins = mockCalls.find((c) => c.op === 'insert');
    expect(ins.row).toMatchObject({ member_id: 'm1', host_id: 'h1', tier_id: 't1', status: 'active', razorpay_subscription_id: 'sub_1' });
  });

  test('redelivered webhook: existing row is updated, not duplicated', async () => {
    mockExisting = { id: 'row1' };
    const r = await billing.activateFromSubscription({ rzpSub: sub() });
    expect(r.activated).toBe(true);
    expect(mockCalls.some((c) => c.op === 'insert')).toBe(false);
    const upd = mockCalls.find((c) => c.op === 'update');
    expect(upd.patch).toMatchObject({ status: 'active', tier_id: 't1' });
  });

  test('free->paid upgrade: insert conflict (23505) updates the current row to the paid tier', async () => {
    mockExisting = null;
    mockInsertErr = { code: '23505', message: 'duplicate key' };
    const r = await billing.activateFromSubscription({ rzpSub: sub() });
    expect(r.activated).toBe(true);
    const upd = mockCalls.find((c) => c.op === 'update');
    expect(upd.patch).toMatchObject({ status: 'active', razorpay_subscription_id: 'sub_1', tier_id: 't1' });
  });
});
