-- ============================================================
-- v3.112 — Persisted lead score / intent / next action.
--
-- The lead score was computed only in the browser (client salesConstants.js
-- leadScore) for a badge — never stored, so it couldn't be sorted, queried, or
-- used to trigger anything server-side. These columns let the CRM lifecycle
-- engine (P0-4) persist the deterministic score + derived intent + the
-- recommended next action, which the Sales Desk and handoff rules read.
--
-- Additive, RLS unchanged (leads is service-role only). Run staging (Tokyo) →
-- prod (Mumbai). Code keeps a schema fallback until confirmed on both DBs:
-- the client computes the score locally when `score` is absent/zero, and the
-- engine no-ops the writeback if the columns are missing.
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INT NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'low'
  CHECK (intent IN ('low', 'medium', 'high', 'activated'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ;

-- Sales Desk "high intent" queue: still-open leads ranked by intent.
CREATE INDEX IF NOT EXISTS idx_leads_intent
  ON leads (intent) WHERE status NOT IN ('lost', 'do_not_contact', 'paid');
-- Sort/scan by score.
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads (score DESC);
