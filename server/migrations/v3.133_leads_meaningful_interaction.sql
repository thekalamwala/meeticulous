-- v3.133 — meaningful-human-interaction vs automated-touch clocks.
--
-- The Relationship & Touch Engine (PR-1) hinges on separating a real human
-- conversation from an automated send. Every CRM touch already flows through one
-- chokepoint — services/crm/activity.js `logActivity(leadId, type, {actorAdminId})`
-- — where `actorAdminId` is set for a human and null for the system. These columns
-- hold the rollup that classification produces.
--
--   last_meaningful_interaction_at  human-authored outbound / logged call
--   last_meaningful_channel         'whatsapp' | 'email' | 'call'
--   meaningful_interaction_count    running count of meaningful touches
--   last_automated_touch_at         automated CRM send (system, no actor)
--   lead_activities.is_meaningful   per-row classification (timeline + backfill agree)
--
-- Additive + idempotent. Apply on BOTH DBs (staging Tokyo FIRST, then prod Mumbai);
-- keep the code-side schema fallback in activity.js until confirmed on both.
-- APPLIED 2026-08-30 on staging (xwvciqkayammbvsidqig) + prod (ayjhlwyzszykqtnaktpb)
-- via the Supabase MCP as migration `v3_133_leads_meaningful_interaction`.
--
-- FILENAME-NUMBER COLLISION (cosmetic, like v3.130): main also carries
-- `v3.133_email_campaigns_composer.sql`. Both are applied and independent —
-- Supabase names migrations by their applied name, not the filename, so the shared
-- number is a display-only quirk, not an ordering dependency.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_meaningful_interaction_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_meaningful_channel        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meaningful_interaction_count   INT NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_automated_touch_at        TIMESTAMPTZ;

ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS is_meaningful BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_last_meaningful ON leads (last_meaningful_interaction_at);
