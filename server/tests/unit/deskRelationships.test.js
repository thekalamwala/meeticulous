'use strict';
// PR-5: the Relationship Desk read — open touch recs ranked by priority, then worst
// health, then oldest, with the lead's identity/health flattened onto each rec.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const deskService = require('../../services/crm/deskService');

describe('rankRecommendations', () => {
  const { rankRecommendations } = deskService;

  test('priority wins first', () => {
    const out = rankRecommendations([
      { priority: 'low', health_state: 'at_risk', created_at: '2026-01-01' },
      { priority: 'high', health_state: 'steady', created_at: '2026-01-02' },
    ]);
    expect(out[0].priority).toBe('high');
  });

  test('within a priority, worse health ranks first', () => {
    const out = rankRecommendations([
      { priority: 'high', health_state: 'cooling', created_at: '2026-01-02' },
      { priority: 'high', health_state: 'at_risk', created_at: '2026-01-03' },
    ]);
    expect(out[0].health_state).toBe('at_risk');
  });

  test('ties break to the oldest rec', () => {
    const out = rankRecommendations([
      { priority: 'medium', health_state: 'cooling', created_at: '2026-02-01' },
      { priority: 'medium', health_state: 'cooling', created_at: '2026-01-01' },
    ]);
    expect(out[0].created_at).toBe('2026-01-01');
  });
});

describe('getRelationships', () => {
  const qb = (result) => {
    const b = {};
    for (const m of ['select', 'eq', 'neq', 'limit', 'order', 'in']) b[m] = () => b;
    b.then = (res, rej) => Promise.resolve(result).then(res, rej);
    return b;
  };
  beforeEach(() => jest.clearAllMocks());

  test('unions lead + guest recs, flattens each subject, ranks; caps to limit', async () => {
    const leadRows = [
      { id: 'r1', lead_id: 'L1', subject_type: 'lead', reason: 'cooling', priority: 'medium', created_at: '2026-01-02',
        leads: { name: 'Priya', health_state: 'cooling', health_score: 44, last_meaningful_interaction_at: '2026-01-01', last_automated_touch_at: '2026-01-05' } },
    ];
    const guestRows = [
      { id: 'g1', contact_id: 'C9', subject_type: 'guest', reason: 'at_risk', priority: 'high', created_at: '2026-01-03',
        contacts: { name: 'Rahul', health_state: 'at_risk', health_score: 20, last_meaningful_interaction_at: null, last_automated_touch_at: null } },
    ];
    supabaseAdmin.from
      .mockReturnValueOnce(qb({ data: leadRows, error: null }))    // lead query
      .mockReturnValueOnce(qb({ data: guestRows, error: null }));  // guest query
    const { count, items } = await deskService.getRelationships(25);
    expect(count).toBe(2);
    expect(items[0]).toMatchObject({ id: 'g1', subject_type: 'guest', name: 'Rahul', contact_id: 'C9', health_state: 'at_risk' }); // high priority first
    expect(items[1]).toMatchObject({ id: 'r1', subject_type: 'lead', name: 'Priya', health_score: 44 });
    expect(items[1].last_automated_touch_at).toBe('2026-01-05');
  });

  test('lead query error (pre-v3.136 table missing) → empty queue, not a 500', async () => {
    supabaseAdmin.from.mockReturnValue(qb({ data: null, error: { message: 'relation "touch_recommendations" does not exist' } }));
    expect(await deskService.getRelationships(25)).toEqual({ count: 0, items: [] });
  });

  test('guest query fails soft (pre-v3.139 contacts columns) → lead recs still returned', async () => {
    const leadRows = [{ id: 'r1', lead_id: 'L1', subject_type: 'lead', reason: 'cooling', priority: 'medium', created_at: '2026-01-02', leads: { name: 'Priya', health_state: 'cooling' } }];
    supabaseAdmin.from
      .mockReturnValueOnce(qb({ data: leadRows, error: null }))
      .mockReturnValueOnce(qb({ data: null, error: { message: 'column contacts.health_state does not exist' } }));
    const { count, items } = await deskService.getRelationships(25);
    expect(count).toBe(1);
    expect(items[0].name).toBe('Priya');
  });
});
