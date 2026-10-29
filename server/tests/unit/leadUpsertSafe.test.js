'use strict';
// PR-1 (real-time leads): safeUpsertLead must pass source through on success and
// swallow every error into null on failure — the guarantee the signup / booking /
// enterprise hooks rely on to never break the primary flow.

const state = { existing: null, inserted: null, throwOnFrom: false };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from() {
      if (state.throwOnFrom) throw new Error('db down');
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() { return Promise.resolve({ data: state.existing, error: null }); },
        insert(row) {
          state.inserted = [].concat(row)[0];
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'lead1', ...state.inserted }, error: null }) }) };
        },
        update() { return { eq: () => Promise.resolve({ data: null, error: null }) }; },
      };
    },
  },
  supabase: {},
}));
jest.mock('../../services/crm/activity', () => ({ logActivity: async () => {} }));

const { safeUpsertLead } = require('../../services/crm/leadService');

beforeEach(() => { state.existing = null; state.inserted = null; state.throwOnFrom = false; });

test('inserts a new lead and stamps the given source', async () => {
  const r = await safeUpsertLead(
    { name: 'Test Host', email: 'h@x.com' },
    { source: 'host_signup', createdBy: 'signup' }
  );
  expect(r).not.toBeNull();
  expect(r.created).toBe(true);
  expect(state.inserted.source).toBe('host_signup');
  expect(state.inserted.email).toBe('h@x.com');
});

test('swallows DB errors — returns null, never throws', async () => {
  state.throwOnFrom = true;
  let threw = false;
  let out;
  try { out = await safeUpsertLead({ email: 'x@y.com' }, { source: 'guest_booking' }); }
  catch { threw = true; }
  expect(threw).toBe(false);
  expect(out).toBeNull();
});
