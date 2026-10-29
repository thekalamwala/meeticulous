-- v3.135 — relationship health (a SEPARATE axis from the lead score).
--
-- Relationship health answers "is our relationship current & healthy, or going
-- quiet?" — its dominant term is time-since-MEANINGFUL-interaction (v3.133), so a
-- customer we never actually talk to visibly cools regardless of automated touches.
-- Computed each 15-min lifecycle tick by services/crm/relationshipHealth.js and
-- written by lifecycleEngine.writeHealth(); pure/deterministic, no AI.
--
--   health_state       thriving | steady | cooling | at_risk | dormant
--   health_score       0–100 backing score (for cheap Desk sorting)
--   health_signals     jsonb — top contributors, for explainability next to the state
--   health_computed_at last recompute time
--
-- No backfill: values populate on the next lifecycle tick (health_state is NULL
-- until then; the UI treats NULL as "not yet computed"). Additive + idempotent.
-- Keep the code-side schema fallback (lifecycleEngine.healthColumns) until confirmed
-- on both DBs. APPLIED 2026-08-30 on staging (xwvciqkayammbvsidqig) + prod
-- (ayjhlwyzszykqtnaktpb) via the Supabase MCP.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS health_state TEXT
  CHECK (health_state IN ('thriving','steady','cooling','at_risk','dormant'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS health_score INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS health_signals JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS health_computed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_health_state ON leads (health_state)
  WHERE status NOT IN ('lost','do_not_contact');
