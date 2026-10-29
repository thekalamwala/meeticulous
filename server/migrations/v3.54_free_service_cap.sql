-- v3.54 — Free-service sub-cap
--
-- Adds a `free_services` key to each subscription plan's `limits` JSON: the max
-- number of ACTIVE price-0 (free) services a host on that plan may list. This is
-- a sub-cap that sits INSIDE the existing total `services` cap — a free service
-- still counts toward `services` too.
--
--   starter (free tier) → 2   (founder decision 2026-06-29)
--   all paid tiers      → -1  (unlimited; still bounded by total `services`)
--
-- Enforced in planMiddleware.canAddFreeService across the create / activate /
-- price-edit paths (serviceController + hostController). -1 = unlimited; an
-- absent key defaults to unlimited in code, so this migration is what actually
-- turns the Starter cap on. Idempotent — safe to re-run on BOTH databases.

update subscription_plans
   set limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{free_services}', to_jsonb(2), true)
 where slug = 'starter';

update subscription_plans
   set limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{free_services}', to_jsonb(-1), true)
 where slug <> 'starter';
