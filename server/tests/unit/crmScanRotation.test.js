'use strict';
// The CRM engines read BATCH rows per tick. Before 2026-11-26 they ordered by
// updated_at, which nothing bumps, so every tick re-read the same oldest rows.
// This drives the guest engine over a fake table and checks successive ticks
// walk the whole pool. The lifecycle engine uses the same scanRotation helper.

const mockRows = [];
function mockQuery(table) {
  const st = { table, filters: [], order: null, limit: Infinity, update: null, ids: null };
  const q = {
    select() { return q; }, not() { return q; }, eq() { return q; },
    in(col, vals) { if (col === 'id') st.ids = vals; return q; },
    order(col, opts) { st.order = { col, nullsFirst: !!opts?.nullsFirst }; return q; },
    limit(n) { st.limit = n; return q; },
    update(patch) { st.update = patch; return q; },
    then(res, rej) {
      let data = [];
      if (table === 'contacts' && st.update) {
        for (const r of mockRows) if (st.ids?.includes(r.id)) Object.assign(r, st.update);
      } else if (table === 'contacts') {
        const key = (r) => r[st.order.col];
        data = [...mockRows].sort((a, b) => {
          const x = key(a), y = key(b);
          if (x == null && y == null) return 0;
          if (x == null) return st.order.nullsFirst ? -1 : 1;
          if (y == null) return st.order.nullsFirst ? 1 : -1;
          return x < y ? -1 : x > y ? 1 : 0;
        }).slice(0, st.limit).map((r) => ({ ...r }));
      }
      return Promise.resolve({ data, error: null }).then(res, rej);
    },
  };
  return q;
}

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (t) => mockQuery(t) } }));
jest.mock('../../services/crm/touchRecommendationService', () => ({ upsertOpen: jest.fn(async () => ({ inserted: 0 })) }));

describe('guest engine scan rotation', () => {
  let run;
  beforeAll(() => {
    process.env.GUEST_ENGINE_BATCH = '2';
    jest.isolateModules(() => { ({ run } = require('../../services/crm/guestRelationshipEngine')); });
  });
  afterAll(() => { delete process.env.GUEST_ENGINE_BATCH; });

  test('successive ticks scan different contacts until all are covered', async () => {
    const old = '2026-11-01T00:00:00.000Z';
    mockRows.push(
      { id: 'c1', email: 'a@x.com', contact_type: 'guest', updated_at: old, health_computed_at: null },
      { id: 'c2', email: 'b@x.com', contact_type: 'guest', updated_at: old, health_computed_at: null },
      { id: 'c3', email: 'c@x.com', contact_type: 'guest', updated_at: old, health_computed_at: null },
      { id: 'c4', email: 'd@x.com', contact_type: 'guest', updated_at: old, health_computed_at: null },
    );
    const seen = new Set();
    await run(Date.parse('2026-11-26T10:00:00Z'));
    mockRows.filter((r) => r.health_computed_at).forEach((r) => seen.add(r.id));
    expect(seen.size).toBe(2);
    await run(Date.parse('2026-11-26T11:00:00Z'));
    mockRows.filter((r) => r.health_computed_at).forEach((r) => seen.add(r.id));
    expect([...seen].sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
  });
});
