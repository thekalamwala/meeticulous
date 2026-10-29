'use strict';
const {
  monthRange, quarterRange, fyRange, resolvePeriod,
  normalizeFyStart, fyTwoDigit, calendarYearFor,
} = require('../../services/gst/gstPeriod');

// IST = UTC+5:30, so an IST civil midnight is 18:30 UTC the previous day.
describe('gstPeriod — IST-aware ranges (gap G6)', () => {
  test('month range: Sep 2026 = [Aug 31 18:30Z, Sep 30 18:30Z)', () => {
    const r = monthRange('26', 9);
    expect(r.from).toBe('2026-08-31T18:30:00.000Z');
    expect(r.to).toBe('2026-09-30T18:30:00.000Z');
    expect(r.label).toBe('Sep 2026');
    expect(r.periodKey).toBe('M09');
    expect(r.fiscalYear).toBe('26');
  });

  test('FY range: FY2026-27 = [Mar 31 2026 18:30Z, Mar 31 2027 18:30Z)', () => {
    const r = fyRange('26');
    expect(r.from).toBe('2026-03-31T18:30:00.000Z');
    expect(r.to).toBe('2027-03-31T18:30:00.000Z');
    expect(r.label).toBe('FY 2026-27');
  });

  test('FY boundary is IST, not UTC: 31-Mar 20:00Z (=1-Apr 01:30 IST) is OUTSIDE FY26', () => {
    const r = fyRange('26');
    const instant = '2027-03-31T20:00:00.000Z';
    expect(instant < r.to).toBe(false); // to is 18:30Z — the late-night IST txn rolls to next FY
  });

  test('quarter range: Q2 = Jul–Sep', () => {
    const r = quarterRange('26', 2);
    expect(r.from).toBe('2026-06-30T18:30:00.000Z');
    expect(r.to).toBe('2026-09-30T18:30:00.000Z');
    expect(r.label).toBe('Q2 FY 2026-27');
  });

  test('quarter Q4 spills into the next calendar year (Jan–Mar)', () => {
    const r = quarterRange('26', 4);
    expect(r.from).toBe('2026-12-31T18:30:00.000Z');
    expect(r.to).toBe('2027-03-31T18:30:00.000Z');
  });

  test('a Jan month under FY26 resolves to calendar 2027', () => {
    expect(calendarYearFor(2026, 1)).toBe(2027);
    const r = monthRange('26', 1);
    expect(r.label).toBe('Jan 2027');
  });

  test('normalizeFyStart accepts 2- and 4-digit', () => {
    expect(normalizeFyStart('26')).toBe(2026);
    expect(normalizeFyStart(2026)).toBe(2026);
    expect(fyTwoDigit(2026)).toBe('26');
  });

  test('resolvePeriod precedence: month > quarter > FY', () => {
    expect(resolvePeriod({ fy: '26', month: 9 }).type).toBe('month');
    expect(resolvePeriod({ fy: '26', quarter: 2 }).type).toBe('quarter');
    expect(resolvePeriod({ fy: '26' }).type).toBe('annual');
  });
});
