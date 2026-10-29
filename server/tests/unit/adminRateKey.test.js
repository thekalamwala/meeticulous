'use strict';
/**
 * adminRateKey — the per-admin rate-limit key generator for adminLimiter.
 * A valid admin token must bucket by admin id (own lane, never shared); anything
 * without a usable admin token must bucket by resolved client IP so the limiter
 * still caps unauthenticated abuse.
 */
const { adminRateKey } = require('../../middleware/security');
const { jwtSign } = require('../../services/adminAuthService');

const reqWith = (authorization, ip = '203.0.113.7') => ({ headers: authorization ? { authorization } : {}, ip });

describe('adminRateKey', () => {
  test('keys on admin id for a valid admin token', () => {
    const token = jwtSign({ type: 'admin', sub: 'admin-123', role: 'ops', permissions: [] });
    expect(adminRateKey(reqWith(`Bearer ${token}`))).toBe('admin:admin-123');
  });

  test('two different admins from the SAME ip get separate buckets', () => {
    const a = jwtSign({ type: 'admin', sub: 'a', permissions: [] });
    const b = jwtSign({ type: 'admin', sub: 'b', permissions: [] });
    const k1 = adminRateKey(reqWith(`Bearer ${a}`, '10.0.0.1'));
    const k2 = adminRateKey(reqWith(`Bearer ${b}`, '10.0.0.1'));
    expect(k1).not.toBe(k2);
  });

  test('falls back to client IP when no token', () => {
    expect(adminRateKey(reqWith(null, '198.51.100.9'))).toBe('ip:198.51.100.9');
  });

  test('falls back to client IP on a tampered/invalid token (does not throw)', () => {
    expect(adminRateKey(reqWith('Bearer not.a.jwt', '198.51.100.9'))).toBe('ip:198.51.100.9');
  });

  test('a non-admin token (wrong type) falls back to IP', () => {
    const guest = jwtSign({ type: 'user', sub: 'u-1', permissions: [] });
    expect(adminRateKey(reqWith(`Bearer ${guest}`, '198.51.100.9'))).toBe('ip:198.51.100.9');
  });
});
