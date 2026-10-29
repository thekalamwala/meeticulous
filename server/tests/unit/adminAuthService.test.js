/**
 * tests/unit/adminAuthService.test.js
 * Admin session token (HS256) + bcrypt password helpers. No DB.
 */
process.env.SUPER_ADMIN_JWT_SECRET = 'unit-test-admin-secret';

const { jwtSign, jwtVerify, hashPassword, verifyPassword } = require('../../services/adminAuthService');

describe('jwtSign / jwtVerify', () => {
  test('round-trips a payload and stamps iat/exp', () => {
    const token = jwtSign({ type: 'admin', sub: 'a1', role: 'finance', permissions: ['finance.view'] });
    const decoded = jwtVerify(token);
    expect(decoded.type).toBe('admin');
    expect(decoded.sub).toBe('a1');
    expect(decoded.role).toBe('finance');
    expect(decoded.permissions).toEqual(['finance.view']);
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('rejects a tampered payload', () => {
    const token = jwtSign({ type: 'admin', sub: 'a1', permissions: ['ops.view'] });
    const [h, , s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ type: 'admin', permissions: ['*'] })).toString('base64url');
    expect(() => jwtVerify(`${h}.${forged}.${s}`)).toThrow();
  });

  test('rejects a tampered signature', () => {
    const token = jwtSign({ type: 'admin', sub: 'a1' });
    expect(() => jwtVerify(token.slice(0, -2) + 'xx')).toThrow();
  });

  test('rejects a malformed token', () => {
    expect(() => jwtVerify('not-a-jwt')).toThrow();
    expect(() => jwtVerify('')).toThrow();
  });

  test('rejects an expired token', () => {
    const token = jwtSign({ type: 'admin', sub: 'a1' });
    const realNow = Date.now;
    Date.now = () => realNow() + 9 * 60 * 60 * 1000; // +9h, past the 8h TTL
    try {
      expect(() => jwtVerify(token)).toThrow(/expired/i);
    } finally {
      Date.now = realNow;
    }
  });

  test('a token signed with a different secret does not verify', () => {
    // Simulate cross-secret forgery by hand-rolling with a wrong key.
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body   = Buffer.from(JSON.stringify({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
    const sig    = crypto.createHmac('sha256', 'WRONG-SECRET').update(header + '.' + body).digest('base64url');
    expect(() => jwtVerify(`${header}.${body}.${sig}`)).toThrow(/signature/i);
  });
});

describe('jwtSign custom TTL + verifyPending', () => {
  const { verifyPending } = require('../../services/adminAuthService');

  test('jwtSign honors a custom ttl', () => {
    const p = jwtVerify(jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300));
    expect(p.exp - p.iat).toBe(300);
  });

  test('jwtSign default ttl is 8h', () => {
    const p = jwtVerify(jwtSign({ type: 'admin', sub: 'a1' }));
    expect(p.exp - p.iat).toBe(8 * 60 * 60);
  });

  test('verifyPending accepts the matching type, rejects others and garbage', () => {
    const t = jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300);
    expect(verifyPending(t, 'admin_2fa').sub).toBe('a1');
    expect(() => verifyPending(t, 'admin_2fa_enroll')).toThrow();
    expect(() => verifyPending('garbage', 'admin_2fa')).toThrow();
  });
});

describe('password hashing', () => {
  test('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('S3cret-Pass!');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword('S3cret-Pass!', hash)).toBe(true);
  });

  test('rejects a wrong password', async () => {
    const hash = await hashPassword('S3cret-Pass!');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  test('a null/empty hash never verifies', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
  });
});
