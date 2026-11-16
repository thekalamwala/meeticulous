// The prototype's one runnable check.
//
// Creator Intelligence's stated anti-goal is "a number a host cannot reconcile"
// (design doc §4). A demo that shows a reviewer a total which doesn't add up
// fails at exactly that, and it is the easiest mistake to make in hand-written
// fixtures. So the fixture's arithmetic is asserted rather than trusted.
import { describe, expect, it } from 'vitest';
import intel from '../intelData';

describe('intelData fixtures', () => {
  it('gross is service revenue plus product revenue', () => {
    expect(intel.money.gross).toBe(intel.money.serviceRevenue + intel.money.productRevenue);
  });

  it('the waterfall subtracts to the stated net', () => {
    const rows = intel.money.waterfall;
    const gross = rows.find((r) => r.kind === 'gross').value;
    const deductions = rows.filter((r) => r.kind === 'deduction').reduce((s, r) => s + r.value, 0);
    const total = rows.find((r) => r.kind === 'total').value;

    expect(gross).toBe(intel.money.gross);
    expect(gross - deductions).toBe(total);
    expect(total).toBe(intel.money.net);
  });

  it('average booking value is service revenue over paid bookings', () => {
    expect(intel.money.aov).toBe(Math.round(intel.money.serviceRevenue / intel.money.paidBookings));
  });

  it('revenue by service sums to gross', () => {
    const sum = intel.money.byService.reduce((s, r) => s + r.revenue, 0);
    expect(sum).toBe(intel.money.gross);
  });

  it('the composition segments sum to gross', () => {
    const sum = intel.money.composition.reduce((s, r) => s + r.value, 0);
    expect(sum).toBe(intel.money.gross);
  });

  it('the funnel only ever narrows, and ends at the real paid count', () => {
    const values = intel.audience.funnel.map((s) => s.value);
    values.forEach((v, i) => { if (i) expect(v).toBeLessThanOrEqual(values[i - 1]); });
    expect(values[values.length - 1]).toBe(intel.money.paidBookings);
  });

  it('the named bottleneck really is the biggest step drop', () => {
    const f = intel.audience.funnel;
    const drops = f.slice(1).map((s, i) => ({ step: `${f[i].label} → ${s.label}`, drop: 1 - s.value / f[i].value }));
    const worst = drops.reduce((a, b) => (b.drop > a.drop ? b : a));
    expect(intel.audience.bottleneck.step).toBe(worst.step);
    expect(intel.audience.bottleneck.drop).toBeCloseTo(worst.drop, 2);
  });

  it('source bookings do not exceed the funnel they came from', () => {
    const sum = intel.audience.sources.reduce((s, r) => s + r.bookings, 0);
    expect(sum).toBe(intel.money.paidBookings);
  });

  it('commission figures are consistent with a 5% free plan', () => {
    expect(intel.leak.monthlyIfFree).toBe(intel.money.commissionIfFree);
    expect(intel.leak.runRateYear).toBe(intel.leak.monthlyIfFree * 12);
    expect(intel.leak.paybackDays).toBeGreaterThan(0);
  });

  it('booked hours never exceed published hours', () => {
    expect(intel.demand.bookedHours).toBeLessThanOrEqual(intel.demand.publishedHours);
    expect(intel.demand.utilisation).toBeLessThanOrEqual(1);
  });

  it('every cohort starts at 100% and never rises afterwards', () => {
    intel.customers.cohorts.forEach((c) => {
      expect(c.values[0]).toBe(1);
      const known = c.values.filter((v) => v != null);
      known.forEach((v, i) => { if (i) expect(v).toBeLessThanOrEqual(known[i - 1]); });
    });
  });

  it('a benchmark cohort below five hosts is suppressed', () => {
    expect(intel.benchmark.hostCount).toBeGreaterThanOrEqual(5);
    expect(intel.benchmark.suppressed).toBe(false);
    expect(intel.benchmarkSuppressed.hostCount).toBeLessThan(5);
    expect(intel.benchmarkSuppressed.suppressed).toBe(true);
  });

  it('every insight carries its evidence, impact and measure', () => {
    expect(intel.insights.length).toBeGreaterThan(0);
    intel.insights.forEach((i) => {
      expect(i.evidence.length).toBeGreaterThan(0);
      expect(i.what && i.why && i.impact && i.measure && i.action).toBeTruthy();
    });
  });
});
