'use strict';
// The universal placeholder-recipient guard in the provider resolver: a
// p<phone>@users.bookasloth.app address is never handed to a real provider, from any
// email path (CRM / transactional / campaign). Short-circuits to a benign success.
jest.mock('../../services/email/providers/smtpProvider', () => ({ name: 'smtp', sendEmail: jest.fn(async () => ({ success: true, id: 's1' })) }));
jest.mock('../../services/email/providers/resendProvider', () => ({ name: 'resend', sendEmail: jest.fn(async () => ({ success: true, id: 'r1' })) }));
jest.mock('../../services/email/providers/sesProvider', () => ({ name: 'ses', sendEmail: jest.fn(async () => ({ success: true, id: 'e1' })) }));

const resend = require('../../services/email/providers/resendProvider');
const { getProvider } = require('../../services/email/providers');

beforeEach(() => jest.clearAllMocks());

test('a placeholder recipient short-circuits — the real provider is never called', async () => {
  const r = await getProvider('resend').sendEmail({ to: 'p919876543210@users.bookasloth.app', subject: 'x', html: '<p>x</p>' });
  expect(r).toMatchObject({ success: true, skipped: true, reason: 'placeholder_recipient' });
  expect(resend.sendEmail).not.toHaveBeenCalled();
});

test('a real recipient delegates to the configured provider', async () => {
  const r = await getProvider('resend').sendEmail({ to: 'ada@gmail.com', subject: 'x', html: '<p>x</p>' });
  expect(r).toMatchObject({ success: true, id: 'r1' });
  expect(resend.sendEmail).toHaveBeenCalledTimes(1);
});

test('an array recipient whose first address is a placeholder is also skipped', async () => {
  const r = await getProvider('resend').sendEmail({ to: ['p91987@users.bookasloth.app'], subject: 'x', html: 'y' });
  expect(r.skipped).toBe(true);
  expect(resend.sendEmail).not.toHaveBeenCalled();
});

test('the wrapper preserves the provider name', () => {
  expect(getProvider('resend').name).toBe('resend');
});

test('reply-to is forced to the support inbox, overriding any caller/persona value', async () => {
  await getProvider('resend').sendEmail({
    to: 'ada@gmail.com', subject: 'x', html: 'y', replyTo: 'aastha@bookasloth.in',
  });
  expect(resend.sendEmail).toHaveBeenCalledTimes(1);
  expect(resend.sendEmail.mock.calls[0][0].replyTo).toBe('bolt@bookasloth.in');
});
