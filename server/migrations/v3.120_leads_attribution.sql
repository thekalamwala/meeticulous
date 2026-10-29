-- v3.120 — marketing attribution on leads (CRM audit Phase 2b)
-- Additive & idempotent. Captures where a lead came from so "which source /
-- campaign produced paying customers" becomes answerable. Flat utm_* columns are
-- the reportable dimensions; first_touch/last_touch jsonb keep the full snapshot
-- (utm + referrer + landing_page + timestamp) for first- vs last-touch analysis.
-- Server code (leadService.upsertLead) carries a schema fallback, so it is safe
-- to deploy this migration before OR after the code on either DB.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content  text,
  ADD COLUMN IF NOT EXISTS utm_term     text,
  ADD COLUMN IF NOT EXISTS referrer     text,
  ADD COLUMN IF NOT EXISTS landing_page text,
  ADD COLUMN IF NOT EXISTS first_touch  jsonb,
  ADD COLUMN IF NOT EXISTS last_touch   jsonb;

-- Partial indexes for the two dimensions reporting will group by most.
CREATE INDEX IF NOT EXISTS idx_leads_utm_source
  ON public.leads (utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign
  ON public.leads (utm_campaign) WHERE utm_campaign IS NOT NULL;
