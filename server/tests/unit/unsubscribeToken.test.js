/**
 * tests/unit/unsubscribeToken.test.js
 * Signed unsubscribe links: round-trip, normalization, tamper rejection.
 */
'use strict';

const { makeToken, verifyToken } = require('../../services/email/unsubscribeToken');

describe('unsubscribeToken', () => {
  test('round-trips an email', () => {
    const t = makeToken('Guest@Example.com');
    expect(t).toContain('.');
    expect(verifyToken(t)).toBe('guest@example.com'); // normalized lower-case
  });

  test('handles emails with + and unicode safely (base64url)', () => {
    const e = 'a.b+tag@déjà.test';
    expect(verifyToken(makeToken(e))).toBe(e.toLowerCase());
  });

  test('rejects a tampered payload (different email, same sig)', () => {
    const t = makeToken('real@x.test');
    const [, sig] = t.split('.');
    const forged = Buffer.from('attacker@x.test').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.' + sig;
    expect(verifyToken(forged)).toBeNull();
  });

  test('rejects a tampered signature', () => {
    const t = makeToken('real@x.test');
    const [payload] = t.split('.');
    expect(verifyToken(`${payload}.deadbeef`)).toBeNull();
  });

  test('rejects garbage / empty / missing dot', () => {
    expect(verifyToken('')).toBeNull();
    expect(verifyToken(null)).toBeNull();
    expect(verifyToken('nodot')).toBeNull();
    expect(verifyToken('a.b.c')).toBeNull();
  });

  test('empty email → empty token', () => {
    expect(makeToken('')).toBe('');
    expect(makeToken(null)).toBe('');
  });
});
