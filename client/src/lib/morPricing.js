/**
 * Client-side earnings math — a faithful mirror of the published /host-fees §4–5
 * payout model (the source of truth for what a host keeps). Kept as a tiny
 * duplicate rather than a shared package because the formula is a few lines and
 * the two runtimes (CJS server, ESM client) don't share a module boundary.
 *
 * SOURCE OF TRUTH IS /host-fees. Guest pays = price + ₹10 fee + 18% GST on the fee;
 * host receives = price − commission − gateway(~2% of the whole charge) − TDS(1%)
 * − TCS(1%). The drift test (__tests__/morPricing.test.js) asserts the exact
 * /host-fees §5 numbers (₹1,000 → guest ₹1,011.80; Host+ ₹959.76; Starter ₹909.76).
 *
 * Used by the earnings calculator (pages/EarningsCalculator.jsx). Rates are
 * FRACTIONS (gstRate 0.18, commissionRate 0.05, pgRate 0.02 illustrative — the
 * real gateway fee is method-dependent and only known at capture).
 *
 * NOTE: display/illustration only. Real pricing at booking time comes from the
 * server. Assumes the standard 18% GST rate; exempt/RCM categories differ.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const DEFAULT_GST_RATE = 0.18;

/**
 * @param {object}  p
 * @param {number}  p.targetEarning     what the host wants to earn (≥ 0)
 * @param {number}  [p.bookingCharge]   flat ₹ added to taxable value (default 10)
 * @param {number}  [p.commissionRate]  fraction, e.g. 0.05 / 0
 * @param {number}  [p.pgRate]          fraction, e.g. 0.025
 * @param {boolean} [p.absorbsPg]       true → platform bears processing (Starter)
 * @param {number}  [p.gstRate]         fraction, e.g. 0.18; 0 for an exempt category
 */
export function computeMorBreakdown({
  targetEarning,
  bookingCharge = 10,
  commissionRate = 0,
  pgRate = 0,
  absorbsPg = false,
  gstRate = DEFAULT_GST_RATE,
}) {
  const E = Math.max(0, Number(targetEarning) || 0);
  if (E === 0) {
    // A ₹0 service attracts no fee, GST, PG, TDS or TCS (/host-fees §1).
    return {
      targetEarning: 0, bookingCharge: 0, commission: 0, pgCharge: 0, tds: 0, tcs: 0,
      hostConsideration: 0, taxableValue: 0, gstAmount: 0, guestTotal: 0, platformMargin: 0,
    };
  }
  // Matches the published /host-fees §4–5 exactly:
  //   Guest pays  = your price + ₹10 fee + 18% GST on the ₹10 fee (NOT on your price).
  //   You receive = price − commission − gateway(on the whole charge) − TDS(1%) − TCS(1%).
  const taxableValue = round2(bookingCharge);                 // GST base = the booking fee only
  const gstAmount    = round2(taxableValue * gstRate);        // 18% of ₹10 = ₹1.80
  const guestTotal   = round2(E + bookingCharge + gstAmount); // price + fee + GST-on-fee
  const commission   = round2(E * commissionRate);
  const pgCharge     = absorbsPg ? 0 : round2(guestTotal * pgRate); // gateway, borne by the host
  const tds          = round2(E * 0.01);                      // 194-O, on your price (5% if no PAN — not modelled)
  const tcs          = round2(E * 0.01);                      // §52, on your price
  const hostConsideration = round2(E - commission - pgCharge - tds - tcs);
  const platformMargin    = round2(bookingCharge + commission); // fee + commission (PG is the host's cost; TDS/TCS pass through to govt)
  return { targetEarning: round2(E), bookingCharge: round2(bookingCharge), commission, pgCharge, tds, tcs, hostConsideration, taxableValue, gstAmount, guestTotal, platformMargin };
}

/**
 * Per-booking charge config for the two plans, plus their subscription cost.
 * Mirrors subscription_plans (migration v3.165) and the published /host-fees §1
 * table. Neither plan caps service price or booking volume any more, so
 * maxServicePrice is null on both.
 */
export const CALC_PLANS = [
  {
    key: 'free', name: 'Sloth',
    charge: { bookingCharge: 10, commissionRate: 0.05, pgRate: 0.02, absorbsPg: false },
    monthly: 0, maxServicePrice: null,
    note: 'Free forever · 5% per booking',
  },
  {
    key: 'premium', name: 'Sloth Active',
    charge: { bookingCharge: 10, commissionRate: 0, pgRate: 0.02, absorbsPg: false },
    // GST-INCLUSIVE, matching data/plans.js — this is subtracted from monthly
    // income, so it must be the amount actually charged, not the ex-GST base.
    monthly: 399, maxServicePrice: null,
    note: '0% commission · ₹399/mo',
  },
];

/**
 * Monthly income for one plan at a given per-booking earning and volume, net of
 * the subscription. Returns the per-booking and monthly figures the calculator
 * renders. `capped` flags a Starter earning above its ₹5,000 service-price cap.
 */
export function monthlyForPlan(plan, targetEarning, bookingsPerMonth, gstRate = DEFAULT_GST_RATE) {
  const b = computeMorBreakdown({ targetEarning, ...plan.charge, gstRate });
  const bookings = Math.max(0, Math.floor(Number(bookingsPerMonth) || 0));
  const grossMonthly = round2(b.hostConsideration * bookings);
  const netMonthly = round2(grossMonthly - plan.monthly);
  const capped = plan.maxServicePrice != null && Number(targetEarning) > plan.maxServicePrice;  // no plan caps price today
  return {
    plan,
    perBookingTakeHome: b.hostConsideration,
    guestPays: b.guestTotal,
    subscription: plan.monthly,
    grossMonthly,
    netMonthly,
    capped,
  };
}
