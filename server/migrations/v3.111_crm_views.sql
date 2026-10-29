-- ============================================================
-- v3.111 — CRM saved views (shared, team-wide).
--
-- A saved view freezes a lens over the leads database: view type
-- (table|board|list) + filters (smart view, stage, source, tag, search).
-- Shared across the team (no owner) — one-click "Follow up today", "Hot
-- leads", "Inaugurators", etc. Kept separate from marketing `segments`
-- (which describe contact audiences, not lead-list config).
--
-- Additive, RLS-on/service-role-only. Run staging (Tokyo) → prod (Mumbai).
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  definition  JSONB NOT NULL DEFAULT '{}',  -- { viewType, filters:{ smartView, stage, source, tag, q } }
  created_by  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_views_name ON crm_views (lower(name));
ALTER TABLE crm_views ENABLE ROW LEVEL SECURITY;
