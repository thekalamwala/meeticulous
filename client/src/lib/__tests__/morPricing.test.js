/**
 * Drift guard: the calculator must reproduce the published /host-fees §5 numbers
 * to the paisa (pricing v2). Guest = price + ₹10 fee, GST included; host = price −
 * commission − gateway(~2% of the whole charge) − TDS − TCS. Withholding per
 * tds_tcs_v2 for a host with a PAN who is not GST-registered: TDS 0.1%, TCS nil.
 * Withholding amounts here are illustration only — statutory rates are asserted
 * on the server (pricingEngineWithholding.test.js). If it drifts, these fail.
 */
import { describe, it, expect } from 'vitest';
import { computeMorBreakdown, monthlyForPlan, CALC_PLANS } from '../morPricing';

const HOSTPLUS = { bookingCharge: 10, commissionRate: 0, pgRate: 0.02, absorbsPg: false };
const STARTER  = { bookingCharge: 10, commissionRate: 0.09, pgRate: 0.02, absorbsPg: false };

describe('computeMorBreakdown matches /host-fees §5 (E = ₹1,000, 18%)', () => {
  it('Pro: guest ₹1,010.00, host keeps ₹978.80', () => {
    const b = computeMorBreakdown({ targetEarning: 1000, ...HOSTPLUS });
    expect(b.guestTotal).toBe(1010);
    expect(b.taxableValue).toBe(8.47);   // the ₹10 fee, GST backed out
    expect(b.gstAmount).toBe(1.53);
    expect(b.pgCharge).toBe(20.2);       // ~2% of the whole charge
    expect(b.tds).toBe(1);
    expect(b.tcs).toBe(0);               // not GST-registered → no TCS
    expect(b.hostConsideration).toBe(978.8);
  });

  it('Starter: same guest price, host keeps ₹888.80 (bears commission + PG)', () => {
    const b = computeMorBreakdown({ targetEarning: 1000, ...STARTER });
    expect(b.guestTotal).toBe(1010);
    expect(b.commission).toBe(90);
    expect(b.pgCharge).toBe(20.2);
    expect(b.hostConsideration).toBe(888.8);
  });

  it('GST-registered host also has TCS; a host with no PAN has the higher TDS', () => {
    expect(computeMorBreakdown({ targetEarning: 1000, ...HOSTPLUS, gstRegistered: true }).tcs).toBe(5);
    expect(computeMorBreakdown({ targetEarning: 1000, ...HOSTPLUS, hasPan: false }).tds).toBe(50);
  });

  it('no booking fee under ₹300', () => {
    const b = computeMorBreakdown({ targetEarning: 250, ...HOSTPLUS });
    expect(b.guestTotal).toBe(250);
    expect(b.bookingCharge).toBe(0);
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
    expect(free.netMonthly).toBe(8888);         // 888.80 × 10 − 0
    expect(premium.netMonthly).toBe(9589);      // 978.80 × 10 − 199 (GST-incl price)
  });

  it('Pro overtakes free once volume is high enough', () => {
    // Pro saves the 9% commission (₹90 on ₹1,000) per booking, so its ₹199/mo
    // pays for itself between 2 and 3 bookings: free wins at 2, Pro from 3 up.
    // The turn has to be checked on BOTH sides — asserting only that Pro
    // eventually wins would pass for any fee.
    const at2 = { f: monthlyForPlan(CALC_PLANS[0], 1000, 2).netMonthly, p: monthlyForPlan(CALC_PLANS[1], 1000, 2).netMonthly };
    const at3 = { f: monthlyForPlan(CALC_PLANS[0], 1000, 3).netMonthly, p: monthlyForPlan(CALC_PLANS[1], 1000, 3).netMonthly };
    expect(at2.f).toBeGreaterThan(at2.p);
    expect(at3.p).toBeGreaterThan(at3.f);
  });

  it('neither plan caps service price any more', () => {
    expect(monthlyForPlan(CALC_PLANS[0], 6000, 5).capped).toBe(false);
    expect(monthlyForPlan(CALC_PLANS[1], 6000, 5).capped).toBe(false);
  });
});
