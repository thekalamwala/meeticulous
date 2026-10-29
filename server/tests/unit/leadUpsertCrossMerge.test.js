'use strict';
// upsertLead cross-merge (fix/crm-lead-upsert-cross-merge): when an incoming patch carries
// BOTH a phone and an email that resolve to two DIFFERENT existing lead mockRows (the same
// person, split across a phone-only row and an email-only row), upsertLead merges them via
// merge_lead_rows — oldest survives — instead of orphaning one. Guards the fragmentation
// that v3.129 backfilled from recurring.

const mockRows = {};          // keyed by the filter value (phone or email string)
const mockMerged = { calls: [] };
let mockRpcResult = { data: 'survivor-old', error: null };
let rereadRow = null;

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from() {
      let filter = null;
      const qb = {
        select() { return qb; },
        eq(_col, val) { filter = val; return qb; },
        maybeSingle() { return Promise.resolve({ data: mockRows[filter] || null, error: null }); },
        insert(row) { return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new', ...[].concat(row)[0] }, error: null }) }) }; },
        update() { return { eq: () => Promise.resolve({ data: null, error: null }) }; },
      };
      return qb;
    },
    rpc(fn, args) { mockMerged.calls.push({ fn, args }); return Promise.resolve(mockRpcResult); },
  },
  supabase: {},
}));
jest.mock('../../services/crm/activity', () => ({ logActivity: async () => {} }));
jest.mock('../../services/crm/intentEvents', () => ({ attachToLead: async () => {} }));

const { upsertLead } = require('../../services/crm/leadService');

beforeEach(() => {
  for (const k of Object.keys(mockRows)) delete mockRows[k];
  mockMerged.calls = [];
  mockRpcResult = { data: 'old', error: null };
  rereadRow = null;
});

test('two split mockRows → merge_lead_rows called, oldest is survivor', async () => {
  mockRows['919999999999'] = { id: 'phoneRow', phone: '919999999999', created_at: '2026-01-01T00:00:00Z' };  // older
  mockRows['h@x.com']      = { id: 'emailRow', email: 'h@x.com',      created_at: '2026-05-01T00:00:00Z' };
  mockRows['phoneRow']     = { id: 'phoneRow', phone: '919999999999', email: 'h@x.com' };                     // folded re-read

  await upsertLead({ phone: '919999999999', email: 'h@x.com', name: 'X' }, { source: 'host_signup' });

  expect(mockMerged.calls).toHaveLength(1);
  expect(mockMerged.calls[0].fn).toBe('merge_lead_rows');
  expect(mockMerged.calls[0].args).toEqual({ p_survivor: 'phoneRow', p_loser: 'emailRow' }); // older (Jan) survives
});

test('single matched row → no merge', async () => {
  mockRows['919999999999'] = { id: 'only', phone: '919999999999', email: 'h@x.com', created_at: '2026-01-01T00:00:00Z' };
  mockRows['h@x.com']      = mockRows['919999999999'];   // same row by both keys
  await upsertLead({ phone: '919999999999', email: 'h@x.com' }, { source: 'host_signup' });
  expect(mockMerged.calls).toHaveLength(0);
});

test('merge fn absent → lead capture still succeeds on the older row', async () => {
  mockRows['919999999999'] = { id: 'phoneRow', phone: '919999999999', created_at: '2026-01-01T00:00:00Z' };
  mockRows['h@x.com']      = { id: 'emailRow', email: 'h@x.com',      created_at: '2026-05-01T00:00:00Z' };
  mockRpcResult = { data: null, error: { code: '42883', message: 'function merge_lead_rows does not exist' } };

  const r = await upsertLead({ phone: '919999999999', email: 'h@x.com' }, { source: 'host_signup' });
  expect(r.created).toBe(false);
  expect(r.lead.id).toBe('phoneRow');   // fell back to the older row, no throw
});
