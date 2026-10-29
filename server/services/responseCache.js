/**
 * responseCache.js — a tiny read-through TTL cache for assembled public API
 * responses (host profile, service detail). These endpoints each fire 6+ DB
 * queries and are the highest-traffic, most crawler-hit surface, so caching the
 * finished payload for a short window collapses repeated identical work.
 *
 * BACKEND is pluggable behind getOrSet / bust / clear:
 *   - Redis (shared, survives restarts, correct across multiple API instances)
 *     when REDIS_URL is set — see services/redisClient.js.
 *   - In-process Map (zero-infra, single instance) otherwise — the default.
 * Callers never see which is active. Values are JSON round-tripped on the Redis
 * path (payloads + the {notFound}/{redirect} markers are all JSON-safe), so a
 * cache hit there is a deep copy, not the same reference (in-process keeps ref
 * identity). Nothing downstream depends on identity.
 *
 * FAIL-OPEN: any Redis error (down, timeout, corrupt value) degrades to running
 * the producer without caching — a cache outage slows things down, never breaks
 * them.
 *
 * BOUNDED (in-process): entries carry a TTL and the store is capped
 * (MAX_ENTRIES) with expired-then-oldest eviction, so a flood of unique keys
 * (a crawler walking every username) can't grow memory without bound. Redis
 * bounds itself via native PX expiry.
 *
 * Staleness: a write busts by key prefix, but the TTL is the real guarantee
 * (matches the 120s HTTP Cache-Control on the same endpoints).
 */

const { getRedis } = require('./redisClient');

const MAX_ENTRIES = Number(process.env.RESPONSE_CACHE_MAX_ENTRIES) || 2000;
const ENABLED = process.env.RESPONSE_CACHE_ENABLED !== 'false'; // kill-switch
const NS = 'rc:'; // Redis key namespace so bust-by-prefix can't touch other keys

let warned = false;
function warnOnce(msg) {
  if (warned) return;
  warned = true;
  console.error(`[responseCache] ${msg}`);
}

// ── In-process backend ────────────────────────────────────────────────────────
const store = new Map(); // key -> { value, exp }

function _evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.exp <= now) store.delete(k);
  }
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

async function _memGetOrSet(key, ttlMs, producer) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.value;
  if (hit) store.delete(key);
  const value = await producer();
  store.set(key, { value, exp: now + ttlMs });
  _evictIfNeeded();
  return value;
}

function _memBust(prefix) {
  let n = 0;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) { store.delete(k); n++; }
  }
  return n;
}

// ── Redis backend ─────────────────────────────────────────────────────────────
async function _redisGetOrSet(redis, key, ttlMs, producer) {
  const rk = NS + key;
  let raw;
  try {
    raw = await redis.get(rk);
  } catch (err) {
    warnOnce(`get failed, running uncached: ${err.message}`);
    return producer(); // fail-open: skip cache entirely this call
  }
  if (raw != null) {
    try { return JSON.parse(raw); } catch { /* corrupt entry → treat as miss */ }
  }
  const value = await producer();
  // Best-effort write; never block the response or throw on a cache-set failure.
  Promise.resolve()
    .then(() => redis.set(rk, JSON.stringify(value), 'PX', ttlMs))
    .catch((err) => warnOnce(`set failed: ${err.message}`));
  return value;
}

async function _redisBust(redis, prefix) {
  const match = `${NS}${prefix}*`;
  let cursor = '0';
  let n = 0;
  try {
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 200);
      cursor = next;
      if (keys.length) { await redis.del(...keys); n += keys.length; }
    } while (cursor !== '0');
  } catch (err) {
    warnOnce(`bust scan failed: ${err.message}`);
  }
  return n;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the cached value for `key`, or run `producer()`, cache its result for
 * `ttlMs`, and return it. A throwing producer is NOT cached.
 */
async function getOrSet(key, ttlMs, producer) {
  if (!ENABLED) return producer();
  const redis = getRedis();
  return redis ? _redisGetOrSet(redis, key, ttlMs, producer)
               : _memGetOrSet(key, ttlMs, producer);
}

/** Delete every entry whose key starts with `prefix`. Never throws. */
async function bust(prefix) {
  const redis = getRedis();
  return redis ? _redisBust(redis, prefix) : _memBust(prefix);
}

/**
 * Return the cached value for `key` if present and unexpired, else undefined.
 * Read-only (never runs a producer, never writes) — used for fail-soft stale
 * serving when a request is rate-limited. Never throws.
 */
async function peek(key) {
  if (!ENABLED) return undefined;
  const redis = getRedis();
  if (redis) {
    try { const raw = await redis.get(NS + key); return raw != null ? JSON.parse(raw) : undefined; }
    catch { return undefined; }
  }
  const hit = store.get(key);
  return hit && hit.exp > Date.now() ? hit.value : undefined;
}

/** Wipe everything in this namespace (tests / admin). Never throws. */
async function clear() {
  const redis = getRedis();
  if (!redis) { const n = store.size; store.clear(); return n; }
  return _redisBust(redis, ''); // SCAN rc:* and delete
}

function _size() { return store.size; }

module.exports = { getOrSet, peek, bust, clear, _size };
