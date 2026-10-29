-- v3.69_ai_listing_generations.sql — usage log for "Write with Bolt" AI listing autofill.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
-- Server-only (service_role bypasses RLS). RLS is ENABLED with no policies so the
-- anon/authenticated PostgREST roles are denied — Supabase grants them SELECT on new
-- public tables by default, which would otherwise expose host_id/session_id rows.

CREATE TABLE IF NOT EXISTS ai_listing_generations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL,                       -- groups a generate + its regenerations
  service_id  UUID REFERENCES services(id) ON DELETE SET NULL,
  plan_slug   TEXT NOT NULL,                        -- plan at time of use (audit)
  model       TEXT NOT NULL,                        -- 'haiku' | 'sonnet'
  kind        TEXT NOT NULL DEFAULT 'generate' CHECK (kind IN ('generate','regenerate')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast quota-window counts per host (only generate rows consume quota).
CREATE INDEX IF NOT EXISTS ai_gen_host_created_idx
  ON ai_listing_generations (host_id, created_at DESC);

-- Lock out client roles. RLS with zero policies = deny-all for anon/authenticated;
-- the server's service_role bypasses RLS. Revoke the default grants too (defence in depth).
ALTER TABLE ai_listing_generations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_listing_generations FROM anon, authenticated;
