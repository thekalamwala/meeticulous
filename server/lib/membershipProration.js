'use strict';
/**
 * membershipProration.js — what a member owes today when they move up a tier.
 *
 * Upgrades are immediate and prorated: the unused part of the tier they already
 * paid for becomes a credit against the first charge of the dearer tier. The
 * recurring subscription for the new tier then starts at the old period end, so
 * the member is never charged twice for the same days.
 *
 * Money in, money out, no I/O — so it is unit-testable and the controller stays
 * about guards and Razorpay calls.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Whole days left on the paid-for period, from `now` to `periodEndIso`.
 * Rounded UP: a member with four hours left still paid for that calendar day.
 * Clamped to [0, cycleDays] — a missing, past or absurd period end must never
 * mint more credit than one cycle's worth.
 */
function remainingDays(periodEndIso, now = new Date(), cycleDays = 30) {
  if (!periodEndIso) return 0;
  const end = new Date(periodEndIso).getTime();
  if (!Number.isFinite(end)) return 0;
  const left = Math.ceil((end - now.getTime()) / DAY_MS);
  if (!(left > 0)) return 0;
  return Math.min(left, cycleDays);
}

/**
 * Credit + amount due for a tier move.
 *
 * @param {object} p
 * @param {number} p.currentPriceInr  price of the tier held now (0 for a free tier)
 * @param {number} p.newPriceInr      price of the tier being moved to (> 0)
 * @param {string} [p.periodEndIso]   current_period_end of the paid membership
 * @param {Date}   [p.now]
 * @param {number} [p.cycleDays]      billing cycle length; monthly is the only cadence today
 * @returns {{creditInr:number, dueNowInr:number, remainingDays:number}}
 */
function quoteUpgrade({ currentPriceInr = 0, newPriceInr, periodEndIso, now = new Date(), cycleDays = 30 }) {
  const current = Math.max(0, Number(currentPriceInr) || 0);
  const next = Number(newPriceInr) || 0;
  if (!(next > 0)) throw new Error('newPriceInr must be > 0');

  const days = remainingDays(periodEndIso, now, cycleDays);
  // A free tier has no money behind it, so it earns no credit however long it runs.
  const creditInr = current > 0 ? Math.min(current, round2((current * days) / cycleDays)) : 0;
  const dueNowInr = Math.max(0, round2(next - creditInr));
  return { creditInr, dueNowInr, remainingDays: days };
}

/** An upgrade is strictly upward in price. Equal or cheaper is not one. */
const isUpgrade = (currentPriceInr, newPriceInr) =>
  (Number(newPriceInr) || 0) > (Number(currentPriceInr) || 0);

module.exports = { quoteUpgrade, remainingDays, isUpgrade, round2 };
