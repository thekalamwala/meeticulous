-- v3.136 — relationship touch recommendations queue (relationship engine PR-3).
--
-- The "who to talk to today" data behind the Relationship Desk. Each lifecycle tick
-- emits, per lead, the single most relevant relationship touch derived from its
-- health (v3.135) + account signals — first success, cooling, at-risk, dormant.
-- NOTHING is sent from here: `mode` (auto|recommend|human) + `priority` only say what
-- touch is appropriate and who should make it. Sends stay gated by crm_admin_sends.
--
-- One OPEN (or snoozed) rec per dedupe_key ('lead:<id>:<reason>') — re-emitting while
-- one stands is a no-op (partial unique index). The service also suppresses re-emit
-- for a cooldown after a human acts/dismisses, so the Desk never re-nags.
--
-- Service-role only (RLS enabled, NO policy) — reachable only via supabaseAdmin,
-- consistent with every other crm_*/lead_* table. Additive + idempotent.
-- APPLIED 2026-08-30 on staging (xwvciqkayammbvsidqig) + prod (ayjhlwyzszykqtnaktpb)
-- via the Supabase MCP.

CREATE TABLE IF NOT EXISTS touch_recommendations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type      TEXT NOT NULL DEFAULT 'lead',           -- 'lead' now; 'guest' post-MVP
  lead_id           UUID REFERENCES leads(id) ON DELETE CASCADE,
  reason            TEXT NOT NULL,                           -- 'first_success','cooling','at_risk',...
  touch_type        TEXT NOT NULL,                           -- 'appreciation','check_in','winback',...
  priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  suggested_channel TEXT,                                    -- 'whatsapp'|'email'|'call'|'personal'
  suggested_sender  TEXT,                                    -- 'owner'|'founder'|null
  mode              TEXT NOT NULL DEFAULT 'recommend' CHECK (mode IN ('auto','recommend','human')),
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','snoozed','done','dismissed','expired')),
  explanation       TEXT,
  dedupe_key        TEXT NOT NULL,
  due_at            TIMESTAMPTZ,
  snoozed_until     TIMESTAMPTZ,
  acted_by_admin_id UUID REFERENCES admin_users(id),
  acted_at          TIMESTAMPTZ,
  outcome           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_touch_rec_open
  ON touch_recommendations (dedupe_key) WHERE status IN ('open','snoozed');
CREATE INDEX IF NOT EXISTS idx_touch_rec_lead   ON touch_recommendations (lead_id);
CREATE INDEX IF NOT EXISTS idx_touch_rec_status ON touch_recommendations (status) WHERE status IN ('open','snoozed');

ALTER TABLE touch_recommendations ENABLE ROW LEVEL SECURITY;
