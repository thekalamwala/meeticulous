'use strict';
const speakeasy = require('speakeasy');
const svc = require('../../services/admin2faService');

test('newSecret returns a base32 secret and an otpauth keyuri', () => {
  const { secret, otpauth } = svc.newSecret('admin@x.com');
  expect(typeof secret).toBe('string');
  expect(secret.length).toBeGreaterThan(10);
  expect(otpauth).toMatch(/^otpauth:\/\/totp\//);
});

test('verifyToken accepts a current standard TOTP code and rejects a wrong one', () => {
  const { secret } = svc.newSecret('admin@x.com');
  const good = speakeasy.totp({ secret, encoding: 'base32' });
  expect(svc.verifyToken(good, secret)).toBe(true);
  expect(svc.verifyToken('000000', secret)).toBe(false);
});

test('generateRecoveryCodes returns N distinct codes; hash + match roundtrip', async () => {
  const codes = svc.generateRecoveryCodes(8);
  expect(new Set(codes).size).toBe(8);
  const hashes = await svc.hashRecoveryCodes(codes);
  expect(hashes.length).toBe(8);
  expect(await svc.matchRecoveryCode(codes[2], hashes)).toBe(2);
  expect(await svc.matchRecoveryCode('not-a-code', hashes)).toBe(-1);
}, 20000); // 8 bcrypt hashes + up to 16 compares (cost 10) can exceed the 5s default under parallel load
