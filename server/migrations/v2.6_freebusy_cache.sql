-- v2.6 — Google FreeBusy last-good cache
-- One row per (host, calendar day). Lets availabilityService degrade to the
-- most recent known busy set during a Google outage instead of showing all
-- slots free. Safe to re-run.

CREATE TABLE IF NOT EXISTS google_freebusy_cache (
  host_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  busy       JSONB NOT NULL DEFAULT '[]',   -- [{ start: ISO, end: ISO }]
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (host_id, day)
);

-- Deny-all RLS: only the service role (server) ever touches this table.
ALTER TABLE google_freebusy_cache ENABLE ROW LEVEL SECURITY;
