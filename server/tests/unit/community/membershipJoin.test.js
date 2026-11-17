'use strict';
// M5 free-join guards: only a live FREE tier of a LIVE program, not your own,
// one membership per host (unique violation -> 409).

let mockTier = null;      // result of the tier lookup (maybeSingle)
let mockInsert = { data: { id: 'sub1' }, error: null }; // result of the insert (single)

jest.mock('../../../config/supabase', () => {
  const q = {
    select: () => q, eq: () => q,
    maybeSingle: async () => ({ data: mockTier, error: null }),
    insert: () => q,
    single: async () => mockInsert,
  };
  return { supabaseAdmin: { from: () => q } };
});
// store is imported by the controller; stub it so requiring it is cheap.
jest.mock('../../../services/community/store', () => ({}));

const ctl = require('../../../controllers/membershipController');
const mkRes = () => { const r = {}; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const liveFree = { id: 't1', type: 'free', status: 'live', program: { host_id: 'host1', status: 'live' } };

beforeEach(() => { mockTier = liveFree; mockInsert = { data: { id: 'sub1' }, error: null }; });

describe('joinFree', () => {
  test('joins a live free tier', async () => {
    const res = mkRes();
    await ctl.joinFree({ user: { id: 'm1' }, body: { tier_id: 't1' } }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.subscription.id).toBe('sub1');
  });
  test('rejects a paid tier', async () => {
    mockTier = { ...liveFree, type: 'paid' };
    const res = mkRes();
    await ctl.joinFree({ user: { id: 'm1' }, body: { tier_id: 't1' } }, res);
    expect(res.statusCode).toBe(400);
  });
  test('rejects a draft tier / draft program', async () => {
    mockTier = { ...liveFree, status: 'draft' };
    const res = mkRes();
    await ctl.joinFree({ user: { id: 'm1' }, body: { tier_id: 't1' } }, res);
    expect(res.statusCode).toBe(400);
  });
  test('cannot join your own membership', async () => {
    const res = mkRes();
    await ctl.joinFree({ user: { id: 'host1' }, body: { tier_id: 't1' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/your own/);
  });
  test('already a member -> 409', async () => {
    mockInsert = { data: null, error: { code: '23505', message: 'duplicate key' } };
    const res = mkRes();
    await ctl.joinFree({ user: { id: 'm1' }, body: { tier_id: 't1' } }, res);
    expect(res.statusCode).toBe(409);
  });
  test('missing tier_id -> 400', async () => {
    const res = mkRes();
    await ctl.joinFree({ user: { id: 'm1' }, body: {} }, res);
    expect(res.statusCode).toBe(400);
  });
});
