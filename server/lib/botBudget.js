'use strict';
// botBudget.js — a GLOBAL budget on the bot's expensive model calls. The per-IP
// botLimiter is defeated by rotating IPs; this caps the actual Claude-Haiku calls
// across all IPs so spend is bounded no matter the attack. Checked at the
// model-call step in botService, AFTER the free short-circuits (guard/smalltalk/
// FAQ/cache), so only novel questions spend budget.
//
// Counters live in the shared rate-limit store when RATE_LIMIT_STORE_URL is set
// (cross-instance); otherwise in-memory per-instance fixed windows — fine on a
// single Render instance. Limits are read from env at call time so they retune
// without a redeploy. Any store error fails OPEN (a cost guard must not break the
// bot); the global request cap still bounds volume.

const { makeRateLimitStore } = require('../middleware/rateLimitStore');

const MIN_WINDOW_MS = 60 * 1000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const minMax = () => num(process.env.BOT_MODEL_CALLS_PER_MIN, 60);
const dayMax = () => num(process.env.BOT_MODEL_CALLS_PER_DAY, 5000);

// Returns an async increment(key) -> { totalHits }. Uses the Postgres store when
// configured, else an in-memory fixed-window counter.
function makeCounter(prefix, windowMs) {
  const store = makeRateLimitStore(prefix); // undefined when RATE_LIMIT_STORE_URL unset
  if (store) {
    store.init({ windowMs });
    return (key) => store.increment(key);
  }
  let hits = 0;
  let resetAt = 0;
  return async () => {
    const now = Date.now();
    if (now >= resetAt) { hits = 0; resetAt = now + windowMs; }
    hits += 1;
    return { totalHits: hits };
  };
}

let _min = makeCounter('bot-budget-min', MIN_WINDOW_MS);
let _day = makeCounter('bot-budget-day', DAY_WINDOW_MS);

// Consume one model call from the budget. Increments minute first (so a sustained
// flood keeps the minute window pegged and stays closed); the day counter only
// advances for calls that pass the minute gate.
// opts.failClosed — deny on a store error instead of the default fail-open. Use it
// for the abuse-judge path: a store blip there must not let a hostile-message flood
// keep spending Haiku calls; denying just skips the roast and falls through to the
// normal pipeline. The user-facing paths (summary/generate) keep the default
// fail-open so a transient store error never breaks a legitimate answer.
async function tryConsume(opts = {}) {
  try {
    const min = await _min('global');
    if (min.totalHits > minMax()) return { allowed: false, reason: 'minute' };
    const day = await _day('global');
    if (day.totalHits > dayMax()) return { allowed: false, reason: 'day' };
    return { allowed: true, reason: null };
  } catch (e) {
    const mode = opts.failClosed ? 'failing closed' : 'failing open';
    console.error(`[bot] budget store error — ${mode}:`, e.message);
    return { allowed: !opts.failClosed, reason: opts.failClosed ? 'store_error' : null };
  }
}

// test-only: rebuild the in-memory counters between tests.
function _reset() {
  _min = makeCounter('bot-budget-min', MIN_WINDOW_MS);
  _day = makeCounter('bot-budget-day', DAY_WINDOW_MS);
}

module.exports = { tryConsume, _reset };
