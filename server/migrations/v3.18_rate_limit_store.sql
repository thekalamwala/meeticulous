-- v3.18 — optional persistent store for express-rate-limit.
-- Run in Supabase SQL Editor (or via npm run migrate:*) ONLY if you set
-- RATE_LIMIT_STORE_URL to move rate limiting off in-memory (i.e. when running
-- more than one API instance). See server/middleware/rateLimitStore.js.
-- Idempotent.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  prefix      text        NOT NULL,
  key         text        NOT NULL,
  hits        integer     NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  PRIMARY KEY (prefix, key)
);

-- Lets a periodic cleanup prune expired rows cheaply (optional housekeeping;
-- increment() already resets an expired key in place, so this is not required
-- for correctness).
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_expires ON rate_limit_hits (expires_at);
