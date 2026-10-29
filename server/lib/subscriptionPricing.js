/**
 * server/lib/subscriptionPricing.js
 *
 * Pure helpers for the auto-renewing subscription model. No DB, no SDK,
 * no side effects — all Razorpay/DB orchestration lives in services.
 * Reuses computeSubscriptionBreakdown (GST charged ON TOP of plan price).
 */
'use strict';

const { computeSubscriptionBreakdown, round2 } = require('./pricingEngine');

// RBI e-mandate: auto-debit executes WITHOUT per-charge re-authentication only
// under ₹15,000 per transaction. Above this every charge needs customer approval,
// which defeats auto-renew. Used to warn admins when they set a plan price.
const AUTO_DEBIT_THRESHOLD = 15000;

const normCadence = (cadence) => {
  const c = String(cadence || '').toLowerCase().trim();
  if (c === 'yearly') return 'annual';
  return c;
};

/** Per-cadence base price (excl GST) read from a plan row. 0 if unset/unknown. */
function cadencePrice(plan, cadence) {
  const c = normCadence(cadence);
  if (c === 'monthly') return Number(plan?.monthly_price) || 0;
  if (c === 'annual') return Number(plan?.annual_price) || 0;
  return 0;
}

/** Gross amount (GST-inclusive) a cadence charges, in ₹. */
function cadenceGross(plan, cadence, gstRate) {
  const price = cadencePrice(plan, cadence);
  return computeSubscriptionBreakdown({ planPrice: price, gstRate }).totalCharged;
}

/** Razorpay Plan amount in paise — a fixed, GST-inclusive recurring charge. */
function cadenceAmountPaise(plan, cadence, gstRate) {
  return Math.round(cadenceGross(plan, cadence, gstRate) * 100);
}

/** True if a gross amount crosses the RBI frictionless auto-debit ceiling. */
function exceedsAutoDebitThreshold(grossAmount) {
  return Number(grossAmount) > AUTO_DEBIT_THRESHOLD;
}

/** Razorpay subscription interval config for a cadence. */
function razorpayInterval(cadence) {
  const c = normCadence(cadence);
  if (c === 'monthly') return { period: 'monthly', interval: 1 };
  if (c === 'annual') return { period: 'yearly', interval: 1 };
  throw new Error(`unknown cadence: ${cadence}`);
}

// ─── UPI AutoPay mandate duration cap ────────────────────────────────────────
// A Razorpay subscription's UPI AutoPay mandate spans total_count × period and
// must satisfy TWO independent limits:
//   1. Razorpay subscription max ≈ 100 years (end_time ≤ 4765046400, ~2121),
//      validated at subscriptions.create. A naive annual × 100 = ~2126 fails this.
//   2. UPI AutoPay mandate validity ≈ 10 YEARS, enforced by the bank/NPCI at
//      checkout (POST .../payments/create/ajax). THIS is the binding limit — even
//      a 93-year annual mandate (which clears limit #1) is rejected here with a
//      400 before any payment is created.
// Capping the SPAN to 10 years satisfies both (10yr ≪ 2121) and matches the
// monthly cadence, which already authorizes fine at 120 × 1mo = 10yr. The span is
// start-independent (count × period), so the cap never drifts over time.
const UPI_MANDATE_MAX_YEARS = 10;
const CYCLES_PER_YEAR = { monthly: 12, annual: 1 };
// "Effectively until cancelled" targets (Razorpay requires a finite total_count).
// The UPI cap brings annual down to 10; monthly already sits at the 10yr cap.
const DESIRED_TOTAL_COUNT = { monthly: 120, annual: 100 };

/**
 * total_count for a Razorpay subscription, capped so the UPI AutoPay mandate
 * spans at most UPI_MANDATE_MAX_YEARS (~10yr) — the validity limit the bank
 * enforces at checkout. monthly → 120 (10yr, unchanged), annual → 10 (10yr).
 *
 * @param {string} cadence  'monthly' | 'annual' | 'yearly'
 * @returns {number} total_count ≥ 1
 */
