'use strict';
// botStrikes.js — per-IP strike counter for the Bolt abuse gate.
//
// Replaces the old conversationId-keyed strike count, which was trivially bypassed:
// conversationId is client-supplied, so an abuser just rotated/omitted it to reset
// strikes to 0 every message and never hit the cool-off. Keying on the resolved
// client IP (getClientIp) makes the count stick across rotated conversations.
//
// Durable + cross-instance when RATE_LIMIT_STORE_URL is set (shares the Postgres
// rate-limit store); in-memory per-instance fixed window otherwise — fine on a
// single Render instance. Window is read at init; a change needs a redeploy.

const { makeRateLimitStore } = require('../middleware/rateLimitStore');

const windowMs = () => (Number(process.env.BOT_STRIKE_WINDOW_SECONDS) || 3600) * 1000;

let store = makeRateLimitStore('bot-strike'); // undefined when the store is off
if (store) store.init({ windowMs: windowMs() });
const mem = new Map(); // key -> { hits, resetAt }

// Add `weight` strikes to `key` (an IP) and return the new total within the window.
// A threat weighs 2, a roast 1. Best-effort — the store path may throw; callers
// decide the fallback.
async function add(key, weight = 1) {
  const k = String(key || '').trim();
  if (!k || !(weight > 0)) return 0;
  if (store) {
    let total = 0;
    for (let i = 0; i < weight; i++) total = (await store.increment(k)).totalHits;
    return total;
  }
  const now = Date.now();
  let e = mem.get(k);
  if (!e || now >= e.resetAt) { e = { hits: 0, resetAt: now + windowMs() }; mem.set(k, e); }
  e.hits += weight;
  return e.hits;
}

// test-only: rebuild the in-memory counter (and re-read the store binding).
function _reset() {
  mem.clear();
  store = makeRateLimitStore('bot-strike');
  if (store) store.init({ windowMs: windowMs() });
}

module.exports = { add, _reset };
