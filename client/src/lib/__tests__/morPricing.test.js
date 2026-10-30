/**
 * Drift guard: the calculator must reproduce the published /host-fees §5 numbers
 * to the paisa. Guest = price + ₹10 + GST(₹10); host = price − commission −
 * gateway(~2% of the whole charge) − TDS(1%) − TCS(1%). If it drifts from the
 * page, these assertions fail.
 */
import { describe, it, expect } from 'vitest';
import { computeMorBreakdown, monthlyForPlan, CALC_PLANS } from '../morPricing';

const HOSTPLUS = { bookingCharge: 10, commissionRate: 0, pgRate: 0.02, absorbsPg: false };
const STARTER  = { bookingCharge: 10, commissionRate: 0.05, pgRate: 0.02, absorbsPg: false };

describe('computeMorBreakdown matches /host-fees §5 (E = ₹1,000, 18%)', () => {
  it('Host+ / Studio: guest ₹1,011.80, host keeps ₹959.76', () => {
    const b = computeMorBreakdown({ targetEarning: 1000, ...HOSTPLUS });
    expect(b.guestTotal).toBe(1011.8);
    expect(b.gstAmount).toBe(1.8);       // GST on the ₹10 fee only
    expect(b.pgCharge).toBe(20.24);      // ~2% of the whole charge
    expect(b.tds).toBe(10);
    expect(b.tcs).toBe(10);
    expect(b.hostConsideration).toBe(959.76);
  });

  it('Starter: same guest price, host keeps ₹909.76 (bears commission + PG)', () => {
    const b = computeMorBreakdown({ targetEarning: 1000, ...STARTER });
    expect(b.guestTotal).toBe(1011.8);
    expect(b.commission).toBe(50);
    expect(b.pgCharge).toBe(20.24);
    expect(b.hostConsideration).toBe(909.76);
  });

  it('free service (E=0) → all zeros', () => {
    const b = computeMorBreakdown({ targetEarning: 0, ...HOSTPLUS });
    expect(b.guestTotal).toBe(0);
    expect(b.tds).toBe(0);
    expect(b.hostConsideration).toBe(0);
  });
});

describe('monthlyForPlan', () => {
  it('nets the subscription off gross monthly income', () => {
    const free = monthlyForPlan(CALC_PLANS[0], 1000, 10);
    const premium = monthlyForPlan(CALC_PLANS[1], 1000, 10);
    expect(free.netMonthly).toBe(9097.6);       // 909.76 × 10 − 0
    expect(premium.netMonthly).toBe(9362.6);    // 959.76 × 10 − 235 (GST-incl fee)
  });

  it('Pro overtakes free once volume is high enough', () => {
    // Premium saves the 5% commission (₹50 on ₹1,000) per booking, so its
    // ₹235/mo pays for itself just under 5 bookings: free wins at 4, premium
    // from 5 up. The turn has to be checked on BOTH sides — asserting only that
    // premium eventually wins would pass for any fee.
    const at4 = { f: monthlyForPlan(CALC_PLANS[0], 1000, 4).netMonthly, p: monthlyForPlan(CALC_PLANS[1], 1000, 4).netMonthly };
    const at5 = { f: monthlyForPlan(CALC_PLANS[0], 1000, 5).netMonthly, p: monthlyForPlan(CALC_PLANS[1], 1000, 5).netMonthly };
    expect(at4.f).toBeGreaterThan(at4.p);
    expect(at5.p).toBeGreaterThan(at5.f);
  });

  it('neither plan caps service price any more', () => {
    expect(monthlyForPlan(CALC_PLANS[0], 6000, 5).capped).toBe(false);
    expect(monthlyForPlan(CALC_PLANS[1], 6000, 5).capped).toBe(false);
  });
});
