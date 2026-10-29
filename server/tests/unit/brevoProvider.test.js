'use strict';
// Brevo HTTP-API provider for bulk / sales-automation mail (kept off Resend).
// Verifies: it's the registered MARKETING_PROVIDER, builds the Brevo payload from
// the shared provider interface, and never throws on a failure (so the queue
// retries on Brevo rather than spilling to Resend).

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BREVO_API_KEY = 'test-key';
  global.fetch = jest.fn();
});

test('brevo provider is registered (carries transactional after the swap)', () => {
  const { getProvider } = require('../../services/email/providers');
  expect(getProvider('brevo').name).toBe('brevo');
});

test('marketing routes to resend (transactional↔marketing swap)', () => {
  const { MARKETING_PROVIDER } = require('../../services/email/providers');
  expect(MARKETING_PROVIDER).toBe('resend');
});

test('sends the Brevo payload (persona sender kept) and returns the messageId', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: '<abc@brevo>' }) });
  const provider = require('../../services/email/providers/brevoProvider');
  const r = await provider.sendEmail({
    to: 'lead@gmail.com', subject: 'Hi', html: '<p>x</p>',
    fromName: 'Aastha | Marketing', fromEmail: 'aastha@bookasloth.in', replyTo: 'aastha@bookasloth.in',
  });
  expect(r).toMatchObject({ success: true, id: '<abc@brevo>' });
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toBe('https://api.brevo.com/v3/smtp/email');
  expect(opts.headers['api-key']).toBe('test-key');
  const sent = JSON.parse(opts.body);
  expect(sent.sender).toEqual({ name: 'Aastha | Marketing', email: 'aastha@bookasloth.in' });
  expect(sent.to).toEqual([{ email: 'lead@gmail.com' }]);
  expect(sent.replyTo).toEqual({ email: 'aastha@bookasloth.in' });
});

test('a Brevo error returns success:false and never throws (no provider fallback)', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Key not found' }) });
  const provider = require('../../services/email/providers/brevoProvider');
  const r = await provider.sendEmail({ to: 'lead@gmail.com', subject: 'Hi', html: 'x' });
  expect(r).toMatchObject({ success: false, error: 'Key not found' });
});

test('missing API key fails soft', async () => {
  delete process.env.BREVO_API_KEY;
  const provider = require('../../services/email/providers/brevoProvider');
  const r = await provider.sendEmail({ to: 'lead@gmail.com', subject: 'Hi', html: 'x' });
  expect(r).toMatchObject({ success: false, error: 'BREVO_API_KEY not configured' });
});
