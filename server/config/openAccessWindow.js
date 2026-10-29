'use strict';

/**
 * Temporary "open access" window — a launch/event kill-switch that lifts ALL
 * per-IP / per-contact rate limits AND IP-ban enforcement while active.
 *
 * Set OPEN_ACCESS_UNTIL to a future epoch-ms timestamp to open the gates; every
 * limiter is skipped and ipGuard stops enforcing bans until that moment passes,
 * then everything auto re-gates with no revert deploy. Unset / blank / non-numeric
 * / past → returns false, so normal limits apply. Read live so the env can be
 * flipped without a restart.
 *
 * Unlike load-test mode this is honoured in production ON PURPOSE (that's the
 * point). It only relaxes abuse limits — it does NOT touch payment signature
 * checks or any correctness path.
 */
// Hard ceiling on how far in the future the window may end. A launch window is
// hours/days; a value beyond this is almost certainly a fat-finger or a
// "permanently open" mistake, so we treat it as misconfigured and DON'T open the
// gates (fail-safe: normal rate limits stay ENFORCED). Override via env if a
// genuinely longer window is ever needed. (P1-01)
const MAX_OPEN_ACCESS_MS =
  Number(process.env.OPEN_ACCESS_MAX_MS) || 7 * 24 * 60 * 60 * 1000; // 7 days

// Throttle the (loud) status log to at most once an hour — this runs on every
// request, so it must never log per-call.
let _lastLogAt = 0;
const _logOncePerHour = (msg) => {
  const now = Date.now();
  if (now - _lastLogAt > 60 * 60 * 1000) {
    _lastLogAt = now;
    console.warn(msg);
  }
};

function isOpenAccess() {
  const until = Number(process.env.OPEN_ACCESS_UNTIL);
  if (!Number.isFinite(until) || until <= Date.now()) return false;

  if (until - Date.now() > MAX_OPEN_ACCESS_MS) {
    _logOncePerHour(
      `[openAccess] OPEN_ACCESS_UNTIL is >${Math.round(MAX_OPEN_ACCESS_MS / 3600000)}h ` +
      `in the future (${new Date(until).toISOString()}); treating as misconfigured — ` +
      `IGNORED, normal rate limits & IP bans ENFORCED. Set a shorter window or ` +
      `raise OPEN_ACCESS_MAX_MS if this is intentional.`,
    );
    return false;
  }

  _logOncePerHour(
    `[openAccess] OPEN ACCESS ACTIVE until ${new Date(until).toISOString()} — ` +
    `ALL rate limits & IP bans are LIFTED platform-wide.`,
  );
  return true;
}

module.exports = { isOpenAccess, MAX_OPEN_ACCESS_MS };
