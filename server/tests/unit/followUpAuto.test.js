'use strict';
// Phase 4: openAuto opens a deduped automation follow-up in the owner's queue.

const state = { existing: null, ownerRow: { owner_admin_id: 'adm1' }, inserted: null };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from(table) {
      return {
        _t: table,
        select() { return this; },
        eq() { return this; },
        limit() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: table === 'leads' ? state.ownerRow : state.existing, error: null });
        },
        insert(row) {
          state.inserted = [].concat(row)[0];
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'fu1', ...state.inserted }, error: null }) }) };
        },
      };
    },
  },
  supabase: {},
}));
jest.mock('../../services/crm/activity', () => ({ logActivity: async () => {} }));
jest.mock('../../utils/sendEmail', () => async () => {});

const followUpService = require('../../services/crm/followUpService');
beforeEach(() => { state.existing = null; state.ownerRow = { owner_admin_id: 'adm1' }; state.inserted = null; });

test('creates a task with the lead owner, key marker, and future due date', async () => {
  const r = await followUpService.openAuto({ leadId: 'lead1', key: 'auto:churn', title: 'Win back', dueInDays: 1 });
  expect(r.id).toBe('fu1');
  expect(state.inserted.lead_id).toBe('lead1');
  expect(state.inserted.owner_admin_id).toBe('adm1');   // inherited
  expect(state.inserted.created_by).toBe('auto:churn'); // dedup marker
  expect(new Date(state.inserted.due_at).getTime()).toBeGreaterThan(Date.now());
});

test('deduped — an existing open task with the same key blocks a new one', async () => {
  state.existing = { id: 'existing-fu' };
  const r = await followUpService.openAuto({ leadId: 'lead1', key: 'auto:churn', title: 'Win back' });
  expect(r).toEqual({ id: 'existing-fu' });
  expect(state.inserted).toBeNull();                    // no insert
});

test('no owner on the lead → task still created, unassigned', async () => {
  state.ownerRow = { owner_admin_id: null };
  await followUpService.openAuto({ leadId: 'lead1', key: 'auto:payment_failed', title: 'Reach out' });
  expect(state.inserted.owner_admin_id).toBeNull();
});

test('missing required args → null, no insert', async () => {
  expect(await followUpService.openAuto({ key: 'x', title: 't' })).toBeNull();
  expect(await followUpService.openAuto({ leadId: 'l', title: 't' })).toBeNull();
  expect(state.inserted).toBeNull();
});
