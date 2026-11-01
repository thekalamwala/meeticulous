'use strict';
const { isPlaceholderEmail, PLACEHOLDER_EMAIL_DOMAIN } = require('../../services/email/placeholderEmail');

test('the synthetic phone-only address is a placeholder', () => {
  expect(isPlaceholderEmail(`p919876543210${PLACEHOLDER_EMAIL_DOMAIN}`)).toBe(true);
  expect(isPlaceholderEmail(`p919876543210${PLACEHOLDER_EMAIL_DOMAIN}`.toUpperCase())).toBe(true); // case-insensitive
  expect(isPlaceholderEmail(`  p91987${PLACEHOLDER_EMAIL_DOMAIN}  `)).toBe(true);    // trims
});

test('real addresses are not placeholders', () => {
  expect(isPlaceholderEmail('ada@gmail.com')).toBe(false);
  expect(isPlaceholderEmail('someone@meeticulous.com')).toBe(false); // the real brand domain
  expect(isPlaceholderEmail('')).toBe(false);
  expect(isPlaceholderEmail(null)).toBe(false);
  expect(isPlaceholderEmail(undefined)).toBe(false);
});

test('domain constant is the users subdomain', () => {
  expect(PLACEHOLDER_EMAIL_DOMAIN).toBe('@users.meeticulous.app');
});