function subscriptionTotalCount(cadence) {
  const c = normCadence(cadence);
  const cyclesPerYear = CYCLES_PER_YEAR[c];
  const desired = DESIRED_TOTAL_COUNT[c];
  if (!cyclesPerYear || !desired) throw new Error(`unknown cadence: ${cadence}`);
  const maxCycles = UPI_MANDATE_MAX_YEARS * cyclesPerYear; // monthly 120, annual 10
  return Math.max(1, Math.min(desired, maxCycles));
}

// ─── Proration (Phase C) — forfeit-excess model ──────────────────────────────
/**
 * Unused credit from the current paid period.
 *   credit = (remaining_ms / total_ms) × amountPaid, clamped to [0, amountPaid].
 * Returns 0 for invalid/empty periods or non-positive payment.
 *
 * @param {object} p
 * @param {number} p.amountPaid   gross amount paid for the current period (₹)
 * @param {string|Date} p.periodStart
 * @param {string|Date} p.periodEnd
 * @param {string|Date} p.now
 * @returns {number} credit in ₹
 */
function computeProrationCredit({ amountPaid, periodStart, periodEnd, now }) {
  const paid = Number(amountPaid) || 0;
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const t = new Date(now).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(t)) return 0;
  if (!(end > start) || paid <= 0) return 0;
  const total = end - start;
  const remaining = Math.min(Math.max(end - t, 0), total);
  return round2(Math.min(Math.max(paid * (remaining / total), 0), paid));
}

/**
 * Amount to charge NOW on a switch, forfeiting any excess credit (Decision #4).
 *   charge = max(0, newPeriodGross − min(credit, newPeriodGross))
 *
 * @returns {{ creditApplied:number, forfeited:number, chargeNow:number }}
 */
function computeSwitchCharge({ credit, newPeriodGross }) {
  const gross = Number(newPeriodGross) || 0;
  const rawCredit = Math.max(0, Number(credit) || 0);
  const creditApplied = round2(Math.min(rawCredit, gross));
  return {
    creditApplied,
    forfeited: round2(Math.max(0, rawCredit - creditApplied)),
    chargeNow: round2(Math.max(0, gross - creditApplied)),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CADENCE_DAYS = { monthly: 30, annual: 365 };

/** Days in one billing period for a cadence. */
function cadencePeriodDays(cadence) {
  return CADENCE_DAYS[normCadence(cadence)] || 30;
}

/**
 * Resolve a tier/cadence SWITCH into deferred-start terms (Razorpay-friendly,
 * single mandate). The unused credit becomes FREE DAYS on the new plan instead
 * of a separate adjustment charge; excess credit beyond one new period is
 * forfeited (Decision #4). The new subscription's first real charge is deferred
 * to `startAtUnix`.
 *
 * @param {object} p
 * @param {number} p.amountPaid       gross paid for the current period (₹)
 * @param {string|Date} p.periodStart
 * @param {string|Date} p.periodEnd
 * @param {string|Date} p.now
 * @param {number} p.newPeriodGross   GST-inclusive price of one new period (₹)
 * @param {string} p.newCadence       'monthly' | 'annual'
 * @returns {{ credit:number, creditApplied:number, forfeited:number,
 *             creditDays:number, startAtUnix:number }}
 */
function computeSwitch({ amountPaid, periodStart, periodEnd, now, newPeriodGross, newCadence }) {
  const credit = computeProrationCredit({ amountPaid, periodStart, periodEnd, now });
  const gross = Number(newPeriodGross) || 0;
  const creditApplied = round2(Math.min(credit, gross));
  const forfeited = round2(Math.max(0, credit - creditApplied));
  const newDays = cadencePeriodDays(newCadence);
  const creditDays = gross > 0 ? Math.round((creditApplied / gross) * newDays) : 0;
  const nowMs = new Date(now).getTime();
  const startAtUnix = Math.floor((nowMs + creditDays * DAY_MS) / 1000);
  return { credit, creditApplied, forfeited, creditDays, startAtUnix };
}

module.exports = {
  AUTO_DEBIT_THRESHOLD,
  normCadence,
  cadencePrice,
  cadenceGross,
  cadenceAmountPaise,
  exceedsAutoDebitThreshold,
  razorpayInterval,
  subscriptionTotalCount,
  UPI_MANDATE_MAX_YEARS,
  cadencePeriodDays,
  computeProrationCredit,
  computeSwitchCharge,
  computeSwitch,
};
