'use strict';
// PR-3: touchRecommendationService.upsertOpen is idempotent + humane — one open rec
// per dedupe_key, and a cooldown after a human acts/dismisses so the Desk never
// re-nags. Each test re-requires the module (resetModules) so the tableReady
// schema-fallback flag never leaks between cases.

const NOW = new Date('2026-06-01T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 864e5).toISOString();

function load({ existing = [], selectError = null, insertError = null } = {}) {
  jest.resetModules();
  const state = { existing, selectError, insertError, inserted: null };
  jest.doMock('../../config/supabase', () => ({
    supabaseAdmin: {
      from: () => ({
        select: () => ({ in: () => Promise.resolve({ data: state.existing, error: state.selectError }) }),
        insert: (rows) => { state.inserted = rows; return Promise.resolve({ error: state.insertError }); },
      }),
    },
  }));
  const svc = require('../../services/crm/touchRecommendationService');
  return { svc, state };
}

afterEach(() => jest.resetModules());

const rec = (key) => ({ lead_id: 'L1', reason: 'cooling', touch_type: 'check_in', priority: 'medium', dedupe_key: key });

test('inserts fresh recs when nothing exists', async () => {
  const { svc, state } = load({ existing: [] });
  const r = await svc.upsertOpen([rec('lead:L1:cooling'), rec('lead:L2:at_risk')], NOW);
  expect(r.inserted).toBe(2);
  expect(state.inserted.map((x) => x.dedupe_key)).toEqual(['lead:L1:cooling', 'lead:L2:at_risk']);
  expect(state.inserted.every((x) => x.status === 'open')).toBe(true);
});

test('skips a dedupe_key that already has an open rec', async () => {
  const { svc, state } = load({ existing: [{ dedupe_key: 'lead:L1:cooling', status: 'open', updated_at: daysAgo(1) }] });
  const r = await svc.upsertOpen([rec('lead:L1:cooling'), rec('lead:L2:at_risk')], NOW);
  expect(r.inserted).toBe(1);
  expect(state.inserted.map((x) => x.dedupe_key)).toEqual(['lead:L2:at_risk']);
});

test('suppresses a reason acted/dismissed within the cooldown window', async () => {
  const { svc } = load({ existing: [{ dedupe_key: 'lead:L1:cooling', status: 'done', updated_at: daysAgo(3) }] });
  const r = await svc.upsertOpen([rec('lead:L1:cooling')], NOW);
  expect(r.inserted).toBe(0);
});

test('re-emits a reason whose last action is older than the cooldown', async () => {
  const { svc } = load({ existing: [{ dedupe_key: 'lead:L1:cooling', status: 'done', reason: 'cooling', updated_at: daysAgo(30) }] });
  const r = await svc.upsertOpen([rec('lead:L1:cooling')], NOW);
  expect(r.inserted).toBe(1);
});

test('once-ever reasons (anniversary/milestone) never re-surface after being handled', async () => {
  const annRec = { lead_id: 'L1', reason: 'anniversary', touch_type: 'founder_note', priority: 'medium', dedupe_key: 'lead:L1:anniversary:1y' };
  // acted a whole year ago — a normal reason would re-emit, but a once-ever one must not.
  const { svc } = load({ existing: [{ dedupe_key: 'lead:L1:anniversary:1y', status: 'done', reason: 'anniversary', updated_at: daysAgo(365) }] });
  const r = await svc.upsertOpen([annRec], NOW);
  expect(r.inserted).toBe(0);
});

test('missing table (pre-v3.136) → no-op, never throws, and stays off', async () => {
  const { svc, state } = load({ selectError: { message: 'relation "touch_recommendations" does not exist' } });
  const r1 = await svc.upsertOpen([rec('lead:L1:cooling')], NOW);
  expect(r1.inserted).toBe(0);
  expect(state.inserted).toBeNull();
  // subsequent call is a cheap no-op (tableReady flipped false)
  const r2 = await svc.upsertOpen([rec('lead:L1:cooling')], NOW);
  expect(r2.inserted).toBe(0);
});

test('a concurrent unique-index collision on insert is swallowed, not surfaced', async () => {
  const { svc } = load({ existing: [], insertError: { message: 'duplicate key value violates unique constraint "uq_touch_rec_open"' } });
  const r = await svc.upsertOpen([rec('lead:L1:cooling')], NOW);
  expect(r.inserted).toBe(0); // reported as not-inserted, but no throw
});

test('empty input is a no-op', async () => {
  const { svc } = load();
  expect(await svc.upsertOpen([], NOW)).toEqual({ inserted: 0 });
});
