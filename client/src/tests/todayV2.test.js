import { describe, it, expect } from 'vitest';
import { revenueSeries, buildQueue } from '../pages/TodayV2';

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
