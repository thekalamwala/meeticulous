import { describe, it, expect } from 'vitest';
import { noShowCost } from '../noShowCalc';

describe('noShowCost', () => {
  it('computes monthly no-shows, monthly and annual loss', () => {
    const r = noShowCost({ bookingsPerMonth: 100, avgValue: 1000, noShowRatePct: 20 });
    expect(r.monthlyNoShows).toBe(20);
    expect(r.monthlyLost).toBe(20000);
    expect(r.annualLost).toBe(240000);
  });

  it('recoverable is the slice above the ~5% target rate', () => {
    // 20% now, 5% target → recover the 15-point gap.
    const r = noShowCost({ bookingsPerMonth: 100, avgValue: 1000, noShowRatePct: 20, targetRatePct: 5 });
    expect(r.residualAnnual).toBe(60000); // 5% residual
    expect(r.recoverableAnnual).toBe(180000); // 240k - 60k
  });

  it('never recovers below the current rate (target clamped to current)', () => {
    const r = noShowCost({ bookingsPerMonth: 50, avgValue: 800, noShowRatePct: 3, targetRatePct: 5 });
    expect(r.recoverableAnnual).toBe(0);
  });

  it('clamps rate to 0–100 and treats junk/negatives as 0', () => {
    expect(noShowCost({ bookingsPerMonth: 10, avgValue: 100, noShowRatePct: 150 }).monthlyNoShows).toBe(10);
    const z = noShowCost({ bookingsPerMonth: -5, avgValue: 'x', noShowRatePct: 20 });
    expect(z.annualLost).toBe(0);
  });
});
