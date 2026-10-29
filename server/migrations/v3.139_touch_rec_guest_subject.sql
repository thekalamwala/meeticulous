-- v3.139 — guest subject on touch_recommendations + contact touch clocks.
-- (Relationship engine PR-9: extend the Relationship Desk to GUESTS via contacts —
-- NOT a parallel pipeline. The pure relationshipHealth / relationshipTouch functions
-- and the ONE touch governor operate on a guest exactly as on a lead; only the
-- subject's identity + clocks come from contacts instead of leads.)
--
-- Additive + idempotent. Apply on BOTH DBs (staging Tokyo xwvciqkayammbvsidqig FIRST,
-- then prod Mumbai ayjhlwyzszykqtnaktpb) via Supabase MCP. Keep the code-side schema
-- fallback (destructure/degrade on missing column) until confirmed applied everywhere.
--
-- touch_recommendations already carries subject_type ('lead' | 'guest') with a NULLABLE
-- lead_id (v3.136 anticipated this: "'guest' post-MVP"). A guest rec sets
-- subject_type='guest' + contact_id and leaves lead_id null; its dedupe_key is
-- 'contact:<id>:<reason>', which is globally distinct from a lead's 'lead:<id>:<reason>',
-- so the existing partial unique index uq_touch_rec_open (dedupe_key WHERE status IN
-- open/snoozed) already dedupes both subject types with no change.

ALTER TABLE touch_recommendations
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_touch_rec_contact ON touch_recommendations (contact_id);

-- contacts gets the same touch-clock columns leads got in v3.133, so a guest's
-- relationship clock (last human contact), machine clock (last automated touch), and
-- last-activity read identically to a lead's. Additive; RLS unchanged (service-role only).
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_meaningful_interaction_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_meaningful_channel        TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS meaningful_interaction_count   INT NOT NULL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_automated_touch_at        TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_activity_at               TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contacts_last_meaningful ON contacts (last_meaningful_interaction_at);

-- Relationship health for a guest (mirrors leads' v3.135), so the guest engine can
-- persist it and the Relationship Desk can rank + show a guest's health chip the same
-- way it does a lead's.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS health_state TEXT
  CHECK (health_state IN ('thriving','steady','cooling','at_risk','dormant'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS health_score       INT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS health_signals     JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS health_computed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contacts_health_state ON contacts (health_state) WHERE health_state IS NOT NULL;
