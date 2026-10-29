-- v3.137 — Facebook Lead Ads: store Meta's leadgen id on the CRM lead.
--
-- Populated by controllers/metaLeadgenController when a Meta Lead Ad form is
-- submitted; later sent to Meta CAPI as the raw `lead_id` (utils/trackServer) so
-- CRM outcomes attribute back to the sourcing ad. Additive + schema-fallback safe
-- (leadService.stripOptional drops it until this runs). Apply on BOTH DBs.
--
-- text (not bigint): leadgen ids are large numeric strings and we never do math
-- on them — storing the exact string avoids any precision risk.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_lead_id text;

-- Fast lookup + de-dupe by leadgen id (partial: only rows that came from an ad).
CREATE INDEX IF NOT EXISTS leads_meta_lead_id_idx
  ON leads (meta_lead_id)
  WHERE meta_lead_id IS NOT NULL;
