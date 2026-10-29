'use strict';
// leads→contacts sync: the row builder must tag the lead, suppress DNC on both
// channels, and NEVER clobber an existing contact's consent or downgrade its type.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { buildLeadContactRow } = require('../../services/contactsService');
const NOW = '2025-06-01T00:00:00.000Z';

test('new lead → contactable crm_lead contact, opted in, not suppressed', () => {
  const r = buildLeadContactRow({ email: 'A@X.com', name: 'Ada', phone: '9', status: 'new' }, {}, NOW);
  expect(r.email).toBe('a@x.com');            // normalised
  expect(r.contact_type).toBe('guest');
  expect(r.attributes).toMatchObject({ crm_lead: true, lead_status: 'new' });
  expect(r.source).toBe('crm_lead');
  expect(r.email_opt_in).toBe(true);
  expect(r.email_suppressed).toBe(false);
  // New contact carries a generated uuid: a mixed insert/update batch fails the
  // NOT NULL id if some rows omit it (PostgREST fills explicit NULL, beating the
  // default), so we always set one.
  expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
});

test('DNC lead → suppressed on both channels', () => {
  const r = buildLeadContactRow({ email: 'b@x.com', status: 'new', do_not_contact: true }, {}, NOW);
  expect(r.email_suppressed).toBe(true);
  expect(r.whatsapp_suppressed).toBe(true);
  const r2 = buildLeadContactRow({ email: 'b@x.com', status: 'do_not_contact' }, {}, NOW);
  expect(r2.email_suppressed).toBe(true);
});

test('existing contact: preserve consent, keep id, never demote vendor', () => {
  const prev = { id: 'c1', contact_type: 'vendor', source: 'profile', email_opt_in: false, whatsapp_suppressed: true, attributes: { plan: 'studio' } };
  const r = buildLeadContactRow({ email: 'v@x.com', status: 'qualified' }, prev, NOW);
  expect(r.id).toBe('c1');
  expect(r.contact_type).toBe('vendor');       // not demoted to guest
  expect(r.email_opt_in).toBe(false);          // preserved
  expect(r.whatsapp_suppressed).toBe(true);    // preserved
  expect(r.source).toBe('profile,crm_lead');   // appended
  expect(r.attributes).toMatchObject({ plan: 'studio', crm_lead: true });
});

test('source tag is idempotent (no double append)', () => {
  const r = buildLeadContactRow({ email: 'v@x.com', status: 'new' }, { source: 'profile,crm_lead' }, NOW);
  expect(r.source).toBe('profile,crm_lead');
});

test('non-DNC lead does not resurrect a prior suppression', () => {
  const r = buildLeadContactRow({ email: 'q@x.com', status: 'new' }, { email_suppressed: true }, NOW);
  expect(r.email_suppressed).toBe(true); // preserved, not forced false
});

test('cold import lead → prospect type + tags/profession/grade mirrored onto the contact', () => {
  const r = buildLeadContactRow(
    { email: 'c@x.com', status: 'new', source: 'import', profession: 'coach', tags: ['topmate', 'coach', 'grade-a'], attributes: { grade: 'A', source_dataset: 'topmate' } },
    {}, NOW);
  expect(r.contact_type).toBe('prospect');
  expect(r.attributes).toMatchObject({ crm_lead: true, tags: ['topmate', 'coach', 'grade-a'], profession: 'coach', grade: 'A', source_dataset: 'topmate' });
});

test('cold prospect never demotes an existing real guest', () => {
  const r = buildLeadContactRow({ email: 'g@x.com', status: 'new', source: 'import', tags: ['topmate'] }, { contact_type: 'guest' }, NOW);
  expect(r.contact_type).toBe('guest'); // real guest outranks prospect
});
