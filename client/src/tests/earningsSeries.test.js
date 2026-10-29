import { describe, it, expect } from 'vitest';
import { buildSeries } from '../utils/earningsSeries';

// Construct a local-noon ISO so new Date(iso).getMonth() === m regardless of TZ.
const at = (y, m, d = 15) => new Date(y, m, d, 12, 0, 0).toISOString();
const booking = (y, m, { price = 1000, vendor = null } = {}) => ({
  scheduled_at: at(y, m),
  vendor_amount: vendor,
  services: { price, title: 'S' },
});

const NOW = new Date(2026, 0, 15); // Jan 15 2026

describe('buildSeries — month window', () => {
  it('returns rangeMonths buckets ending at the current month', () => {
    const r = buildSeries([], 6, NOW);
    expect(r.months).toHaveLength(6);
    expect(r.months.map((m) => m.label)).toEqual(['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']);
    expect(r.months[5].label).toBe('Jan');
    expect(r.months[5].labelLong).toBe("Jan '26");
    expect(r.months[5].key).toBe('2026-01');
  });

  it('supports range 3 and 12', () => {
    expect(buildSeries([], 3, NOW).months).toHaveLength(3);
    expect(buildSeries([], 12, NOW).months).toHaveLength(12);
  });
});

describe('buildSeries — bucketing', () => {
  it('buckets net into the correct month', () => {
    const r = buildSeries([booking(2026, 0, { price: 1000 })], 6, NOW);
    expect(r.series.net.cur).toEqual([0, 0, 0, 0, 0, 1000]); // only Jan
  });

  it('uses vendor_amount for net when present', () => {
    const r = buildSeries([booking(2026, 0, { price: 1000, vendor: 800 })], 6, NOW);
    expect(r.series.net.cur[5]).toBe(800);
  });

  it('falls back to services.price for net when vendor_amount is null', () => {
    const r = buildSeries([booking(2026, 0, { price: 1000, vendor: null })], 6, NOW);
    expect(r.series.net.cur[5]).toBe(1000);
  });

  it('gross always uses services.price, ignoring vendor_amount', () => {
    const r = buildSeries([booking(2026, 0, { price: 1000, vendor: 800 })], 6, NOW);
    expect(r.series.gross.cur[5]).toBe(1000);
  });

  it('counts bookings per month', () => {
    const r = buildSeries(
      [booking(2026, 0), booking(2026, 0), booking(2025, 11)],
      6,
      NOW,
    );
    expect(r.series.bookings.cur).toEqual([0, 0, 0, 0, 1, 2]); // Dec=1, Jan=2
  });

  it('per-month avg is net/count, 0 for empty months', () => {
    const r = buildSeries(
      [booking(2026, 0, { price: 1000 }), booking(2026, 0, { price: 3000 })],
      6,
      NOW,
    );
    expect(r.series.avg.cur[5]).toBe(2000); // (1000+3000)/2
    expect(r.series.avg.cur[0]).toBe(0);
  });
});

describe('buildSeries — windows and totals', () => {
  it('previous window captures bookings before the current window', () => {
    // range 3 → cur = Nov,Dec,Jan ; prev = Aug,Sep,Oct
    const r = buildSeries([booking(2025, 8, { price: 500 })], 3, NOW); // Sep 2025
    expect(r.series.net.prev[1]).toBe(500); // Sep is index 1 of prev
    expect(r.totals.net.prev).toBe(500);
    expect(r.totals.net.cur).toBe(0);
  });

  it('totals sum the current window', () => {
    const r = buildSeries(
      [booking(2026, 0, { price: 1000 }), booking(2025, 11, { price: 2000 })],
      6,
      NOW,
    );
    expect(r.totals.net.cur).toBe(3000);
    expect(r.totals.bookings.cur).toBe(2);
  });

  it('computes delta vs previous window', () => {
    const r = buildSeries(
      [
        booking(2026, 0, { price: 2000 }), // cur
        booking(2025, 6, { price: 1000 }), // prev (Jul 2025, range 6 → prev = Feb..Jul 2025)
      ],
      6,
      NOW,
    );
    expect(r.totals.net.delta).toBeCloseTo(1); // (2000-1000)/1000
  });

  it('delta is null when previous total is zero', () => {
    const r = buildSeries([booking(2026, 0, { price: 1000 })], 6, NOW);
    expect(r.totals.net.delta).toBeNull();
  });

  it('overall avg total is totalNet / totalBookings', () => {
    const r = buildSeries(
      [booking(2026, 0, { price: 1000 }), booking(2025, 11, { price: 3000 })],
      6,
      NOW,
    );
    expect(r.totals.avg.cur).toBe(2000); // 4000 / 2
  });
});

describe('buildSeries — edges', () => {
  it('hasData is false when no paid bookings in the current window', () => {
    const r = buildSeries([booking(2025, 8, { price: 500 })], 3, NOW); // only prev
    expect(r.hasData).toBe(false);
    expect(r.totals.net.prev).toBe(500);
  });

  it('hasData is true when there is a booking in the current window', () => {
    const r = buildSeries([booking(2026, 0)], 6, NOW);
    expect(r.hasData).toBe(true);
  });

  it('ignores bookings outside both windows', () => {
    const r = buildSeries([booking(2020, 0, { price: 9999 })], 6, NOW);
    expect(r.totals.net.cur).toBe(0);
    expect(r.totals.net.prev).toBe(0);
  });
});
