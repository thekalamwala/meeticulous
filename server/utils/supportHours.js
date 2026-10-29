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

module.exports = { isOpen, LABEL };
