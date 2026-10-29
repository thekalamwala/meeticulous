'use strict';
const {
  STATES, STATES_FOR_CLIENT, isValidStateCode, normalizeState,
  isValidGstin, stateCodeFromGstin, resolvePlaceOfSupply,
} = require('../../services/stateService');

describe('stateService — canonical states', () => {
  test('covers all 36 active states + UTs', () => {
    expect(STATES).toHaveLength(36);
    expect(STATES_FOR_CLIENT).toHaveLength(36);
  });

  test('every code is a distinct valid 2-digit GST code', () => {
    const codes = STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^\d{2}$/);
  });

  test('isValidStateCode accepts 01–38 canon + 97, rejects junk', () => {
    expect(isValidStateCode('21')).toBe(true);   // Odisha
    expect(isValidStateCode('27')).toBe(true);   // Maharashtra
    expect(isValidStateCode('97')).toBe(true);   // Other Territory
    expect(isValidStateCode('99')).toBe(false);
    expect(isValidStateCode('ZZ')).toBe(false);
    expect(isValidStateCode('')).toBe(false);
    expect(isValidStateCode(null)).toBe(false);
  });
});

describe('stateService — normalizeState (Odisha/Orissa/OD/21 collapse)', () => {
  test.each([
    ['Odisha', '21'], ['odisha', '21'], ['Orissa', '21'], ['OD', '21'], ['21', '21'], [21, '21'],
    ['Maharashtra', '27'], ['MH', '27'], ['27', '27'],
    ['Tamilnadu', '33'], ['Pondicherry', '34'], ['Uttaranchal', '05'],
    ['1', '01'],  // single-digit padding → Jammu and Kashmir
  ])('normalizes %s → code %s', (input, code) => {
    expect(normalizeState(input)?.code).toBe(code);
  });

  test('legacy obsolete codes still resolve for old data', () => {
    expect(normalizeState('28')?.name).toBe('Andhra Pradesh'); // pre-bifurcation
    expect(normalizeState('25')?.name).toBe('Dadra and Nagar Haveli and Daman and Diu'); // old Daman & Diu
  });

  test('unknown / empty → null', () => {
    expect(normalizeState('Atlantis')).toBeNull();
    expect(normalizeState('')).toBeNull();
    expect(normalizeState(null)).toBeNull();
  });
});

describe('stateService — GSTIN parsing', () => {
  test('valid GSTIN yields its embedded state code', () => {
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
    expect(stateCodeFromGstin('27AAPFU0939F1ZV')).toBe('27'); // Maharashtra
    expect(stateCodeFromGstin('21AAMCT8270C1ZF')).toBe('21'); // Odisha (seller)
  });
  test('invalid GSTIN → null', () => {
    expect(isValidGstin('nope')).toBe(false);
    expect(stateCodeFromGstin('badgstin')).toBeNull();
  });
});

describe('stateService — resolvePlaceOfSupply precedence', () => {
  test('GSTIN state code wins over everything', () => {
    const r = resolvePlaceOfSupply({ gstin: '27AAPFU0939F1ZV', state: 'Odisha', stateCode: '21' });
    expect(r.code).toBe('27');
    expect(r.source).toBe('gstin');
    expect(r.mismatch).toBe(true); // GSTIN says 27 but caller sent 21
  });

  test('explicit valid stateCode used when no GSTIN', () => {
    const r = resolvePlaceOfSupply({ state: 'Karnataka', stateCode: '29' });
    expect(r.code).toBe('29');
    expect(r.source).toBe('state_code');
    expect(r.mismatch).toBe(false);
  });

  test('typed state NAME resolves to a code (the booking-flow gap)', () => {
    const r = resolvePlaceOfSupply({ state: 'Maharashtra' });
    expect(r.code).toBe('27');
    expect(r.source).toBe('state_name');
  });

  test('nothing usable → null (caller applies Odisha supplier default)', () => {
    expect(resolvePlaceOfSupply({})).toBeNull();
    expect(resolvePlaceOfSupply({ state: '', stateCode: '', gstin: '' })).toBeNull();
    expect(resolvePlaceOfSupply({ stateCode: '99' })).toBeNull(); // invalid code, no name
  });

  test('GSTIN + matching state → no mismatch', () => {
    const r = resolvePlaceOfSupply({ gstin: '21AAMCT8270C1ZF', state: 'Odisha', stateCode: '21' });
    expect(r.code).toBe('21');
    expect(r.mismatch).toBe(false);
  });
});
