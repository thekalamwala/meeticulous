/**
 * noShowCalc.js — pure math for the /tools/no-show-cost-calculator page.
 *
 * No DB, no side effects — just the arithmetic, so it's unit-testable and the
 * page component stays presentational. All figures are the user's own inputs
 * turned into totals; nothing is invented or claimed about the platform.
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const clampPct = (v) => Math.min(100, Math.max(0, Number(v) || 0));

/**
 * @param {object} i
 * @param {number} i.bookingsPerMonth  bookings taken per month
 * @param {number} i.avgValue          average value of one booking (₹)
 * @param {number} i.noShowRatePct     % of bookings that no-show (0–100)
 * @param {number} [i.targetRatePct]   achievable no-show rate after reminders +
 *                                     upfront payment (default 5%) — used only to
 *                                     show the recoverable slice, never below 0.
 * @returns {{monthlyNoShows:number, monthlyLost:number, annualLost:number,
 *            recoverableAnnual:number, residualAnnual:number}}
 */
export function noShowCost({ bookingsPerMonth, avgValue, noShowRatePct, targetRatePct = 5 } = {}) {
  const bookings = num(bookingsPerMonth);
  const value = num(avgValue);
  const rate = clampPct(noShowRatePct);
  const target = Math.min(rate, clampPct(targetRatePct)); // can't "recover" below current

  const monthlyNoShows = (bookings * rate) / 100;
  const monthlyLost = monthlyNoShows * value;
  const annualLost = monthlyLost * 12;

  // What a lower no-show rate (reminders + payment upfront) would stop losing.
  const residualAnnual = ((bookings * target) / 100) * value * 12;
  const recoverableAnnual = Math.max(0, annualLost - residualAnnual);

  return { monthlyNoShows, monthlyLost, annualLost, recoverableAnnual, residualAnnual };
}
