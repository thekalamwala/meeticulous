'use strict';
// plainBody — founder "cold" email styling: one CTA button, everything else inline.
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../services/crm/sendGate', () => ({ canSend: jest.fn() }));
jest.mock('../../services/email/communicationEngine', () => ({ loadSettings: jest.fn() }));
const { plainBody } = require('../../services/crm/emailService');

const BUTTON = 'display:inline-block;background:#FE5100';

test('a bare link becomes the orange CTA button', () => {
  expect(plainBody('<a href="https://x.in">Go</a>')).toContain(BUTTON);
});

test('class="sig" stays a dark inline link', () => {
  const out = plainBody('<a class="sig" href="https://x.in">Shubham</a>');
  expect(out).not.toContain(BUTTON);
  expect(out).toContain('color:#1f2733;text-decoration:underline;');
});

test('class="inline" is an orange underlined text link, not a button', () => {
  const out = plainBody('<a class="inline" href="https://x.in">bookasloth.com</a>');
  expect(out).not.toContain(BUTTON);
  expect(out).toContain('<a href="https://x.in" style="color:#FE5100;text-decoration:underline;">bookasloth.com</a>');
});
