-- ============================================================
-- v3.127 — Admin CRM team (P3 cross-board handoffs)
-- Run on STAGING (Tokyo xwvciqkayammbvsidqig) first, verify, then
-- PROD (Mumbai ayjhlwyzszykqtnaktpb). Additive + idempotent.
--
-- Tags each admin with the CRM pipeline team they belong to. When a lead crosses
-- INTO Relations (first payment) or Marketing (reaches the ROI milestone), handoffService
-- reassigns it to the least-loaded active member of the receiving team, opens an
-- SLA follow-up, and records the handoff on the lead timeline.
--
-- NULL = not on a CRM team (the handoff simply logs + opens the SLA with the
-- existing owner when a team has no members — code is best-effort).
-- ============================================================

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS crm_team TEXT;

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_crm_team_chk;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_crm_team_chk
  CHECK (crm_team IS NULL OR crm_team IN ('sales', 'relations', 'marketing'));

CREATE INDEX IF NOT EXISTS idx_admin_users_crm_team
  ON admin_users (crm_team) WHERE crm_team IS NOT NULL;

-- ============================================================
-- End v3.127
-- ============================================================
