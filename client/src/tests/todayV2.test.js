import { describe, it, expect } from 'vitest';
import { revenueSeries, buildQueue, whenWord, phaseOf, weekLoad } from '../pages/TodayV2';

const iso = (y, m, d = 15) => new Date(y, m, d).toISOString();

describe('TodayV2 revenueSeries', () => {
  it('returns 6 months oldest->newest and sums only paid bookings in-month', () => {
    const now = new Date(2026, 10, 18); // Nov 2026
    const bookings = [
      { payment_status: 'paid', customer_total: 1000, scheduled_at: iso(2026, 10) }, // Nov
      { payment_status: 'paid', amount: 500, scheduled_at: iso(2026, 10, 2) },       // Nov (amount fallback)
      { payment_status: 'unpaid', customer_total: 999, scheduled_at: iso(2026, 10) }, // excluded
      { payment_status: 'paid', customer_total: 800, scheduled_at: iso(2026, 9) },    // Oct
    ];
    const s = revenueSeries(bookings, now);
    expect(s).toHaveLength(6);
    expect(s.at(-1).revenue).toBe(1500); // Nov paid only
    expect(s.at(-2).revenue).toBe(800);  // Oct
  });
});

describe('TodayV2 buildQueue', () => {
  const now = Date.now();
  it('surfaces KYC, pending confirmations and unpaid, hardest first', () => {
    const bookings = [
      { status: 'pending', scheduled_at: new Date(now + 86400000).toISOString(), guest_name: 'A' },
      { status: 'completed', payment_status: 'unpaid', customer_total: 1200, scheduled_at: iso(2026, 9) },
    ];
    const q = buildQueue(bookings, { status: 'pending' }, now);
    expect(q.map((x) => x.id)).toEqual(['kyc', 'confirm', 'unpaid']);
  });

  it('stays empty when verified and nothing pending/unpaid', () => {
    expect(buildQueue([], { status: 'approved' }, now)).toEqual([]);
  });

  it('omits KYC when approved', () => {
    const q = buildQueue([{ status: 'pending', scheduled_at: new Date(now + 1000).toISOString() }], { status: 'approved' }, now);
    expect(q.map((x) => x.id)).toEqual(['confirm']);
  });
});

describe('TodayV2 whenWord', () => {
  // Wed 25 Nov 2026, 10:00 local
  const now = new Date(2026, 10, 25, 10, 0);
  const at = (d, h = 9) => new Date(2026, 10, d, h, 0).toISOString();
  it('says when like a person would', () => {
    expect(whenWord(at(25, 16), now)).toBe('later today');
    expect(whenWord(at(26), now)).toBe('tomorrow');
    expect(whenWord(at(30), now)).toBe('Monday');
    expect(whenWord(at(30 + 9), now)).toMatch(/^on /);
  });
});

describe('TodayV2 phaseOf', () => {
  const now = new Date(2026, 10, 25, 14, 0);
  const at = (h, m = 0, duration = 60) => ({ scheduled_at: new Date(2026, 10, 25, h, m).toISOString(), services: { duration } });
  it('splits today into done, on now and upcoming', () => {
    expect(phaseOf(at(11), now)).toBe('done');       // 11:00-12:00
    expect(phaseOf(at(13, 30), now)).toBe('now');    // 13:30-14:30
    expect(phaseOf(at(16), now)).toBe('upcoming');
  });
  it('assumes 30 minutes when a service has no duration', () => {
    expect(phaseOf({ scheduled_at: new Date(2026, 10, 25, 13, 40).toISOString() }, now)).toBe('now');
    expect(phaseOf({ scheduled_at: new Date(2026, 10, 25, 13, 20).toISOString() }, now)).toBe('done');
  });
});

describe('TodayV2 weekLoad', () => {
  const monday = new Date(2026, 10, 23); // Mon 23 Nov 2026
  const now = new Date(2026, 10, 25, 12, 0); // Wed noon
  const bk = (d, h, duration, amount, status = 'confirmed') => ({ scheduled_at: new Date(2026, 10, d, h).toISOString(), services: { duration }, customer_total: amount, status });
  it('totals the week and flags the quiet days still ahead', () => {
    const w = weekLoad([bk(23, 10, 60, 1000), bk(26, 11, 30, 500), bk(26, 15, 90, 0), bk(27, 9, 60, 999, 'cancelled'), bk(30, 10, 60, 2000)], monday, now);
    expect(w.count).toBe(3);                 // the 30 Nov booking is next week; cancelled ignored
    expect(w.hours).toBe(3);                 // 60 + 30 + 90 minutes
    expect(w.expected).toBe(1500);
    expect(w.days[3].count).toBe(2);         // Thursday
    expect(w.quiet.map((d) => d.date.getDate())).toEqual([25, 27, 28, 29]); // Wed (today) .. Sun, not Mon/Tue (past)
  });
});
