/**
 * server/lib/pricingEngine.js
 *
 * Single source of truth for all money math. Pure functions, no DB access,
 * no side effects. Configuration (platform fee, GST rate, TDS/TCS rates) and the
 * commission percentage are injected by the caller — NOTHING about plans or rates
 * is hardcoded here (commission % comes from the vendor's subscription plan row).
 *
 * The money model (marketplace, final v4 — docs/payment-model.md v4):
 *
 * Meeticulous is an INTERMEDIARY. The host's listed price is the host's revenue,
 * NOT a sale on our books. We invoice only our own fee + commission.
 *
 *   Customer pays  = servicePrice + platformFee + gstOnPlatformFee
 *   platformFee    = flat, admin-configurable (default ₹10); 0 for free services
 *   gst            = gstRate × platformFee   (GST ADDED ON TOP of the fee)
 *   commission     = commissionPercentage × servicePrice   (from plan record).
 *                    GST-INCLUSIVE — the 5% the host bears already contains 18% GST.
 *   commissionGst  = commission − commission/(1+gstRate)   (EXTRACTED, not added)
 *   commissionTaxable = commission − commissionGst   (taxable value on host invoice)
 *   razorpayFee    = ALWAYS borne by the host; the ACTUAL fee Razorpay charged
 *   tds            = 194-O withholding, tdsRate × servicePrice (base only). Govt's.
 *   tcs            = Sec 52 collection, tcsRate × servicePrice (base only). Govt's.
 *   Host payout    = servicePrice − commission − razorpayFee − tds − tcs
 *
 *   Free plan (5% comm),  ₹1000, PG ₹20.24:  payout = 1000 − 50 − 20.24 − 10 − 10 = 909.76
 *   Paid plan (0% comm),  ₹1000, PG ₹20.24:  payout = 1000 −  0 − 20.24 − 10 − 10 = 959.76
 *   (All GST/TDS/TCS collected belongs to the government, not the platform. Host
 *    claims TDS/TCS credit and commission-GST input credit.)
 *
 *   Subscriptions (PRD §5.2): GST is charged ON TOP of the plan price —
 *   ₹999 plan → GST ₹179.82 → total charged ₹1,178.82 (computeSubscriptionBreakdown).
 */

'use strict';

const DEFAULTS = Object.freeze({
  platformFee: 10,   // ₹ flat, overridden by platform_settings.platform_fee
  gstRate: 0.18,     // 18% GST — applied to platform fee, commission, and subscriptions
  tdsRate: 0.01,     // 194-O income-tax TDS on host gross sale; 0.05 when host has no PAN
  tcsRate: 0.01,     // Sec 52 GST TCS on host gross sale
});

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const assertNonNegative = (value, label) => {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new Error(`${label} cannot be negative`);
  }
};

// ─── Platform fee (charged to the customer, on top of the service price) ──────
/**
 * @param {number} servicePrice  service amount (≥ 0)
 * @param {object} [opts]        { platformFee, chargeFeeOnFree } override (e.g. from settings)
 *   chargeFeeOnFree — when true, a ₹0 service STILL carries the flat fee. Used by the
 *   interim fee-only mode (host prices forced to ₹0, no Route yet): Meeticulous collects
 *   only its own booking fee + GST and no host money moves. Default false (₹0 → no fee).
 * @returns {number} flat platform fee in ₹ (0 for a free service unless chargeFeeOnFree)
 */
function calculatePlatformFee(servicePrice, opts = {}) {
  assertNonNegative(servicePrice, 'servicePrice');
  if (servicePrice === 0 && !opts.chargeFeeOnFree) return 0;
  const fee = opts.platformFee != null ? Number(opts.platformFee) : DEFAULTS.platformFee;
  assertNonNegative(fee, 'platformFee');
  return round2(fee);
}

// ─── GST on the platform fee (collected from customer, owed to government) ────
/**
 * @param {number} platformFee  flat platform fee (≥ 0)
 * @param {object} [opts]       { gstRate } override (e.g. from settings)
 * @returns {number} GST amount in ₹
 */
function calculateGst(platformFee, opts = {}) {
  assertNonNegative(platformFee, 'platformFee');
  const rate = opts.gstRate != null ? Number(opts.gstRate) : DEFAULTS.gstRate;
  assertNonNegative(rate, 'gstRate');
  return round2(platformFee * rate);
}

// ─── Commission (platform's cut, from the vendor's plan record) ──────────────
/**
 * @param {number} servicePrice          service amount (≥ 0)
 * @param {number} commissionPercentage  e.g. 5 for 5% (read from plan; 0 for paid)
 * @returns {number} commission in ₹
 */
