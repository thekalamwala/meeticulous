'use strict';
const { detectRowIssues, summarizeIssues } = require('../../services/gst/gstExceptions');

const clean = { id: 'ok', source_type: 'booking', taxable_value: 100, cgst: 9, sgst: 9, igst: 0, total: 118, place_of_supply: '21', buyer_gstin: null };

const typesOf = (issues) => issues.map((i) => i.type).sort();

describe('gstExceptions.detectRowIssues (seller state 21)', () => {
  test('clean intra-state invoice → no issues', () => {
    expect(detectRowIssues(clean)).toEqual([]);
  });

  test('malformed buyer GSTIN → INVALID_GSTIN', () => {
    const r = { ...clean, buyer_gstin: 'NOTAGSTIN' };
    expect(typesOf(detectRowIssues(r))).toContain('INVALID_GSTIN');
  });

  test('commission invoice with no GSTIN → MISSING_GSTIN', () => {
    const r = { ...clean, source_type: 'commission', place_of_supply: '21' };
    expect(typesOf(detectRowIssues(r))).toContain('MISSING_GSTIN');
  });

  test('total ≠ taxable+GST → TAX_MISMATCH with amount', () => {
    const r = { ...clean, total: 999 };
    const iss = detectRowIssues(r);
    const m = iss.find((i) => i.type === 'TAX_MISMATCH');
    expect(m).toBeTruthy();
    expect(m.amount).toBeGreaterThan(0);
  });

  test('IGST alongside CGST/SGST → HEAD_INCONSISTENCY', () => {
    const r = { ...clean, igst: 5, total: 123 };
    expect(typesOf(detectRowIssues(r))).toContain('HEAD_INCONSISTENCY');
  });

  test('missing place of supply → MISSING_POS', () => {
    const r = { ...clean, place_of_supply: null };
    expect(typesOf(detectRowIssues(r))).toContain('MISSING_POS');
  });

  test('intra-state POS but IGST charged → POS_HEAD_MISMATCH', () => {
    const r = { ...clean, cgst: 0, sgst: 0, igst: 18, total: 118, place_of_supply: '21' };
    expect(typesOf(detectRowIssues(r))).toContain('POS_HEAD_MISMATCH');
  });

  test('inter-state POS but CGST/SGST charged → POS_HEAD_MISMATCH', () => {
    const r = { ...clean, place_of_supply: '27' };
    expect(typesOf(detectRowIssues(r))).toContain('POS_HEAD_MISMATCH');
  });
});

describe('gstExceptions.summarizeIssues', () => {
  test('counts by severity and type', () => {
    const issues = [
      { type: 'TAX_MISMATCH', severity: 'high' },
      { type: 'MISSING_POS', severity: 'medium' },
      { type: 'MISSING_POS', severity: 'medium' },
    ];
    const s = summarizeIssues(issues);
    expect(s.total).toBe(3);
    expect(s.high).toBe(1);
    expect(s.medium).toBe(2);
    expect(s.byType.MISSING_POS).toBe(2);
  });
});
