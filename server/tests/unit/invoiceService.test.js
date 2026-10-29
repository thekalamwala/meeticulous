'use strict';
const {
  fiscalYearFor, fiscalYearLabel, isValidGstin, stateCodeFromGstin,
  placeOfSupply, computeTaxSplit,
} = require('../../services/invoiceService');

describe('fiscalYearFor (Indian FY, 2-digit start year)', () => {
  test('June 2026 -> "26" (FY2026-27)', () => {
    expect(fiscalYearFor(new Date('2026-06-02T00:00:00Z'))).toBe('26');
  });
  test('Feb 2027 -> "26" (still FY2026-27)', () => {
    expect(fiscalYearFor(new Date('2027-02-15T00:00:00Z'))).toBe('26');
  });
  test('April 1 2027 -> "27" (new FY)', () => {
    expect(fiscalYearFor(new Date('2027-04-01T00:00:00Z'))).toBe('27');
  });
  test('label spells the full FY', () => {
    expect(fiscalYearLabel(new Date('2026-06-02T00:00:00Z'))).toBe('FY 2026-27');
  });
});

describe('GSTIN', () => {
  test('valid Odisha GSTIN', () => {
    expect(isValidGstin('21AAMCT8270C1ZF')).toBe(true);
    expect(stateCodeFromGstin('27ABCDE1234F1Z5')).toBe('27');
  });
  test('rejects malformed', () => {
    expect(isValidGstin('NOTAGSTIN')).toBe(false);
    expect(isValidGstin('')).toBe(false);
    expect(stateCodeFromGstin('bad')).toBe(null);
  });
});

describe('placeOfSupply', () => {
  test('GSTIN wins', () => {
    expect(placeOfSupply({ gstin: '27ABCDE1234F1Z5', stateCode: '21' })).toBe('27');
  });
  test('falls back to selected state, then seller', () => {
    expect(placeOfSupply({ stateCode: '19' })).toBe('19');
    expect(placeOfSupply({})).toBe('21');
  });
});

describe('computeTaxSplit (splits the already-charged GST, exact sum)', () => {
  test('intra-state (Odisha buyer) -> CGST+SGST', () => {
    const s = computeTaxSplit(1.80, '21');
    expect(s).toEqual({ cgst: 0.90, sgst: 0.90, igst: 0 });
  });
  test('inter-state -> IGST', () => {
    const s = computeTaxSplit(269.82, '27');
    expect(s).toEqual({ cgst: 0, sgst: 0, igst: 269.82 });
  });
  test('odd paise still sums back to the GST amount', () => {
    const s = computeTaxSplit(0.05, '21');
    expect(Number((s.cgst + s.sgst + s.igst).toFixed(2))).toBe(0.05);
  });
});