function calculateCommission(servicePrice, commissionPercentage) {
  assertNonNegative(servicePrice, 'servicePrice');
  const pct = Number(commissionPercentage);
  if (Number.isNaN(pct) || pct < 0) throw new Error('commissionPercentage cannot be negative');
  return round2(servicePrice * (pct / 100));
}

// ─── GST inside the commission (EXTRACTED — commission is GST-inclusive) ─────
/**
 * The 5% commission the host bears already CONTAINS 18% GST (v4, inclusive).
 * We back the GST out of it rather than adding it on top.
 * @param {number} commission  commission amount (₹, GST-inclusive)
 * @param {object} [opts]      { gstRate } override (default 18%)
 * @returns {number} GST component inside the commission, in ₹
 */
function calculateCommissionGst(commission, opts = {}) {
  assertNonNegative(commission, 'commission');
  const rate = opts.gstRate != null ? Number(opts.gstRate) : DEFAULTS.gstRate;
  assertNonNegative(rate, 'gstRate');
  return round2(commission - commission / (1 + rate));
}

// ─── Taxable value of the commission (host-invoice line, ex-GST) ─────────────
/**
 * @param {number} commission  commission amount (₹, GST-inclusive)
 * @param {object} [opts]      { gstRate } override (default 18%)
 * @returns {number} taxable value (commission ex-GST) in ₹
 */
function calculateCommissionTaxable(commission, opts = {}) {
  assertNonNegative(commission, 'commission');
  const rate = opts.gstRate != null ? Number(opts.gstRate) : DEFAULTS.gstRate;
  assertNonNegative(rate, 'gstRate');
  return round2(commission / (1 + rate));
}

// ─── TDS (194-O) — income-tax withheld from the host, remitted to govt ───────
/**
 * @param {number} servicePrice  host gross sale / base (₹, ≥ 0)
 * @param {object} [opts]        { tdsRate } override (default 1%; 5% if host has no PAN)
 * @returns {number} TDS amount in ₹ (pass-through; host claims credit)
 */
function calculateTds(servicePrice, opts = {}) {
  assertNonNegative(servicePrice, 'servicePrice');
  const rate = opts.tdsRate != null ? Number(opts.tdsRate) : DEFAULTS.tdsRate;
  assertNonNegative(rate, 'tdsRate');
  return round2(servicePrice * rate);
}

// ─── TCS (GST Sec 52) — collected from the host, remitted to govt ────────────
/**
 * @param {number} servicePrice  host gross sale / base (₹, ≥ 0)
 * @param {object} [opts]        { tcsRate } override (default 1%)
 * @returns {number} TCS amount in ₹ (pass-through; host claims credit)
 */
function calculateTcs(servicePrice, opts = {}) {
  assertNonNegative(servicePrice, 'servicePrice');
  const rate = opts.tcsRate != null ? Number(opts.tcsRate) : DEFAULTS.tcsRate;
  assertNonNegative(rate, 'tcsRate');
  return round2(servicePrice * rate);
}

// ─── Host payout (commission is GST-inclusive; PG + TDS + TCS host-borne) ────
/**
 * @param {number} servicePrice   host listed price / base
 * @param {number} commission     platform commission (₹, GST-inclusive — its GST is INSIDE)
 * @param {number} [razorpayFee]  ACTUAL Razorpay fee+tax total (₹), host-borne
 * @param {number} [tds]          194-O TDS (₹), remitted to govt
 * @param {number} [tcs]          Sec 52 TCS (₹), remitted to govt
 * @returns {number} net amount the host receives in ₹
 */
function calculateVendorPayout(servicePrice, commission, razorpayFee = 0, tds = 0, tcs = 0) {
  assertNonNegative(servicePrice, 'servicePrice');
  assertNonNegative(commission, 'commission');
  assertNonNegative(razorpayFee, 'razorpayFee');
  assertNonNegative(tds, 'tds');
  assertNonNegative(tcs, 'tcs');
  // Floor at 0: a payout is a share of the host's sale and can never be negative.
  // The only way this went negative was a ₹0 (fee-only) service where the gateway
  // fee was still subtracted — a host who sold nothing cannot owe the platform.
  // A negative value produced a negative journal line, which post_journal_entry
  // rejects outright ("line amounts cannot be negative"), so the ORDER_PAYMENT
  // entry never posted and the reconciler re-failed on it forever. When the payout
  // is 0 the gateway fee is BAS-borne — see orderPaymentEntry.
  return round2(Math.max(0, servicePrice - commission - razorpayFee - tds - tcs));
}

// ─── Customer total (what is actually charged) ───────────────────────────────
/**
 * @param {number} servicePrice  service amount
 * @param {number} platformFee   flat platform fee (₹)
 * @param {number} gst           GST on the platform fee (₹)
 * @returns {number} total charged to the customer in ₹
 */
