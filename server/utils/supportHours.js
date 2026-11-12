'use strict';

// Live-support window: when a human is on chat. Outside it, escalation still works
// but becomes a logged ticket (no admin ring) with an honest "we'll reply when we're
// back" message — Bolt stays available 24/7 regardless.
//
// ponytail: constants (env-overridable), not a DB/admin-config table yet. If the
// team wants to edit hours from the admin console later, move OPEN_* into
// platform_settings and read them here — the callers won't change.

const START_HOUR = Number(process.env.SUPPORT_HOURS_START || 10); // 10am IST
const END_HOUR   = Number(process.env.SUPPORT_HOURS_END   || 18); // 6pm IST (exclusive)
const OPEN_DAYS  = (process.env.SUPPORT_HOURS_DAYS || '1,2,3,4,5') // Mon–Fri
  .split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));

const LABEL = process.env.SUPPORT_HOURS_LABEL || 'Mon–Fri, 10am–6pm IST';

// IST wall-clock = UTC + 5:30. Shift the instant by 330 min, then read UTC fields.
function istNow(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000);
}

function isOpen(now = new Date()) {
  const i = istNow(now);
  return OPEN_DAYS.includes(i.getUTCDay()) && i.getUTCHours() >= START_HOUR && i.getUTCHours() < END_HOUR;
}

const HOUR_MS = 3600000;
const BUSINESS_DAY_MIN = (END_HOUR - START_HOUR) * 60;

// Minutes of the support window between two instants. Walks one IST day at a time,
// clipping each open day to START_HOUR..END_HOUR. Public holidays count as open days,
// same as isOpen.
function businessMinutesBetween(from, to) {
  const end = istNow(to).getTime();
  let t = istNow(from).getTime();
  let ms = 0;
  while (t < end) {
    const d = new Date(t);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (OPEN_DAYS.includes(d.getUTCDay())) {
      ms += Math.max(0, Math.min(end, dayStart + END_HOUR * HOUR_MS) - Math.max(t, dayStart + START_HOUR * HOUR_MS));
    }
    t = dayStart + 24 * HOUR_MS;
  }
  return ms / 60000;
}

module.exports = { isOpen, LABEL, BUSINESS_DAY_MIN, businessMinutesBetween };
