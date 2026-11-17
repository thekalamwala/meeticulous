'use strict';
// M2: tier cap (<=3), publish guard (needs a live tier), owner scoping.
// We stub supabaseAdmin with a tiny query builder so the controller logic is tested
// without a DB. Only the branches that matter (caps/guards) are asserted.

const mockCalls = { inserted: null };
let mockScenario = {};

jest.mock('../../../config/supabase', () => {
  const builder = (table) => {
    const q = {
      _table: table, _filters: {},
      select: () => q, eq: () => q, maybeSingle: () => q,
      insert: (row) => { mockCalls.inserted = { table, row }; return q; },
      update: () => q, upsert: () => q, delete: () => q,
      // head:true count query resolves with { count }
      then: undefined,
    };
    // terminal resolvers depend on table + mockScenario
    q.single = async () => ({ data: mockScenario.single ?? null, error: mockScenario.singleErr ?? null });
    q.maybeSingle = async () => ({ data: mockScenario.maybeSingle ?? null, error: null });
    // count path: select('id',{count:'exact',head:true}) -> returns a thenable
    q.select = (cols, opts) => {
      if (opts && opts.head) {
        return { eq: () => ({ eq: () => ({ count: mockScenario.count ?? 0 }), count: mockScenario.count ?? 0 }) };
      }
      return q;
    };
    return q;
  };
  return { supabaseAdmin: { from: (t) => builder(t) } };
});

const ctl = require('../../../controllers/membershipController');

const mkRes = () => {
  const res = {};
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

beforeEach(() => { mockScenario = {}; mockCalls.inserted = null; });

describe('addTier cap', () => {
  test('rejects a 4th tier', async () => {
    mockScenario.maybeSingle = { id: 'prog1' }; // callerProgramId
    mockScenario.count = 3;                      // already 3 tiers
    const res = mkRes();
    await ctl.addTier({ user: { id: 'h' }, body: { name: 'X', type: 'paid', price_inr: 100 } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/at most 3 tiers/);
    expect(mockCalls.inserted).toBeNull();
  });
  test('rejects paid tier with no price', async () => {
    mockScenario.maybeSingle = { id: 'prog1' };
    mockScenario.count = 0;
    const res = mkRes();
    await ctl.addTier({ user: { id: 'h' }, body: { name: 'X', type: 'paid' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/price/);
  });
  test('requires a program first', async () => {
    mockScenario.maybeSingle = null; // no program
    const res = mkRes();
    await ctl.addTier({ user: { id: 'h' }, body: { name: 'X', type: 'free' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/program first/);
  });
});

describe('setPublished guard', () => {
  test('cannot go live with zero live tiers', async () => {
    mockScenario.maybeSingle = { id: 'prog1' };
    mockScenario.count = 0; // no live tiers
    const res = mkRes();
    await ctl.setPublished({ user: { id: 'h' }, body: { live: true } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/at least one tier/);
  });
});
