-- ============================================================
-- v3.114 — lead_events: an in-DB sink for identified intent signals.
--
-- Top-of-funnel behavioural events (pricing viewed, demo requested, signup
-- started, …) live only in PostHog cloud today, so the deterministic lead score
-- is blind to them. This append-only table captures the events that carry an
-- IDENTIFIER (email/phone) so they can be attributed to a lead and feed the
-- score. Anonymous events (no identifier) can't attribute to a person and are
-- out of scope — that identity-resolution job stays with PostHog.
--
-- Additive, RLS-on / no-policy / service-role only. Run staging → prod.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT NOT NULL,                 -- allow-listed slug (see intentEvents.js)
  email       TEXT,                          -- normalized lowercase, nullable
  phone       TEXT,                          -- normalized, nullable
  lead_id     UUID REFERENCES leads(id) ON DELETE SET NULL,  -- set when attributed
  meta        JSONB NOT NULL DEFAULT '{}',
  source      TEXT NOT NULL DEFAULT 'web',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_email ON lead_events (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_events_phone ON lead_events (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_events_lead  ON lead_events (lead_id) WHERE lead_id IS NOT NULL;
-- Backfill scan: unattributed events by identifier.
CREATE INDEX IF NOT EXISTS idx_lead_events_unattr ON lead_events (email, phone) WHERE lead_id IS NULL;

ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;
