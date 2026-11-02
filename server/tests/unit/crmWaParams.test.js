'use strict';
// WhatsApp template params render profile-derived tokens (username, account_name)
// the lead itself doesn't carry.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: () => ({}) } }));

const { renderParams } = require('../../services/crm/messageService');

test('username builds the public profile URL from the linked profile', () => {
  const out = renderParams(['{{first_name}}', '{{booking_link}}/{{username}}'],
    { name: 'Sarang Datarkar' }, { username: 'sarang' });
  expect(out[0]).toBe('Sarang');
  expect(out[1]).toMatch(/\/sarang$/);          // …/sarang (booking_link + username)
});

test('account_name comes from the profile (business/display name)', () => {
  expect(renderParams(['{{account_name}}'], { name: 'x' }, { account_name: 'Eureka Coworking' }))
    .toEqual(['Eureka Coworking']);
});

test('literal params pass through unchanged', () => {
  expect(renderParams(['Meeticulous', '2 Month Addition'], {}, {}))
    .toEqual(['Meeticulous', '2 Month Addition']);
});

test('missing token → empty string (never undefined)', () => {
  expect(renderParams(['{{username}}'], { name: 'x' }, {})).toEqual(['']);
});
