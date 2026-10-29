import { describe, test, expect } from 'vitest';
import { resolveFeature } from '../utils/featureBypass';

// resolveFeature(base, key, user) — the pure decision behind useFeature():
// a Supreme holder (user.bypasses_flags) sees a kill-switched feature unless
// it's on the safety denylist. Mirrors the server's requireFeature.
const SUPREME = { bypasses_flags: true, safety_keys: ['razorpay_payment', 'guest_login'] };

describe('resolveFeature', () => {
  test('flag ON → on, regardless of user', () => {
    expect(resolveFeature(true, 'cover_photo', null)).toBe(true);
    expect(resolveFeature(true, 'razorpay_payment', SUPREME)).toBe(true);
  });

  test('flag OFF + no user → off', () => {
    expect(resolveFeature(false, 'cover_photo', null)).toBe(false);
  });

  test('flag OFF + Supreme + non-safety key → on', () => {
    expect(resolveFeature(false, 'cover_photo', SUPREME)).toBe(true);
  });

  test('flag OFF + Supreme + safety key → off', () => {
    expect(resolveFeature(false, 'razorpay_payment', SUPREME)).toBe(false);
  });

  test('flag OFF + non-Supreme user → off', () => {
    expect(resolveFeature(false, 'cover_photo', { bypasses_flags: false })).toBe(false);
  });

  test('tolerates a user with no safety_keys array', () => {
    expect(resolveFeature(false, 'cover_photo', { bypasses_flags: true })).toBe(true);
  });
});
