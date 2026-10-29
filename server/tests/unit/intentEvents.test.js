'use strict';
// Intent sink: only allow-listed events with an identifier are stored, and
// identifiers are normalised (email lowercased, phone country-coded).
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { buildEventRow, ALLOWED } = require('../../services/crm/intentEvents');

test('rejects an event not on the allow-list', () => {
  expect(buildEventRow({ event: 'hacked_the_db', email: 'a@b.com' })).toEqual({ ok: false, reason: 'unknown_event' });
});

test('rejects an event with no identifier (anonymous)', () => {
  expect(buildEventRow({ event: 'pricing_viewed' })).toEqual({ ok: false, reason: 'no_identifier' });
});

test('normalises email + phone into the row', () => {
  const r = buildEventRow({ event: 'demo_requested', email: '  Ada@X.COM ', phone: '9876543210', meta: { plan: 'studio' } });
  expect(r.ok).toBe(true);
  expect(r.row.email).toBe('ada@x.com');
  expect(r.row.phone).toBe('919876543210'); // 10-digit → +91 assumed
  expect(r.row.event).toBe('demo_requested');
  expect(r.row.meta).toEqual({ plan: 'studio' });
  expect(r.row.source).toBe('web');
});

test('email-only or phone-only is enough', () => {
  expect(buildEventRow({ event: 'signup_started', email: 'x@y.com' }).ok).toBe(true);
  expect(buildEventRow({ event: 'signup_started', phone: '9876543210' }).ok).toBe(true);
});

test('non-object meta collapses to {}', () => {
  expect(buildEventRow({ event: 'plan_viewed', email: 'x@y.com', meta: 'nope' }).row.meta).toEqual({});
});

test('allow-list is the documented set', () => {
  expect(ALLOWED.has('enterprise_inquiry')).toBe(true);
  expect(ALLOWED.has('newsletter_signup')).toBe(true);
});
