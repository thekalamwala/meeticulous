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
      insert: (row) => { mockCalls.inserted = { table, row }; (mockCalls.writes ||= []).push(row); return q; },
      update: (row) => { (mockCalls.writes ||= []).push(row); return q; }, upsert: () => q, delete: () => q,
      // a plain list read (select('type').eq(...)) resolves with mockScenario.rows
      then: (resolve) => resolve({ data: mockScenario.rows ?? [], error: null }),
    };
    // terminal resolvers depend on table + mockScenario; singleErrs is a queue
    // (one error per call) for the schema-fallback retry.
    q.single = async () => ({
      data: mockScenario.single ?? null,
      error: (mockScenario.singleErrs && mockScenario.singleErrs.shift()) ?? mockScenario.singleErr ?? null,
    });
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

beforeEach(() => { mockScenario = {}; mockCalls.inserted = null; mockCalls.writes = []; });

describe('addTier cap', () => {
  test('rejects a 4th tier', async () => {
    mockScenario.maybeSingle = { id: 'prog1' }; // callerProgramId
    mockScenario.rows = [{ type: 'free' }, { type: 'paid' }, { type: 'paid' }]; // already 3 tiers
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

describe('addTier paid cap + cover/description', () => {
  test('a 3rd PAID tier is refused (max 2 paid)', async () => {
    mockScenario.maybeSingle = { id: 'prog1' };
    mockScenario.rows = [{ type: 'paid' }, { type: 'paid' }];
    const res = mkRes();
    await ctl.addTier({ user: { id: 'h' }, body: { name: 'X', type: 'paid', price_inr: 100 } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/at most 2 paid/);
    expect(mockCalls.inserted).toBeNull();
  });
  test('a 3rd tier is allowed when it is free, and carries cover + description', async () => {
    mockScenario.maybeSingle = { id: 'prog1' };
    mockScenario.rows = [{ type: 'paid' }, { type: 'paid' }];
    mockScenario.single = { id: 't3' };
    const res = mkRes();
    await ctl.addTier({ user: { id: 'h' }, body: {
      name: 'Friends', type: 'free', cover_url: 'https://x.test/c.jpg', description: 'Say hi', perks: ['Updates'],
    } }, res);
    expect(res.statusCode).toBe(201);
    expect(mockCalls.inserted.row).toMatchObject({ type: 'free', position: 2, cover_url: 'https://x.test/c.jpg', description: 'Say hi' });
  });
  test('a non-http cover is dropped', async () => {
    mockScenario.maybeSingle = { id: 'prog1' };
    mockScenario.single = { id: 't1' };
    await ctl.addTier({ user: { id: 'h' }, body: { name: 'X', type: 'free', cover_url: 'javascript:alert(1)' } }, mkRes());
    expect(mockCalls.inserted.row.cover_url).toBeNull();
  });
  test('before v3.228 is applied, the write retries without cover/description', async () => {
    mockScenario.maybeSingle = { id: 'prog1' };
    mockScenario.single = { id: 't1' };
    mockScenario.singleErrs = [{ message: "Could not find the 'cover_url' column of 'community_membership_tiers' in the schema cache" }];
    const res = mkRes();
    await ctl.addTier({ user: { id: 'h' }, body: { name: 'X', type: 'free', cover_url: 'https://x.test/c.jpg' } }, res);
    expect(res.statusCode).toBe(201);
    expect(mockCalls.writes).toHaveLength(2);
    expect(mockCalls.writes[1]).not.toHaveProperty('cover_url');
    expect(mockCalls.writes[1]).not.toHaveProperty('description');
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
