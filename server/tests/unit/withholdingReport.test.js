/**
 * tests/unit/withholdingReport.test.js — TDS(194-O)/TCS(§52) reporting (v4).
 * Pure aggregation + CSV. DB path (buildWithholdingReport) is exercised via the
 * controllers; here we lock the money math and the filing CSV shape.
 */
'use strict';

const { aggregateWithholding, toCsv } = require('../../services/withholdingReportService');

describe('aggregateWithholding', () => {
  const rows = [
    { host_id: 'h1', tds_amount: 10, tcs_amount: 10 },   // base 1000
    { host_id: 'h1', tds_amount: 5, tcs_amount: 5 },     // base 500
    { host_id: 'h2', tds_amount: 20, tcs_amount: 20 },   // base 2000
    { host_id: 'h3', tds_amount: 0, tcs_amount: 0 },     // free booking — skipped
  ];

  test('groups by host, sums TDS/TCS, derives gross from the withholding base', () => {
    const out = aggregateWithholding(rows);
    expect(out).toHaveLength(2); // h3 skipped (no withholding)
    const h1 = out.find((r) => r.host_id === 'h1');
    expect(h1.tds).toBe(15);
    expect(h1.tcs).toBe(15);
    expect(h1.grossSales).toBe(1500); // (10+5)/0.01
    expect(h1.bookings).toBe(2);
  });

  test('sorts by TDS descending (largest deductee first)', () => {
    const out = aggregateWithholding(rows);
    expect(out[0].host_id).toBe('h2'); // 20 > 15
    expect(out[1].host_id).toBe('h1');
  });

  test('empty input → empty report', () => {
    expect(aggregateWithholding([])).toEqual([]);
  });
});

describe('toCsv', () => {
  const rows = [
    { host_id: 'h1', name: 'Atish Host', pan: 'ABCDE1234F', grossSales: 1500, tds: 15, tcs: 15, bookings: 2 },
    { host_id: 'h2', name: 'No, Comma Ltd', pan: null, grossSales: 2000, tds: 20, tcs: 20, bookings: 1 },
  ];

  test('26Q (TDS) header + rows; no-PAN and comma-name handled', () => {
    const csv = toCsv(rows, 'tds');
    const lines = csv.split('\n');
    expect(lines[0]).toBe('PAN,Deductee/Host,Gross Sales,TDS,Bookings');
    expect(lines[1]).toBe('ABCDE1234F,Atish Host,1500,15,2');
    expect(lines[2]).toBe('NO-PAN,"No, Comma Ltd",2000,20,1'); // comma-quoted
  });

  test('GSTR-8 (TCS) uses the TCS column', () => {
    const csv = toCsv(rows, 'tcs');
    expect(csv.split('\n')[0]).toBe('PAN,Deductee/Host,Gross Sales,TCS,Bookings');
    expect(csv.split('\n')[1]).toBe('ABCDE1234F,Atish Host,1500,15,2');
  });
});
