// Optional persistent (Postgres-backed) store for express-rate-limit.
//
// DEFAULT OFF. When RATE_LIMIT_STORE_URL is unset, makeRateLimitStore() returns
// undefined and every limiter falls back to express-rate-limit's in-memory
// MemoryStore — behaviour is byte-for-byte what it is today. Only when the URL
// is set (a deliberate step taken when moving to more than one server instance)
// do limiters share counters across instances and survive restarts.
//
// Why this exists: the in-memory store resets on every deploy and is per-process,
// so it cannot work once the API runs on >1 instance. This is the seam that makes
// that switch a one-env-var change. NOTE: it adds a DB round-trip per rate-limited
// request, so keep it OFF until you genuinely run multiple instances (which also
// requires cron job-locking first). Requires the rate_limit_hits table —
// migrations/v3.18_rate_limit_store.sql.
//
// One shared pg Pool serves every limiter; each limiter passes a distinct
// `prefix` so their buckets don't collide.

const STORE_URL = process.env.RATE_LIMIT_STORE_URL;

let pool = null;
function getPool() {
  if (pool) return pool;
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: STORE_URL,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.RATE_LIMIT_STORE_POOL_MAX || 5),
  });
  pool.on('error', (e) => console.error('rate-limit store pool error:', e.message));
  return pool;
}

// express-rate-limit v7 Store. One instance per limiter (each captures its own
// windowMs in init), all sharing the module-level pool.
class PostgresRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60 * 1000;
  }

  init(options) {
    if (options && options.windowMs) this.windowMs = options.windowMs;
  }

  // Atomic upsert: a fresh key starts at 1; an existing key within its window
  // increments; an existing key whose window has expired is reset to 1 with a
  // new window — all in one statement so concurrent requests can't race.
  async increment(key) {
    const { rows } = await getPool().query(
      `INSERT INTO rate_limit_hits (prefix, key, hits, expires_at)
         VALUES ($1, $2, 1, now() + ($3::bigint || ' milliseconds')::interval)
       ON CONFLICT (prefix, key) DO UPDATE SET
         hits = CASE WHEN rate_limit_hits.expires_at < now() THEN 1
                     ELSE rate_limit_hits.hits + 1 END,
         expires_at = CASE WHEN rate_limit_hits.expires_at < now()
                     THEN now() + ($3::bigint || ' milliseconds')::interval
                     ELSE rate_limit_hits.expires_at END
       RETURNING hits, expires_at`,
      [this.prefix, key, this.windowMs],
    );
    return { totalHits: rows[0].hits, resetTime: new Date(rows[0].expires_at) };
  }

  async decrement(key) {
    await getPool().query(
      `UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0)
         WHERE prefix = $1 AND key = $2`,
      [this.prefix, key],
    );
  }

  async resetKey(key) {
    await getPool().query(
      `DELETE FROM rate_limit_hits WHERE prefix = $1 AND key = $2`,
      [this.prefix, key],
    );
  }

  async resetAll() {
    await getPool().query(`DELETE FROM rate_limit_hits WHERE prefix = $1`, [this.prefix]);
  }
}

/**
 * A shared-pool Postgres store for the given limiter prefix, or undefined when
 * persistence is not configured (express-rate-limit then uses its in-memory
 * default — unchanged behaviour).
 * @param {string} prefix
 */
function makeRateLimitStore(prefix) {
  if (!STORE_URL) return undefined;
  return new PostgresRateLimitStore(prefix);
}

/**
 * Prune rows whose window has expired. No-op (returns 0) when the persistent
 * store is disabled. increment() already resets an expired key in place, so this
 * is pure housekeeping to stop the table growing once the store is enabled — run
 * it from a low-frequency cron. Returns the number of rows deleted.
 */
async function cleanupExpired() {
  if (!STORE_URL) return 0;
  const { rowCount } = await getPool().query(
    `DELETE FROM rate_limit_hits WHERE expires_at < now()`,
  );
  return rowCount || 0;
}

module.exports = {
  makeRateLimitStore,
  cleanupExpired,
  PostgresRateLimitStore,
  // test-only
  _closePool: async () => { if (pool) { await pool.end(); pool = null; } },
};
