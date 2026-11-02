'use strict';
// Auto churn-on-lapse: a money-state lead whose paid term (plan_expires_at) has
// passed → Churned + win-back. We do NOT churn on cancel — only when the term
// actually runs out. System move, so no reason guard.

const mockState = { leads: [], profiles: [], changed: [], enrolled: [] };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from(table) {
      return {
        select() { return this; }, in() { return this; }, not() { return this; },
        order() { return this; }, limit() { return this; },
        then(res, rej) {
          const out = table === 'leads' ? { data: mockState.leads }
            : table === 'profiles' ? { data: mockState.profiles } : { data: [] };
          return Promise.resolve(out).then(res, rej);
        },
      };
    },
  },
  supabase: {},
}));
jest.mock('../../services/crm/leadService', () => ({
  changeStatus: async (id, status, actor, opts) => { mockState.changed.push({ id, status, actor, opts }); },
}));
jest.mock('../../services/crm/sequenceService', () => ({
  enrollByName: async (name, leadId) => { mockState.enrolled.push({ name, leadId }); },
  enroll: async () => {}, stop: async () => {},
}));
jest.mock('../../services/crm/followUpService', () => ({ create: async () => {} }));

const { churnLapsedLeads } = require('../../services/crm/lifecycleEngine');

const NOW = Date.parse('2026-06-01T00:00:00Z');
beforeEach(() => { mockState.leads = []; mockState.profiles = []; mockState.changed = []; mockState.enrolled = []; });

test('lapsed money-state lead → churned (system move) + win-back enrolled', async () => {
  mockState.leads = [{ id: 'L1', status: 'won', profile_id: 'p1' }];
  mockState.profiles = [{ id: 'p1', plan_expires_at: '2026-01-01T00:00:00Z' }]; // past
  const r = await churnLapsedLeads(NOW);
  expect(r.churned).toBe(1);
  expect(mockState.changed).toEqual([{ id: 'L1', status: 'churned', actor: null, opts: { via: 'term_lapsed' } }]);
  expect(mockState.enrolled).toContainEqual({ name: 'Churn-winback', leadId: 'L1' });
});

test('active term (future expiry) → NOT churned (cancel keeps them paid till it lapses)', async () => {
  mockState.leads = [{ id: 'L1', status: 'paid', profile_id: 'p1' }];
  mockState.profiles = [{ id: 'p1', plan_expires_at: '2026-12-01T00:00:00Z' }]; // future
  expect((await churnLapsedLeads(NOW)).churned).toBe(0);
  expect(mockState.changed).toHaveLength(0);
});

test('no plan_expires_at → not churned', async () => {
  mockState.leads = [{ id: 'L1', status: require('../../services/crm/lifecycleRules').ROI, profile_id: 'p1' }];
  mockState.profiles = [{ id: 'p1', plan_expires_at: null }];
  expect((await churnLapsedLeads(NOW)).churned).toBe(0);
});

test('no money-state leads → no-op', async () => {
  expect((await churnLapsedLeads(NOW)).churned).toBe(0);
});

test('only lapsed ones churn in a mixed batch', async () => {
  mockState.leads = [
    { id: 'A', status: 'won', profile_id: 'pa' },     // lapsed
    { id: 'B', status: 'retained', profile_id: 'pb' }, // active
  ];
  mockState.profiles = [
    { id: 'pa', plan_expires_at: '2026-05-01T00:00:00Z' },
    { id: 'pb', plan_expires_at: '2027-01-01T00:00:00Z' },
  ];
  const r = await churnLapsedLeads(NOW);
  expect(r.churned).toBe(1);
  expect(mockState.changed.map((c) => c.id)).toEqual(['A']);
});
