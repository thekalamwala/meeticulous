// Svix signature verification for the Resend webhook (security-critical path).
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const crypto = require('crypto');
const { _verify } = require('../../controllers/resendWebhookController');

const secret = 'whsec_' + Buffer.from('a-strong-signing-secret-value').toString('base64');
const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');

function sign(id, ts, raw) {
  return crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');
}
function headers(id, ts, sig) {
  return { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` };
}

const now = () => Math.floor(Date.now() / 1000).toString();

test('accepts a correctly signed payload', () => {
  const id = 'msg_1', ts = now(), raw = '{"type":"email.opened"}';
  expect(_verify(raw, headers(id, ts, sign(id, ts, raw)), secret)).toBe(true);
});

test('rejects a tampered body', () => {
  const id = 'msg_2', ts = now(), raw = '{"type":"email.opened"}';
  const sig = sign(id, ts, raw);
  expect(_verify('{"type":"email.clicked"}', headers(id, ts, sig), secret)).toBe(false);
});

test('rejects a stale timestamp (replay guard)', () => {
  const id = 'msg_3', ts = (Math.floor(Date.now() / 1000) - 3600).toString(), raw = '{}';
  expect(_verify(raw, headers(id, ts, sign(id, ts, raw)), secret)).toBe(false);
});

test('rejects a wrong secret', () => {
  const id = 'msg_4', ts = now(), raw = '{}';
  expect(_verify(raw, headers(id, ts, sign(id, ts, raw)), 'whsec_' + Buffer.from('different').toString('base64'))).toBe(false);
});

test('rejects missing svix headers', () => {
  expect(_verify('{}', {}, secret)).toBe(false);
});
