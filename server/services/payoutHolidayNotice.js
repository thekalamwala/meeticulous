'use strict';
/**
 * payoutHolidayNotice.js — weekly (Friday) heads-up when a bank holiday will delay
 * this week's payout settlements. We follow Razorpay's settlement schedule, which
 * skips RBI bank holidays; this just tells the host so the extra day isn't a surprise.
 *
 * Self-gating: does nothing unless it's Friday (IST) AND a weekday bank holiday falls
 * in the next few days. Emails hosts with a recently-released payout, deduped once per
 * booking (bookings.holiday_notice_sent_at). Emails only — moves no money.
 */
const { supabaseAdmin } = require('../config/supabase');
const { istDate, upcomingDelayingHoliday, nextSettlementDay, holidayCalendarStatus } = require('../utils/bankHolidays');
const payoutEmails = require('./payoutEmails');
const { adminAlert } = require('../utils/adminAlert');

const LOOKBACK_DAYS = Number(process.env.HOLIDAY_NOTICE_LOOKBACK_DAYS || 3);
const LIMIT = 500;
const SKIP_SETTLE = new Set(['cancelled', 'not_eligible']);

async function run(now = Date.now()) {
  const ist = istDate(now);
  if (ist.dow !== 5) return { skipped: 'not_friday', ymd: ist.ymd };          // Fridays only

  // F19: once a week, flag a bank-holiday calendar that was never refreshed for the
  // current year (an empty calendar would silently make upcomingDelayingHoliday
  // return null forever — hosts under-warned, no error). adminAlert is throttled per
  // key, so this pings ~weekly until someone tops it up. Best-effort; never blocks.
  const cal = holidayCalendarStatus(now);
  if (cal.stale) {
    adminAlert({
      key: `bank_holiday_stale:${cal.year}`,
      subject: `Bank-holiday calendar for ${cal.year} looks incomplete (${cal.count} dates)`,
      lines: [
        `utils/bankHolidays.js has only ${cal.count} entries for ${cal.year}.`,
        `Movable festival dates (Holi, both Eids, Diwali, Dussehra, Janmashtami, …) are added by hand each year.`,
        `Until it's topped up from the RBI holiday calendar, host payout-delay notices will under-warn on those days.`,
      ],
    });
  }

  const holiday = upcomingDelayingHoliday(ist.ymd, 4);
  if (!holiday) return { skipped: 'no_holiday', ymd: ist.ymd };
  const expected = nextSettlementDay(holiday.date);

  const since = new Date(now - LOOKBACK_DAYS * 86400000).toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, vendor_amount, settlement_status')
    .eq('transfer_status', 'processed')
    .gte('transfer_released_at', since)
    .is('holiday_notice_sent_at', null)
    .limit(LIMIT);
  if (error) return { skipped: 'query_error', reason: error.message };

  let notified = 0;
  for (const b of rows || []) {
    if (SKIP_SETTLE.has(b.settlement_status)) continue;
    await payoutEmails.sendHolidayDelay(b, holiday, expected);
    notified++;
  }
  return { holiday: holiday.name, date: holiday.date, expected, candidates: (rows || []).length, notified };
}

module.exports = { run };
