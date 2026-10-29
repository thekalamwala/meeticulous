'use strict';
// Ingest idempotency, identity guard, and schema-tolerance.

const state = { prior: null, inserted: [], updated: [], missingTable: false };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          if (state.missingTable) return Promise.resolve({ data: null, error: { code: '42P01', message: 'relation "lead_imports" does not exist' } });
          return Promise.resolve({ data: state.prior, error: null });
        },
        insert(row) {
          if (state.missingTable) return { select: () => ({ single: () => Promise.reject({ code: '42P01', message: 'relation "lead_imports" does not exist' }) }) };
          state.inserted.push([].concat(row)[0]);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'imp1' }, error: null }) }) };
        },
        update(patch) { state.updated.push(patch); return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  },
  supabase: {},
}));

const leadService = require('../../services/crm/leadService');
const { ingest } = require('../../services/crm/ingestService');

beforeEach(() => {
  state.prior = null; state.inserted = []; state.updated = []; state.missingTable = false;
  jest.restoreAllMocks();
  jest.spyOn(leadService, 'upsertLead').mockResolvedValue({ lead: { id: 'lead1' }, created: true });
});

test('maps + upserts a form lead, records upserted', async () => {
  const r = await ingest({ provider: 'form', payload: { name: 'Sam', email: 's@x.com', external_id: 'f1' } });
  expect(r).toEqual({ ok: true, status: 'upserted', leadId: 'lead1' });
  expect(leadService.upsertLead).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Sam', email: 's@x.com' }),
    expect.objectContaining({ source: 'form', createdBy: 'ingest:form' }),
  );
  expect(state.updated.some((u) => u.status === 'upserted' && u.lead_id === 'lead1')).toBe(true);
});

test('duplicate (provider, external_id) already upserted → no re-upsert', async () => {
  state.prior = { status: 'upserted', lead_id: 'leadX' };
  const r = await ingest({ provider: 'meta', payload: { leadgen_id: 'lg1', field_data: [{ name: 'email', values: ['a@x.com'] }] } });
  expect(r).toEqual({ ok: true, status: 'duplicate', leadId: 'leadX' });
  expect(leadService.upsertLead).not.toHaveBeenCalled();
});

test('unusable payload (no identity) → skipped, no upsert', async () => {
  const r = await ingest({ provider: 'form', payload: { utm_source: 'google' } });
  expect(r.status).toBe('skipped');
  expect(leadService.upsertLead).not.toHaveBeenCalled();
});

test('unknown provider → error, no upsert', async () => {
  const r = await ingest({ provider: 'nope', payload: {} });
  expect(r).toMatchObject({ ok: false, status: 'error' });
  expect(leadService.upsertLead).not.toHaveBeenCalled();
});

test('schema fallback: lead_imports missing → still upserts the lead', async () => {
  state.missingTable = true;
  const r = await ingest({ provider: 'form', payload: { email: 's@x.com', external_id: 'f2' } });
  expect(r).toEqual({ ok: true, status: 'upserted', leadId: 'lead1' });
  expect(leadService.upsertLead).toHaveBeenCalled();
});
