-- ============================================================
-- v3.167 — Give the free Sloth plan a capped Client CRM (last 10 clients)
-- ------------------------------------------------------------
-- The free plan previously had limits.crm = 0, which requireCrm treats as a hard
-- block: free hosts saw NO CRM at all. The two-plan model instead gives free hosts
-- a taste of the CRM — their 10 most recent clients — so they feel the value before
-- upgrading to Sloth Active for the full, unlimited history.
--
-- Semantics of limits.crm (planService / planMiddleware.requireCrm):
--   -1        = full / unlimited  (Sloth Active + legacy paid tiers)
--   positive  = a capped VIEW; free = 10 most-recent, enforced in
--               crmService.listClients (covers the list AND the CSV export)
--   0 / absent = fully blocked
--
-- This is a monetization cap on the host's OWN customers, not a privacy boundary.
-- Premium stays -1. Idempotent. APPLY TO BOTH DBs (Tokyo staging + Mumbai prod).
-- ============================================================

UPDATE subscription_plans
SET limits = jsonb_set(COALESCE(limits, '{}'::jsonb), '{crm}', '10')
WHERE slug = 'free';

-- Verify
SELECT slug, limits->>'crm' AS crm, limits->>'free_services' AS free_services
FROM subscription_plans WHERE slug IN ('free', 'premium');
