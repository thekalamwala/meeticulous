/**
 * redisClient.js — a single lazily-created ioredis connection, shared by anything
 * that wants Redis (responseCache today; the rate-limit store later).
 *
 * OFF BY DEFAULT: with no REDIS_URL the getter returns null and every caller
 * falls back to its in-process behavior — so local/CI/current-prod are unchanged
 * until an Upstash (or other) Redis URL is set. `rediss://` URLs get TLS
 * automatically (Upstash).
 *
 * FAIL-OPEN: `enableOfflineQueue: false` makes commands reject immediately when
 * the connection is down instead of buffering/hanging, so a Redis outage
 * degrades callers to their fallback path rather than stalling requests. The
 * connection never throws at boot (a bad URL just logs and callers stay on the
 * fallback).
 */
let resolved = false;
let client = null;
let warned = false;

function warnOnce(msg) {
  if (warned) return;
  warned = true;
  console.error(`[redis] ${msg}`);
}

function getRedis() {
  if (resolved) return client;
  resolved = true;

  const url = process.env.REDIS_URL;
  if (!url) { client = null; return client; }

  try {
    const IORedis = require('ioredis');
    client = new IORedis(url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,      // fail fast → callers use their fallback
      connectTimeout: 5000,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    // Swallow connection errors so an outage can't crash the process; the
    // command-level rejections already drive the fail-open fallback.
    client.on('error', (err) => warnOnce(`connection error: ${err.message}`));
    console.log('[redis] client initialised');
  } catch (err) {
    warnOnce(`init failed, staying on in-process fallback: ${err.message}`);
    client = null;
  }
  return client;
}

// Test seam: reset the memoized client so a suite can inject REDIS_URL / a mock.
function _reset() { resolved = false; client = null; warned = false; }

module.exports = { getRedis, _reset };