function calculateCustomerTotal(servicePrice, platformFee, gst) {
  assertNonNegative(servicePrice, 'servicePrice');
  assertNonNegative(platformFee, 'platformFee');
  assertNonNegative(gst, 'gst');
  return round2(servicePrice + platformFee + gst);
}

/**
 * Convenience: compute the full money breakdown for a booking in one call.
 * razorpayFee defaults to 0 (unknown until payment capture).
 *
 * @returns {{ servicePrice, platformFee, gst, commission, commissionGst,
 *             razorpayFee, customerTotal, vendorPayout, platformRevenue }}
 */
function computeBreakdown({ servicePrice, commissionPercentage, platformFee, gstRate, razorpayFee = 0, tdsRate, tcsRate, chargeFeeOnFree = false }) {
  const fee = calculatePlatformFee(servicePrice, { platformFee, chargeFeeOnFree });
  const gst = calculateGst(fee, { gstRate });
  const commission = calculateCommission(servicePrice, commissionPercentage);
  const commissionGst = calculateCommissionGst(commission, { gstRate });        // GST inside commission
  const commissionTaxable = calculateCommissionTaxable(commission, { gstRate }); // commission ex-GST
  // TDS/TCS apply to the host's gross sale only, and only to a paid (non-free) booking.
  const tds = servicePrice > 0 ? calculateTds(servicePrice, { tdsRate }) : 0;
  const tcs = servicePrice > 0 ? calculateTcs(servicePrice, { tcsRate }) : 0;
  const vendorPayout = calculateVendorPayout(servicePrice, commission, razorpayFee, tds, tcs);
  const customerTotal = calculateCustomerTotal(servicePrice, fee, gst);
  return {
    servicePrice: round2(servicePrice),
    platformFee: fee,
    gst,
    commission,
    commissionGst,
    commissionTaxable,
    tds,
    tcs,
    razorpayFee: round2(razorpayFee),
    customerTotal,
    vendorPayout,
    // Platform keeps platform fee + commission NET of GST (GST/TDS/TCS are pass-through).
    platformRevenue: round2(fee + commissionTaxable),
  };
}

// ─── Platform revenue kept from a stored booking row ─────────────────────────
/**
 * Net (ex-GST) platform revenue for one booking, from its snapshot columns.
 *
 * The two money columns are stored on DIFFERENT tax bases and must never be
 * added directly:
 *   platform_fee_amount  EX-GST  (its tax sits in platform_fee_gst)
 *   commission_applied   GST-INCLUSIVE (its tax is INSIDE, per the v4 model)
 *
 * `platform_fee_amount + commission_applied` therefore reports the commission's
 * GST as revenue — while the same rupees are also reported under taxes, and
 * added a third time when gross is computed as revenue + taxes. For a ₹1,000
 * free-plan booking that overstates net revenue by ₹7.63 (₹60 vs ₹52.37).
 *
 * Prefers the stored commission_gst snapshot; derives it from the booking's own
 * gst_rate only when that column wasn't selected or predates the v2.8 snapshot.
 *
 * @param {object} row  booking row with platform_fee_amount, commission_applied,
 *                      and ideally commission_gst (else gst_rate)
 * @returns {number} ex-GST platform revenue in ₹
 */
function platformNetFromBooking(row) {
  const fee = Number(row?.platform_fee_amount) || 0;
  const commission = Number(row?.commission_applied) || 0;
  const commissionGst = row?.commission_gst != null
    ? Number(row.commission_gst) || 0
    : calculateCommissionGst(commission, {
        gstRate: row?.gst_rate != null ? Number(row.gst_rate) : undefined,
      });
  // Floor at 0: a malformed snapshot must not produce negative revenue.
  return round2(fee + Math.max(0, round2(commission - commissionGst)));
}

// ─── Subscription breakdown (GST charged ON TOP of plan price — PRD §5.2) ────
function computeSubscriptionBreakdown({ planPrice, gstRate }) {
  assertNonNegative(planPrice, 'planPrice');
  const rate = gstRate != null ? Number(gstRate) : DEFAULTS.gstRate;
  assertNonNegative(rate, 'gstRate');
  const gstAmount = round2(planPrice * rate);
  return {
    planPrice: round2(planPrice),
    gstAmount,
    totalCharged: round2(planPrice + gstAmount),
  };
}

module.exports = {
  DEFAULTS,
  calculatePlatformFee,
  calculateGst,
  calculateCommission,
  calculateCommissionGst,
  calculateCommissionTaxable,
  calculateTds,
  calculateTcs,
  calculateVendorPayout,
  calculateCustomerTotal,
  computeBreakdown,
  platformNetFromBooking,
  computeSubscriptionBreakdown,
  round2,
};
