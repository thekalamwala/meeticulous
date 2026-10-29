/**
 * tests/unit/resendProviderTimeout.test.js
 * E5: resendProvider aborts a hung request and maps it to a timeout error,
 * instead of hanging the queue worker / an immediate OTP send forever.
 */
'use strict';

const provider = require('../../services/email/providers/resendProvider');

const origFetch = global.fetch;
beforeEach(() => { process.env.RESEND_API_KEY = 'k_test'; });
afterEach(() => { global.fetch = origFetch; });

test('aborted request → timeout error (not a hang)', async () => {
  global.fetch = jest.fn((_url, opts) => {
    // The provider must pass an AbortSignal so a hung call can be cancelled.
    expect(opts.signal).toBeDefined();
    const err = new Error('aborted');
    err.name = 'AbortError';
    return Promise.reject(err);
  });
  const r = await provider.sendEmail({ to: 'a@x.test', subject: 's', html: '<p>h</p>' });
  expect(r.success).toBe(false);
  expect(r.error).toMatch(/Resend timeout after \d+ms/);
});

test('normal 200 → success', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'e1' }) }));
  const r = await provider.sendEmail({ to: 'a@x.test', subject: 's', html: '<p>h</p>' });
  expect(r.success).toBe(true);
  expect(r.id).toBe('e1');
});

test('no API key → clean failure, no fetch', async () => {
  delete process.env.RESEND_API_KEY;
  global.fetch = jest.fn();
  const r = await provider.sendEmail({ to: 'a@x.test', subject: 's', html: '<p>h</p>' });
  expect(r.success).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});
