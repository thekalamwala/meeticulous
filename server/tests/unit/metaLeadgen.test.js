/**
 * Meta Lead Ads webhook — the security-critical bits: X-Hub-Signature-256
 * verification, field_data mapping, and the GET subscribe handshake.
 */
const crypto = require('crypto');

jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/crm/leadService', () => ({ safeUpsertLead: jest.fn() }));

const {
  verifyMetaLeadgen, _internal: { verifySignature, mapFieldData },
} = require('../../controllers/metaLeadgenController');

const sign = (body, secret) =>
  'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('verifySignature (X-Hub-Signature-256)', () => {
  const secret = 'app-secret';
  const body = JSON.stringify({ object: 'page', entry: [] });

  test('accepts a correct signature', () => {
    expect(verifySignature(body, sign(body, secret), secret)).toBe(true);
  });
  test('rejects a tampered body', () => {
    expect(verifySignature(body + 'x', sign(body, secret), secret)).toBe(false);
  });
  test('rejects a signature made with the wrong secret', () => {
    expect(verifySignature(body, sign(body, 'other'), secret)).toBe(false);
  });
  test('rejects when header or secret is missing', () => {
    expect(verifySignature(body, undefined, secret)).toBe(false);
    expect(verifySignature(body, sign(body, secret), undefined)).toBe(false);
  });
});

describe('mapFieldData', () => {
  test('pulls email/phone and prefers full_name', () => {
    expect(mapFieldData([
      { name: 'email', values: ['A@B.com'] },
      { name: 'phone_number', values: ['+91 98765 43210'] },
      { name: 'full_name', values: ['Jane Doe'] },
    ])).toEqual({ email: 'A@B.com', phone: '+91 98765 43210', name: 'Jane Doe' });
  });
  test('falls back to first + last name', () => {
    expect(mapFieldData([
      { name: 'first_name', values: ['Jane'] },
      { name: 'last_name', values: ['Doe'] },
    ]).name).toBe('Jane Doe');
  });
  test('tolerates missing fields', () => {
    expect(mapFieldData([])).toEqual({ email: undefined, phone: undefined, name: undefined });
  });
});

describe('verifyMetaLeadgen (GET handshake)', () => {
  const OLD = process.env.FB_WEBHOOK_VERIFY_TOKEN;
  afterAll(() => { process.env.FB_WEBHOOK_VERIFY_TOKEN = OLD; });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.send = jest.fn(() => res);
    res.sendStatus = jest.fn(() => res);
    return res;
  };

  test('echoes the challenge on a matching token', () => {
    process.env.FB_WEBHOOK_VERIFY_TOKEN = 'secret-tok';
    const res = mockRes();
    verifyMetaLeadgen({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'secret-tok', 'hub.challenge': '42' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('42');
  });
  test('403s on a wrong token', () => {
    process.env.FB_WEBHOOK_VERIFY_TOKEN = 'secret-tok';
    const res = mockRes();
    verifyMetaLeadgen({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '42' } }, res);
    expect(res.sendStatus).toHaveBeenCalledWith(403);
  });
});
