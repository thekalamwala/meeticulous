import { describe, it, expect } from 'vitest';
import {
  priorityOf, waitMinutes, slaLevel, fmtWait, inboxSort,
  SLA_WARN_MIN, SLA_BREACH_MIN,
} from '../utils/supportSla';

const NOW = Date.parse('2026-08-26T12:00:00Z');
const agoMin = (m) => new Date(NOW - m * 60000).toISOString();

describe('priorityOf', () => {
  it('flags revenue-critical topics High', () => {
    expect(priorityOf('my payout is late')).toBe('high');
    expect(priorityOf('where is my refund')).toBe('high');
    expect(priorityOf('why is my listing not live')).toBe('high');
    expect(priorityOf('KYC verification stuck')).toBe('high');
  });
  it('leaves everything else Normal', () => {
    expect(priorityOf('how do I change my photo?')).toBe('normal');
    expect(priorityOf('')).toBe('normal');
    expect(priorityOf(null)).toBe('normal');
  });
});

describe('waitMinutes + slaLevel', () => {
  it('is null when it is not our turn', () => {
    expect(waitMinutes({ waitingOnUs: false, waitingSince: agoMin(999) }, NOW)).toBeNull();
    expect(waitMinutes({ waitingOnUs: true, waitingSince: null }, NOW)).toBeNull();
    expect(slaLevel(null)).toBeNull();
  });
  it('escalates ok → warn → breach at the thresholds', () => {
    expect(slaLevel(waitMinutes({ waitingOnUs: true, waitingSince: agoMin(10) }, NOW))).toBe('ok');
    expect(slaLevel(waitMinutes({ waitingOnUs: true, waitingSince: agoMin(SLA_WARN_MIN) }, NOW))).toBe('warn');
    expect(slaLevel(waitMinutes({ waitingOnUs: true, waitingSince: agoMin(SLA_BREACH_MIN + 1) }, NOW))).toBe('breach');
  });
});

describe('fmtWait', () => {
  it('formats minutes and hours', () => {
    expect(fmtWait(45)).toBe('45m');
    expect(fmtWait(130)).toBe('2h 10m');
  });
});

describe('inboxSort', () => {
  it('floats waiting-on-us above idle, longest wait first, High breaking ties', () => {
    const idle = { waitingOnUs: false, at: agoMin(1) };
    const wait30 = { waitingOnUs: true, waitingSince: agoMin(30), at: agoMin(30), priority: 'normal' };
    const wait300 = { waitingOnUs: true, waitingSince: agoMin(300), at: agoMin(300), priority: 'normal' };
    const wait30High = { waitingOnUs: true, waitingSince: agoMin(30), at: agoMin(30), priority: 'high' };

    const out = [idle, wait30, wait300, wait30High].sort((a, b) => inboxSort(a, b, NOW));
    expect(out[0]).toBe(wait300);           // longest wait
    expect(out[1]).toBe(wait30High);        // same age as wait30 but High wins
    expect(out[2]).toBe(wait30);
    expect(out[3]).toBe(idle);              // not-our-turn sinks
  });
});
