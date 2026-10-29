-- v3.125 — Sales CRM: a lead's stated plan interest, set by an admin on the lead
-- panel's "About this lead" card. Additive and nullable; NULL renders as "—".
-- Values are the fixed dropdown keys (Host+/Studio monthly/yearly + Enterprise).
-- Code keeps a schema fallback (adminCrmController.updateLead strips the column on
-- "column not found") until this is confirmed applied on BOTH DBs.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS plan_interest text;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_plan_interest_chk;
ALTER TABLE leads ADD CONSTRAINT leads_plan_interest_chk
  CHECK (plan_interest IS NULL OR plan_interest IN
    ('hostplus_monthly', 'hostplus_yearly', 'studio_monthly', 'studio_yearly', 'enterprise'));
