/**
 * Client-side earnings math — a faithful mirror of the published /host-fees §4–5
 * payout model (the source of truth for what a host keeps). Kept as a tiny
 * duplicate rather than a shared package because the formula is a few lines and
 * the two runtimes (CJS server, ESM client) don't share a module boundary.
 *
 * SOURCE OF TRUTH IS /host-fees + server/lib/pricingEngine.js (pricing v2).
 * Guest pays = price + ₹10 booking fee, GST INCLUDED (none under ₹300);
 * host receives = price − commission − gateway(~2% of the whole charge) − TDS − TCS,
 * with withholding per tds_tcs_v2: TDS 0.1% (194-O; 5% with no PAN), TCS 0.5% (§52)
 * only from a GST-registered host. The drift test (__tests__/morPricing.test.js)
 * asserts the /host-fees §5 numbers (₹1,000 → guest ₹1,010.00; Pro ₹978.80;
 * Starter ₹888.80 — host with a PAN, not GST-registered).
 *
 * Used by the earnings calculator (pages/EarningsCalculator.jsx). Rates are
 * FRACTIONS (gstRate 0.18, commissionRate 0.09, pgRate 0.02 illustrative — the
 * real gateway fee is method-dependent and only known at capture).
 *
 * NOTE: display/illustration only. Real pricing at booking time comes from the
 * server. Assumes the standard 18% GST rate; exempt/RCM categories differ.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const DEFAULT_GST_RATE = 0.18;
export const FEE_FLOOR = 300;          // pricing v2: no booking fee on a price under ₹300
// tds_tcs_v2 withholding (live platform_settings, 2026-11-27). Mirrored for display
// only — the server snapshots the real amounts per booking.
export const TDS_RATE = 0.001;         // 194-O with a PAN
export const TDS_RATE_NO_PAN = 0.05;   // §206AA, no PAN on file
export const TCS_RATE = 0.005;         // §52, GST-registered hosts only

/**
 * @param {object}  p
 * @param {number}  p.targetEarning     what the host wants to earn (≥ 0)
 * @param {number}  [p.bookingCharge]   flat GST-inclusive ₹ fee the guest pays (default 10)
 * @param {number}  [p.feeFloor]        no fee on a price under this (default ₹300)
 * @param {number}  [p.commissionRate]  fraction, e.g. 0.09 / 0
 * @param {number}  [p.pgRate]          fraction, e.g. 0.025
 * @param {boolean} [p.absorbsPg]       true → platform bears processing (Starter)
 * @param {number}  [p.gstRate]         fraction, e.g. 0.18; 0 for an exempt category
 * @param {boolean} [p.hasPan]          host has a PAN on file (default true → TDS 0.1%, else 5%)
 * @param {boolean} [p.gstRegistered]   host has a GSTIN (default false → no TCS)
 */
export function computeMorBreakdown({
  targetEarning,
  bookingCharge = 10,
  commissionRate = 0,
  pgRate = 0,
  absorbsPg = false,
  gstRate = DEFAULT_GST_RATE,
  feeFloor = FEE_FLOOR,
  hasPan = true,
  gstRegistered = false,
}) {
  const E = Math.max(0, Number(targetEarning) || 0);
  if (E === 0) {
    // A ₹0 service attracts no fee, GST, PG, TDS or TCS (/host-fees §1).
    return {
      targetEarning: 0, bookingCharge: 0, commission: 0, pgCharge: 0, tds: 0, tcs: 0,
      hostConsideration: 0, taxableValue: 0, gstAmount: 0, guestTotal: 0, platformMargin: 0,
    };
  }
  // Matches the published /host-fees §4–5 and pricingEngine (pricing v2):
  //   Guest pays  = your price + ₹10 fee, GST INCLUDED (backed out, GST = remainder).
  //   You receive = price − commission − gateway(on the whole charge) − TDS − TCS.
  const fee          = E < feeFloor ? 0 : round2(bookingCharge);    // nothing under ₹300
  const taxableValue = round2(fee / (1 + gstRate));                  // ₹10 → ₹8.47
  const gstAmount    = round2(fee - taxableValue);                   // → ₹1.53, the remainder
  const guestTotal   = round2(E + fee);
  const commission   = round2(E * commissionRate);
  const pgCharge     = absorbsPg ? 0 : round2(guestTotal * pgRate); // gateway, borne by the host
  const tds          = round2(E * (hasPan ? TDS_RATE : TDS_RATE_NO_PAN)); // 194-O, on your price
  const tcs          = gstRegistered ? round2(E * TCS_RATE) : 0;    // §52, GST-registered hosts only
  const hostConsideration = round2(E - commission - pgCharge - tds - tcs);
  const platformMargin    = round2(taxableValue + commission); // fee ex-GST + commission (PG is the host's cost; TDS/TCS pass through to govt)
  return { targetEarning: round2(E), bookingCharge: fee, commission, pgCharge, tds, tcs, hostConsideration, taxableValue, gstAmount, guestTotal, platformMargin };
}

/**
 * Per-booking charge config for the two plans, plus their subscription cost.
 * Mirrors subscription_plans (migration v3.230, pricing v2) and the published /host-fees §1
 * table. Neither plan caps service price or booking volume any more, so
 * maxServicePrice is null on both.
 */
export const CALC_PLANS = [
  {
    key: 'free', name: 'Starter',
    charge: { bookingCharge: 10, commissionRate: 0.09, pgRate: 0.02, absorbsPg: false },
    monthly: 0, maxServicePrice: null,
    note: 'Free forever · 9% per booking',
  },
  {
    key: 'premium', name: 'Pro',
    charge: { bookingCharge: 10, commissionRate: 0, pgRate: 0.02, absorbsPg: false },
    // GST-INCLUSIVE, matching data/plans.js — this is subtracted from monthly
    // income, so it must be the amount actually charged, not the ex-GST base.
    monthly: 199, maxServicePrice: null,
    note: '0% commission · ₹199/mo',
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
