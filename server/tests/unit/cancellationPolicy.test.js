'use strict';
/**
 * cancellationPolicy — tier walking + plan/flag resolution (v3.206).
 */
const {
  DEFAULT_TIERS, PRO_DEFAULT_TIERS, FLEXIBLE_TIERS, policyFromPreset,
  normalizeTiers, refundPctFor, resolveCancellationPolicy,
} = require('../../lib/cancellationPolicy');

describe('policyFromPreset (P4 — server owns the tiers)', () => {
  test('standard → null (no override; use the default)', () => {
    expect(policyFromPreset('standard', { isPro: true })).toBeNull();
    expect(policyFromPreset('standard', { isPro: false })).toBeNull();
  });
  test('pro host can set strict / flexible', () => {
    expect(policyFromPreset('strict', { isPro: true })).toEqual({ preset: 'strict', tiers: PRO_DEFAULT_TIERS });
    expect(policyFromPreset('flexible', { isPro: true })).toEqual({ preset: 'flexible', tiers: FLEXIBLE_TIERS });
  });
  test('free host cannot set a Pro-only preset → null', () => {
    expect(policyFromPreset('strict', { isPro: false })).toBeNull();
    expect(policyFromPreset('flexible', { isPro: false })).toBeNull();
  });
  test('unknown preset → null; case-insensitive', () => {
    expect(policyFromPreset('whatever', { isPro: true })).toBeNull();
    expect(policyFromPreset('STRICT', { isPro: true })).toEqual({ preset: 'strict', tiers: PRO_DEFAULT_TIERS });
  });
});

describe('refundPctFor', () => {
  test('default tiers: 100% ≥24h, 50% ≥6h, 0% under', () => {
    expect(refundPctFor(30, DEFAULT_TIERS)).toBe(1);
    expect(refundPctFor(24, DEFAULT_TIERS)).toBe(1);
    expect(refundPctFor(10, DEFAULT_TIERS)).toBe(0.5);
    expect(refundPctFor(6, DEFAULT_TIERS)).toBe(0.5);
    expect(refundPctFor(2, DEFAULT_TIERS)).toBe(0);
    expect(refundPctFor(-5, DEFAULT_TIERS)).toBe(0); // no-show (past start)
  });

  test('pro default tiers are stricter (keeps money inside 48h)', () => {
    expect(refundPctFor(50, PRO_DEFAULT_TIERS)).toBe(1);
    expect(refundPctFor(30, PRO_DEFAULT_TIERS)).toBe(0.5); // 24–48h: 50% (was 100% on default)
    expect(refundPctFor(10, PRO_DEFAULT_TIERS)).toBe(0);   // 6–24h: 0% (was 50%)
  });

  test('falls back to default tiers when tiers are missing/garbage', () => {
    expect(refundPctFor(30, undefined)).toBe(1);
    expect(refundPctFor(10, [])).toBe(0.5);
    expect(refundPctFor(10, [{ hours: 'x', pct: 2 }])).toBe(0.5); // invalid → default
  });
});

describe('normalizeTiers', () => {
  test('drops invalid rows and sorts high→low hours', () => {
    const out = normalizeTiers([{ hours: 6, pct: 0.5 }, { hours: 48, pct: 1 }, { hours: 2, pct: 5 }]);
    expect(out).toEqual([{ hours: 48, pct: 1 }, { hours: 6, pct: 0.5 }]); // pct:5 dropped
  });
  test('returns null when nothing valid', () => {
    expect(normalizeTiers([{ hours: -1, pct: 0.5 }])).toBeNull();
    expect(normalizeTiers('nope')).toBeNull();
  });
});

describe('resolveCancellationPolicy', () => {
  test('flag OFF → default tiers for everyone', () => {
    expect(resolveCancellationPolicy({ isPro: true, flagOn: false }).tiers).toBe(DEFAULT_TIERS);
    expect(resolveCancellationPolicy({ isPro: false, flagOn: false }).tiers).toBe(DEFAULT_TIERS);
  });
  test('flag ON + free host → default tiers', () => {
    expect(resolveCancellationPolicy({ isPro: false, flagOn: true }).tiers).toBe(DEFAULT_TIERS);
  });
  test('flag ON + pro host, no override → pro default tiers', () => {
    expect(resolveCancellationPolicy({ isPro: true, flagOn: true }).tiers).toBe(PRO_DEFAULT_TIERS);
  });
  test('flag ON + pro host with a valid per-service override → the override', () => {
    const custom = { cancellation_policy: { tiers: [{ hours: 72, pct: 1 }, { hours: 0, pct: 0 }] } };
    const out = resolveCancellationPolicy({ service: custom, isPro: true, flagOn: true });
    expect(out.tiers).toEqual([{ hours: 72, pct: 1 }, { hours: 0, pct: 0 }]);
  });
  test('a free host\'s override is ignored (plan-gated at resolve time)', () => {
    const custom = { cancellation_policy: { tiers: [{ hours: 72, pct: 1 }] } };
    expect(resolveCancellationPolicy({ service: custom, isPro: false, flagOn: true }).tiers).toBe(DEFAULT_TIERS);
  });
});
