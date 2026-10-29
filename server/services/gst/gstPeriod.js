'use strict';
/**
 * gstPeriod.js — IST-aware GST period math (fixes gap G6 in
 * docs/gst-finance-module-architecture.md).
 *
 * Every GST report is bounded by an Indian tax period (month / quarter / FY,
 * Apr–Mar) measured in Asia/Kolkata (UTC+5:30). The legacy invoiceService
 * fiscalYearFor() uses UTC, so a supply at 31-Mar 23:30 IST (18:00 UTC) would be
 * mis-filed into the wrong FY. This module resolves a period to a half-open UTC
 * range [from, to) that we compare against invoices.issued_at (a TIMESTAMPTZ).
 *
 * Pure, no DB, no side effects — trivially unit-testable.
 */

const IST_OFFSET_MIN = 330; // +05:30

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// IST civil midnight (y, mon1=1..12, day) → the exact UTC instant, as ISO.
function istMidnightUtc(y, mon1, day) {
  return new Date(Date.UTC(y, mon1 - 1, day, 0, 0, 0) - IST_OFFSET_MIN * 60000).toISOString();
}

// "now" shifted into IST civil time so getUTC* reads the IST wall clock.
function istNow(at = Date.now()) {
  return new Date(at + IST_OFFSET_MIN * 60000);
}

// FY start year for an IST instant: Apr–Dec → this year, Jan–Mar → last year.
function currentFyStart(at = Date.now()) {
  const d = istNow(at);
  return d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

// Accept '26', 26, '2026' or 2026 → 4-digit FY start year.
function normalizeFyStart(fy) {
  const n = Number(fy);
  if (!Number.isFinite(n)) return currentFyStart();
  return n < 100 ? 2000 + n : n;
}

const fyTwoDigit = (fyStart) => String(fyStart % 100).padStart(2, '0');
const fyLabel = (fyStart) => `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;

// Calendar year a given calendar month (1..12) falls in, within an FY.
function calendarYearFor(fyStart, mon1) {
  return mon1 >= 4 ? fyStart : fyStart + 1;
}

// ── Range builders ────────────────────────────────────────────
function fyRange(fy) {
  const fyStart = normalizeFyStart(fy);
  return {
    type: 'annual',
    label: fyLabel(fyStart),
    fiscalYear: fyTwoDigit(fyStart),
    periodKey: 'FY',
    from: istMidnightUtc(fyStart, 4, 1),
    to: istMidnightUtc(fyStart + 1, 4, 1),
  };
}

// mon1 = calendar month 1..12. The FY it reports under is derived from the month.
function monthRange(fy, mon1) {
  const fyStart = normalizeFyStart(fy);
  const m = Math.min(12, Math.max(1, Number(mon1) || 1));
  const y = calendarYearFor(fyStart, m);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return {
    type: 'month',
    label: `${MONTHS[m - 1]} ${y}`,
    fiscalYear: fyTwoDigit(fyStart),
    periodKey: `M${String(m).padStart(2, '0')}`,
    from: istMidnightUtc(y, m, 1),
    to: istMidnightUtc(ny, nm, 1),
  };
}

// GST quarters follow the FY: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.
function quarterRange(fy, q) {
  const fyStart = normalizeFyStart(fy);
  const qq = Math.min(4, Math.max(1, Number(q) || 1));
  const startMon = 4 + (qq - 1) * 3; // 4,7,10,13
  const startY = startMon > 12 ? fyStart + 1 : fyStart;
  const sMon = ((startMon - 1) % 12) + 1;
  const endMonAbs = startMon + 3; // exclusive
  const endY = endMonAbs > 12 ? fyStart + 1 : fyStart;
  const eMon = ((endMonAbs - 1) % 12) + 1;
  return {
    type: 'quarter',
    label: `Q${qq} ${fyLabel(fyStart)}`,
    fiscalYear: fyTwoDigit(fyStart),
    periodKey: `Q${qq}`,
    from: istMidnightUtc(startY, sMon, 1),
    to: istMidnightUtc(endY, eMon, 1),
  };
}

/**
 * Resolve a query into a period range. Precedence: explicit month → quarter → FY.
 * `fy` may be 2- or 4-digit; defaults to the current IST FY.
 *   resolvePeriod({ fy: '26', month: 9 })   → Sep 2026
 *   resolvePeriod({ fy: 26, quarter: 2 })    → Q2 FY2026-27
 *   resolvePeriod({ fy: 2026 })              → whole FY
 *   resolvePeriod({})                        → current FY
 */
function resolvePeriod({ fy, month, quarter } = {}) {
  const useFy = fy != null && fy !== '' ? fy : currentFyStart();
  if (month != null && month !== '') return monthRange(useFy, month);
  if (quarter != null && quarter !== '') return quarterRange(useFy, quarter);
  return fyRange(useFy);
}

module.exports = {
  IST_OFFSET_MIN,
  istMidnightUtc,
  currentFyStart,
  normalizeFyStart,
  fyTwoDigit,
  fyLabel,
  calendarYearFor,
  fyRange,
  monthRange,
  quarterRange,
  resolvePeriod,
};
