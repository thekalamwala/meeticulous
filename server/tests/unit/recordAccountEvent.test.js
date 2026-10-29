'use strict';
// Phase 2 (money events): recordAccountEvent logs a timeline event and promotes
// a lead to 'paid' the instant a subscription is paid — but never regresses a
// lost / do_not_contact / already-paid lead.

const state = { profileRow: null, leadRow: null, updates: [], activities: [] };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from(table) {
      return {
        _t: table,
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: table === 'profiles' ? state.profileRow : state.leadRow, error: null });
        },
        update(patch) { state.updates.push({ table, patch }); return { eq: () => Promise.resolve({ data: null, error: null }) }; },
        insert(row) {
          const r = [].concat(row)[0];
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'lead1', ...r }, error: null }) }) };
        },
      };
    },
  },
  supabase: {},
}));
jest.mock('../../services/crm/activity', () => ({ logActivity: async (_id, type) => { state.activities.push(type); } }));
jest.mock('../../services/crm/intentEvents', () => ({ attachToLead: async () => {} }));

const { recordAccountEvent } = require('../../services/crm/leadService');

const baseLead = (status) => ({
  id: 'lead1', status, converted_at: null,
  phone: '+919876543210', email: 'h@x.com', profile_id: 'prof1', name: 'Host',
});

beforeEach(() => {
  state.profileRow = { name: 'Host', email: 'h@x.com', phone: '9876543210' };
  state.leadRow = null; state.updates = []; state.activities = [];
});

const statusUpdates = () => state.updates.filter((u) => u.table === 'leads' && u.patch.status);

test('open lead + subscription paid → promotes to paid, stamps converted_at, logs both events', async () => {
  state.leadRow = baseLead('contacted');
  await recordAccountEvent({ profileId: 'prof1', type: 'subscription_started', title: 'Subscribed', promoteToPaid: true, wonAt: '2026-01-01' });
  const su = statusUpdates();
  expect(su).toHaveLength(1);
  expect(su[0].patch.status).toBe('paid');
  expect(su[0].patch.converted_at).toBe('2026-01-01');
  expect(state.activities).toEqual(expect.arrayContaining(['subscription_started', 'status_changed']));
});

test('already-paid lead → event logged, NO status update (no double-convert)', async () => {
  state.leadRow = baseLead('paid');
  await recordAccountEvent({ profileId: 'prof1', type: 'subscription_renewed', title: 'Renewed', promoteToPaid: true });
  expect(statusUpdates()).toHaveLength(0);
  expect(state.activities).toEqual(['subscription_renewed']);
});

test('lost lead → never regressed by a promotion', async () => {
  state.leadRow = baseLead('lost');
  await recordAccountEvent({ profileId: 'prof1', type: 'subscription_started', title: 'Subscribed', promoteToPaid: true });
  expect(statusUpdates()).toHaveLength(0);
});

test('churn event (promoteToPaid false) → logs event only, no status change', async () => {
  state.leadRow = baseLead('paid');
  await recordAccountEvent({ profileId: 'prof1', type: 'subscription_cancelled', title: 'Cancelled' });
  expect(statusUpdates()).toHaveLength(0);
  expect(state.activities).toEqual(['subscription_cancelled']);
});

test('missing profileId or type → no-op null', async () => {
  expect(await recordAccountEvent({ type: 'x' })).toBeNull();
  expect(await recordAccountEvent({ profileId: 'p' })).toBeNull();
});
