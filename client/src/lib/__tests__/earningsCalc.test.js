import { describe, it, expect } from 'vitest';
import {
  resultsFor, pickWinner, annualSaving, deltaVsFree, premiumCrossover,
  freeCommissionPerYear, annualBookings, ANNUAL_FEE, platformFeesPerYear,
} from '../earningsCalc';
import { PREMIUM_PLAN } from '../../data/plans';

const byKey = (results, key) => results.find((r) => r.plan.key === key);

describe('earningsCalc', () => {
  it('annual fees come from the single pricing source, GST-inclusive', () => {
    expect(ANNUAL_FEE.free).toBe(0);
    expect(ANNUAL_FEE.premium).toBe(PREMIUM_PLAN.yearly); // 1199
  });

  it('annual bookings = sessions/month × 12', () => {
    expect(annualBookings(10)).toBe(120);
    expect(annualBookings(0)).toBe(0);
    expect(annualBookings(-5)).toBe(0);
  });

  it('annual net = per-booking take-home × volume − annual fee', () => {
    const r = byKey(resultsFor(1000, 10, 'annual'), 'premium');
    // ₹1,000 booking on 0% commission → ₹978.80 take-home (published /host-fees §5,
    // pricing v2: GST-inclusive fee, TDS 0.1%, no TCS for a host without a GSTIN)
    expect(r.perBookingTakeHome).toBe(978.8);
    expect(r.grossAnnual).toBe(Math.round(978.8 * 120 * 100) / 100);
    expect(r.netAnnual).toBe(Math.round((978.8 * 120 - PREMIUM_PLAN.yearly) * 100) / 100);
  });

  it('the monthly cycle charges monthly × 12 instead of the annual fee', () => {
    const r = byKey(resultsFor(1000, 10, 'monthly'), 'premium');
    expect(r.fee).toBe(PREMIUM_PLAN.monthly * 12); // 2388
  });

  it('free keeps less per booking because of the 9% commission', () => {
    const free = byKey(resultsFor(1000, 10, 'annual'), 'free');
    expect(free.perBookingTakeHome).toBe(888.8); // ₹90 commission vs premium
    expect(free.fee).toBe(0);
  });

  // Both plans are uncapped since v3.165 — there is no "you can't accept booking
  // #1,001" ceiling left to model, so nothing is ever uncollected.
  it('neither plan caps bookings or service price', () => {
    for (const r of resultsFor(50000, 500, 'annual')) {
      expect(r.capped).toBe(false);
      expect(r.outgrows).toBe(false);
      expect(r.uncollectedBookings).toBe(0);
      expect(r.uncollectedValue).toBe(0);
    }
  });
});

describe('the upgrade verdict', () => {
  it('free wins at low volume — the honest answer is "stay free"', () => {
    const results = resultsFor(1000, 1, 'annual'); // 12 bookings/yr, ₹1,080 commission < ₹1,199
    expect(pickWinner(results)).toBe('free');
    expect(deltaVsFree(results, 'free')).toBe(0);
  });

  it('premium wins once saved commission clears the fee', () => {
    const results = resultsFor(1500, 12, 'annual');
    expect(pickWinner(results)).toBe('premium');
    expect(deltaVsFree(results, 'premium')).toBeGreaterThan(0);
  });

  it('crossover = the month count where 9% saved beats the annual fee', () => {
    // ₹1,199 / (9% × ₹1,500 × 12) = 0.74 → 1 session a month
    expect(premiumCrossover(1500)).toBe(1);
    // Cheaper sessions need more volume: ₹1,199 / (9% × ₹300 × 12) = 3.70 → 4
    expect(premiumCrossover(300)).toBe(4);
  });

  it('a ₹0 price never justifies paying', () => {
    expect(premiumCrossover(0)).toBe(Infinity);
    expect(premiumCrossover(-100)).toBe(Infinity);
  });

  it('the crossover agrees with the actual winner either side of it', () => {
    const n = premiumCrossover(1500);
    expect(pickWinner(resultsFor(1500, n - 1, 'annual'))).toBe('free');
    expect(pickWinner(resultsFor(1500, n + 1, 'annual'))).toBe('premium');
  });

  it('annual saving = monthly × 12 − annual fee', () => {
    expect(annualSaving('premium')).toBe(PREMIUM_PLAN.monthly * 12 - PREMIUM_PLAN.yearly); // 1189
    expect(annualSaving('free')).toBe(0);
  });

  it('commission given up per year = 9% × price × annual bookings', () => {
    expect(freeCommissionPerYear(1000, 10)).toBe(10800); // 9% × ₹1,000 × 120
    expect(freeCommissionPerYear(0, 10)).toBe(0);
  });
});

describe('platformFeesPerYear', () => {
  it('prices Topmate at 10%/20% plus GST on the fee, Starter at 9%, Pro flat', () => {
    // ₹5,000 × 12 sessions/month × 12 months = ₹7,20,000 in sales
    const rows = Object.fromEntries(platformFeesPerYear(5000, 12).map((r) => [r.key, r.fee]));
    expect(rows['topmate-own']).toBe(84960);
    expect(rows['topmate-marketplace']).toBe(169920);
    expect(rows.free).toBe(64800);
    expect(rows.premium).toBe(ANNUAL_FEE.premium);
  });
});
