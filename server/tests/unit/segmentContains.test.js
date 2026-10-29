'use strict';
// 'contains' op: tag-array membership over a prospect audience (the Topmate lists).
const contacts = [
  { id: 'p1', email: 'p1@x', contact_type: 'prospect', email_opt_in: true, email_suppressed: false, attributes: { tags: ['topmate', 'coach', 'grade-a'] } },
  { id: 'p2', email: 'p2@x', contact_type: 'prospect', email_opt_in: true, email_suppressed: false, attributes: { tags: ['topmate', 'developer'] } },
  { id: 'p3', email: 'p3@x', contact_type: 'prospect', email_opt_in: false, email_suppressed: false, attributes: { tags: ['topmate', 'coach'] } }, // opted out
  { id: 'g1', email: 'g1@x', contact_type: 'guest', email_opt_in: true, email_suppressed: false, attributes: {} },
];
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({ select: () => Promise.resolve({ data: contacts, error: null }) }) },
  supabase: {},
}));
const segmentService = require('../../services/segmentService');

test('contains on attributes.tags targets a prospect tag, consent enforced', async () => {
  const r = await segmentService.resolve(
    { contact_type: 'prospect', filters: [{ field: 'tags', op: 'contains', value: 'coach' }] }, 'email');
  expect(r.map((c) => c.id)).toEqual(['p1']); // p3 also has coach but opted out
});

test('all prospects (no filter) excludes guests and opted-out', async () => {
  const r = await segmentService.resolve({ contact_type: 'prospect' }, 'email');
  expect(r.map((c) => c.id).sort()).toEqual(['p1', 'p2']);
});

test('contains misses when the tag is absent', async () => {
  const r = await segmentService.resolve(
    { contact_type: 'prospect', filters: [{ field: 'tags', op: 'contains', value: 'finance' }] }, 'email');
  expect(r).toEqual([]);
});
