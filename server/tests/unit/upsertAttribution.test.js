'use strict';
// upsertLead attribution: first-touch preserved, last-touch refreshed, and a
// schema fallback so lead capture never breaks when v3.120 isn't applied yet.

const state = { existing: null, inserted: null, updated: null, insertErrOnce: null };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() { return Promise.resolve({ data: state.existing, error: null }); },
        insert(row) {
          state.inserted = [].concat(row)[0];
          return { select: () => ({ single: () => {
            if (state.insertErrOnce) { const e = state.insertErrOnce; state.insertErrOnce = null; return Promise.resolve({ data: null, error: e }); }
            return Promise.resolve({ data: { id: 'lead1', ...state.inserted }, error: null });
          } }) };
        },
        update(patch) { state.updated = patch; return { eq: () => Promise.resolve({ data: null, error: null }) }; },
      };
    },
  },
  supabase: {},
}));
jest.mock('../../services/crm/activity', () => ({ logActivity: async () => {} }));
jest.mock('../../services/crm/intentEvents', () => ({ attachToLead: async () => {} }));

const { upsertLead } = require('../../services/crm/leadService');
beforeEach(() => { state.existing = null; state.inserted = null; state.updated = null; state.insertErrOnce = null; });

const att = { utm_source: 'google', utm_campaign: 'launch' };

test('create stamps utm columns + first_touch + last_touch', async () => {
  await upsertLead({ email: 'h@x.com' }, { source: 'newsletter', attribution: att });
  expect(state.inserted.utm_source).toBe('google');
  expect(state.inserted.first_touch).toMatchObject({ utm_source: 'google', utm_campaign: 'launch' });
  expect(state.inserted.last_touch).toMatchObject({ utm_source: 'google' });
});

test('existing lead: first touch preserved, last_touch refreshed', async () => {
  state.existing = { id: 'lead1', email: 'h@x.com', utm_source: 'facebook', first_touch: { utm_source: 'facebook' } };
  await upsertLead({ email: 'h@x.com' }, { source: 'newsletter', attribution: att });
  expect(state.updated.utm_source).toBeUndefined();               // not clobbered (blank-merge skips populated)
  expect(state.updated.last_touch).toMatchObject({ utm_source: 'google' }); // refreshed to newest
  expect(state.updated.first_touch).toBeUndefined();              // already set → left alone
});

test('schema fallback: insert retried without attribution columns on 42703', async () => {
  state.insertErrOnce = { code: '42703', message: 'column "utm_source" does not exist' };
  const r = await upsertLead({ email: 'h@x.com' }, { source: 'newsletter', attribution: att });
  expect(r.created).toBe(true);                                   // lead still created
  expect(state.inserted.utm_source).toBeUndefined();              // retry stripped attribution
  expect(state.inserted.first_touch).toBeUndefined();
});
