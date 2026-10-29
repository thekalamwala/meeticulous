'use strict';
const { isPlaceholderEmail, PLACEHOLDER_EMAIL_DOMAIN } = require('../../services/email/placeholderEmail');

test('the synthetic phone-only address is a placeholder', () => {
  expect(isPlaceholderEmail('p919876543210@users.bookasloth.app')).toBe(true);
  expect(isPlaceholderEmail('P919876543210@Users.BookASloth.App')).toBe(true); // case-insensitive
  expect(isPlaceholderEmail('  p91987@users.bookasloth.app  ')).toBe(true);    // trims
});

test('real addresses are not placeholders', () => {
  expect(isPlaceholderEmail('ada@gmail.com')).toBe(false);
  expect(isPlaceholderEmail('someone@bookasloth.in')).toBe(false); // the real brand domain
  expect(isPlaceholderEmail('')).toBe(false);
  expect(isPlaceholderEmail(null)).toBe(false);
  expect(isPlaceholderEmail(undefined)).toBe(false);
});

test('domain constant is the users subdomain', () => {
  expect(PLACEHOLDER_EMAIL_DOMAIN).toBe('@users.bookasloth.app');
});
