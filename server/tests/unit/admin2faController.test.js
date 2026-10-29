'use strict';
process.env.NODE_ENV = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-for-crypto';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
const { supabaseAdmin } = require('../../config/supabase');
const ctrl = require('../../controllers/adminAuthController');
const { jwtSign, jwtVerify } = require('../../services/adminAuthService');
const speakeasy = require('speakeasy');
const { encrypt } = require('../../utils/cryptoTokens');
const bcrypt = require('bcryptjs');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const staffRow = (over) => ({ id: 'a1', username: 'admin', email: 'a@x.com', name: 'A', is_active: true, role_key: 'super', ...over });
// Minimal chainable supabase mock: maybeSingle/single resolve `row`, update().eq() resolves {}.
const wire = (row) => supabaseAdmin.from.mockImplementation((t) => {
  if (t === 'admin_roles') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { permissions: ['x'] } }) }) }) };
  return {
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row }), single: () => Promise.resolve({ data: row }) }) }),
    update: () => ({ eq: () => Promise.resolve({}) }),
  };
});

beforeEach(() => jest.clearAllMocks());

test('login with totp_enabled returns twofa_required pending token, NO full session', async () => {
  const hash = await bcrypt.hash('pw', 10);
  wire(staffRow({ password_hash: hash, totp_enabled: true }));
  const res = mockRes();
  await ctrl.adminLogin({ body: { identifier: 'admin', password: 'pw' } }, res);
  const b = res.json.mock.calls[0][0];
  expect(b.twofa_required).toBe(true);
  expect(b.token).toBeUndefined();
  expect(b.permissions).toBeUndefined();
  expect(jwtVerify(b.pending_token).type).toBe('admin_2fa');
});

test('login without totp returns enroll_required enroll token', async () => {
  const hash = await bcrypt.hash('pw', 10);
  wire(staffRow({ password_hash: hash, totp_enabled: false }));
  const res = mockRes();
  await ctrl.adminLogin({ body: { identifier: 'admin', password: 'pw' } }, res);
  const b = res.json.mock.calls[0][0];
  expect(b.enroll_required).toBe(true);
  expect(jwtVerify(b.pending_token).type).toBe('admin_2fa_enroll');
  expect(b.token).toBeUndefined();
});

test('verify2fa with a correct TOTP returns a full admin session', async () => {
  const s = speakeasy.generateSecret();
  const code = speakeasy.totp({ secret: s.base32, encoding: 'base32' });
  const pending = jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300);
  wire(staffRow({ totp_enabled: true, totp_secret: encrypt(s.base32), totp_recovery_codes: [], failed_attempts: 0 }));
  const res = mockRes();
  await ctrl.verify2fa({ body: { pending_token: pending, code }, ip: '1.1.1.1' }, res);
  const b = res.json.mock.calls[0][0];
  expect(b.type).toBe('admin');
  expect(jwtVerify(b.token).type).toBe('admin');
  expect(b.permissions).toEqual(['x']);
});

test('verify2fa with wrong code returns 401', async () => {
  const s = speakeasy.generateSecret();
  const pending = jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300);
  wire(staffRow({ totp_enabled: true, totp_secret: encrypt(s.base32), totp_recovery_codes: [], failed_attempts: 0 }));
  const res = mockRes();
  await ctrl.verify2fa({ body: { pending_token: pending, code: '000000' }, ip: '1.1.1.1' }, res);
  expect(res.status).toHaveBeenCalledWith(401);
});

test('confirm2fa with a correct TOTP enables 2FA + returns full session with recovery codes', async () => {
  const s = speakeasy.generateSecret();
  const code = speakeasy.totp({ secret: s.base32, encoding: 'base32' });
  const pending = jwtSign({ type: 'admin_2fa_enroll', sub: 'a1' }, 300);
  wire(staffRow({ totp_secret: encrypt(s.base32), totp_enabled: false }));
  const res = mockRes();
  await ctrl.confirm2fa({ body: { pending_token: pending, code }, ip: '1.1.1.1' }, res);
  const b = res.json.mock.calls[0][0];
  expect(b.type).toBe('admin');
  expect(Array.isArray(b.recovery_codes)).toBe(true);
  expect(b.recovery_codes.length).toBe(8);
});

test('a pending token has a non-admin type so it cannot pass requireAdmin', () => {
  const pending = jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300);
  expect(jwtVerify(pending).type).not.toBe('admin');
});
