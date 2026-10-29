const contacts = [
  { id: 'c1', email: 'v1@x', contact_type: 'vendor', email_opt_in: true,  email_suppressed: false, attributes: { plan: 'explorer' } },
  { id: 'c2', email: 'v2@x', contact_type: 'vendor', email_opt_in: true,  email_suppressed: false, attributes: { plan: 'creator' } },
  { id: 'c3', email: 'g1@x', contact_type: 'guest',  email_opt_in: true,  email_suppressed: false, attributes: {} },
  { id: 'c4', email: 'g2@x', contact_type: 'guest',  email_opt_in: false, email_suppressed: false, attributes: {} },
  { id: 'c5', email: 'g3@x', contact_type: 'guest',  email_opt_in: true,  email_suppressed: true,  attributes: {} },
];
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({ select: () => Promise.resolve({ data: contacts, error: null }) }) },
  supabase: {},
}));
const segmentService = require('../../services/segmentService');

test('filters by contact_type', async () => {
  const r = await segmentService.resolve({ contact_type: 'vendor' }, 'email');
  expect(r.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
});

test('applies attribute filters (plan eq)', async () => {
  const r = await segmentService.resolve({ contact_type: 'vendor', filters: [{ field: 'plan', op: 'eq', value: 'explorer' }] }, 'email');
  expect(r.map((c) => c.id)).toEqual(['c1']);
});

test('excludes not-opted-in and suppressed for the email channel', async () => {
  const r = await segmentService.resolve({ contact_type: 'guest' }, 'email');
  // c3 only — c4 opted out, c5 suppressed
  expect(r.map((c) => c.id)).toEqual(['c3']);
});

test('empty definition = all contactable', async () => {
  const r = await segmentService.resolve({}, 'email');
  expect(r.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
});
