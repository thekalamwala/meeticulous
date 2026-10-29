'use strict';
/**
 * bankHolidays.js — India bank (RBI) holidays = the days Razorpay does NOT settle to
 * a bank. We follow Razorpay's settlement schedule; this mirrors it so we can tell a
 * host when a holiday will push their payout out by a working day.
 *
 * National fixed-date holidays are listed with certainty; movable festival dates
 * (Holi, Eid, Diwali, Dussehra, …) shift each year — ADD them from the RBI holiday
 * calendar annually, or promote this to an admin-editable `bank_holidays` table.
 * Dates are YYYY-MM-DD in IST. Sundays are always non-settlement (handled in code).
 */

// date (YYYY-MM-DD, IST) -> display name. RBI/national + major statewide bank
// holidays (Razorpay non-settlement days). 2026 is the full list; TODO(yearly):
// refresh movable festival dates for 2027+ from the RBI calendar.
const BANK_HOLIDAYS = {
  // 2026
  '2026-01-15': 'Makar Sankranti',
  '2026-01-26': 'Republic Day',
  '2026-02-15': 'Mahashivratri',
  '2026-03-03': 'Holi (Dhuleti)',
  '2026-03-04': 'Holi',
  '2026-03-19': 'Ugadi',
  '2026-03-20': 'Eid-ul-Fitr (Ramzan)',
  '2026-03-27': 'Ram Navami',
  '2026-04-01': 'Annual Bank Closing',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr B. R. Ambedkar Jayanti',
  '2026-05-01': 'May Day',
  '2026-05-27': 'Bakri Eid (Eid-ul-Adha)',
  '2026-06-25': 'Muharram',
  '2026-08-15': 'Independence Day',
  '2026-08-25': 'Eid-e-Milad',
  '2026-09-04': 'Janmashtami',
  '2026-09-14': 'Ganesh Chaturthi',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-10-20': 'Dussehra (Vijaya Dashami)',
  '2026-11-08': 'Diwali',
  '2026-12-25': 'Christmas',
  // 2027 — fixed national only; add movable dates next year
  '2027-01-26': 'Republic Day',
  '2027-08-15': 'Independence Day',
  '2027-10-02': 'Gandhi Jayanti',
  '2027-12-25': 'Christmas',
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The IST calendar date for an epoch/Date, as { ymd:'YYYY-MM-DD', dow:0..6 } (0=Sun).
function istDate(now = Date.now()) {
  const d = new Date((typeof now === 'number' ? now : now.getTime()) + IST_OFFSET_MS);
  const ymd = d.toISOString().slice(0, 10);
  return { ymd, dow: d.getUTCDay() };
}

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dowOf = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

const isBankHoliday = (ymd) => Object.prototype.hasOwnProperty.call(BANK_HOLIDAYS, ymd);
const holidayName = (ymd) => BANK_HOLIDAYS[ymd] || null;
// Non-settlement = Sunday or a listed bank holiday. (Saturday nuance — RBI 2nd/4th
// Saturdays — omitted for MVP; add if needed.)
const isNonSettlementDay = (ymd) => dowOf(ymd) === 0 || isBankHoliday(ymd);

// First settlement day strictly after `ymd`.
function nextSettlementDay(ymd) {
  let d = addDays(ymd, 1);
  for (let i = 0; i < 15 && isNonSettlementDay(d); i++) d = addDays(d, 1);
  return d;
}

/**
 * The next WEEKDAY bank holiday within `windowDays` of `fromYmd` — i.e. a holiday
 * that adds delay beyond the normal weekend. Returns { date, name } or null.
 */
function upcomingDelayingHoliday(fromYmd, windowDays = 4) {
  for (let i = 1; i <= windowDays; i++) {
    const d = addDays(fromYmd, i);
    if (isBankHoliday(d) && dowOf(d) !== 0 && dowOf(d) !== 6) return { date: d, name: holidayName(d) };
  }
  return null;
}

// F19: the movable-festival dates (Holi, both Eids, Diwali, Dussehra, …) are added
// by hand each year. A year with too few entries means the calendar was never
// refreshed — the payout-delay notice would then SILENTLY under-warn hosts on
// exactly the days their money is late. Report the shortfall so it gets topped up
// from the RBI calendar instead of failing quietly (the old TODO had no alarm).
const MIN_ENTRIES_PER_YEAR = Number(process.env.BANK_HOLIDAY_MIN_ENTRIES || 10);
function holidayCalendarStatus(now = Date.now()) {
  const year = istDate(now).ymd.slice(0, 4);
  const count = Object.keys(BANK_HOLIDAYS).filter((d) => d.startsWith(`${year}-`)).length;
  return { year, count, stale: count < MIN_ENTRIES_PER_YEAR };
}

module.exports = {
  BANK_HOLIDAYS, istDate, addDays, dowOf, isBankHoliday, holidayName,
  isNonSettlementDay, nextSettlementDay, upcomingDelayingHoliday,
  holidayCalendarStatus,
};
