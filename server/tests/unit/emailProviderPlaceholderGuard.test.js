'use strict';
// Pin the forced reply-to so this test is independent of the ambient SUPPORT_REPLY_TO
// (the deploy host sets its own, e.g. Render). Must run before the provider module is
// required below, since providers/index.js reads SUPPORT_REPLY_TO at load time.
process.env.SUPPORT_REPLY_TO = 'reply@meeticulous.test';

// The universal placeholder-recipient guard in the provider resolver: a
// p<phone> placeholder address is never handed to a real provider, from any
// email path (CRM / transactional / campaign). Short-circuits to a benign success.
jest.mock('../../services/email/providers/smtpProvider', () => ({ name: 'smtp', sendEmail: jest.fn(async () => ({ success: true, id: 's1' })) }));
jest.mock('../../services/email/providers/resendProvider', () => ({ name: 'resend', sendEmail: jest.fn(async () => ({ success: true, id: 'r1' })) }));
jest.mock('../../services/email/providers/sesProvider', () => ({ name: 'ses', sendEmail: jest.fn(async () => ({ success: true, id: 'e1' })) }));

const resend = require('../../services/email/providers/resendProvider');
const { getProvider } = require('../../services/email/providers');
const { PLACEHOLDER_EMAIL_DOMAIN } = require('../../services/email/placeholderEmail');

beforeEach(() => jest.clearAllMocks());

test('a placeholder recipient short-circuits — the real provider is never called', async () => {
  const r = await getProvider('resend').sendEmail({ to: `p919876543210${PLACEHOLDER_EMAIL_DOMAIN}`, subject: 'x', html: '<p>x</p>' });
  expect(r).toMatchObject({ success: true, skipped: true, reason: 'placeholder_recipient' });
  expect(resend.sendEmail).not.toHaveBeenCalled();
});

test('a real recipient delegates to the configured provider', async () => {
  const r = await getProvider('resend').sendEmail({ to: 'ada@gmail.com', subject: 'x', html: '<p>x</p>' });
  expect(r).toMatchObject({ success: true, id: 'r1' });
  expect(resend.sendEmail).toHaveBeenCalledTimes(1);
});

test('an array recipient whose first address is a placeholder is also skipped', async () => {
  const r = await getProvider('resend').sendEmail({ to: [`p91987${PLACEHOLDER_EMAIL_DOMAIN}`], subject: 'x', html: 'y' });
  expect(r.skipped).toBe(true);
  expect(resend.sendEmail).not.toHaveBeenCalled();
});

test('the wrapper preserves the provider name', () => {
  expect(getProvider('resend').name).toBe('resend');
});

test('reply-to: caller/per-sender value is honored, env is only the fallback', async () => {
  await getProvider('resend').sendEmail({
    to: 'ada@gmail.com', subject: 'x', html: 'y', replyTo: 'tithi@team.meeticulous.com',
  });
  expect(resend.sendEmail).toHaveBeenCalledTimes(1);
  expect(resend.sendEmail.mock.calls[0][0].replyTo).toBe('tithi@team.meeticulous.com');
});

test('reply-to falls back to SUPPORT_REPLY_TO when the caller sets none', async () => {
  await getProvider('resend').sendEmail({ to: 'ada@gmail.com', subject: 'x', html: 'y' });
  expect(resend.sendEmail.mock.calls[0][0].replyTo).toBe('reply@meeticulous.test');
});
