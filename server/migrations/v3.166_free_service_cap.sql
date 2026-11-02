-- ============================================================
-- v3.166 — Re-cap free (₹0) services on the Starter (free) plan
-- ------------------------------------------------------------
-- v3.165 set the free plan's `free_services` limit to -1 (unlimited) along with
-- everything else it made generous. That was a mistake: a ₹0 service earns the
-- platform NOTHING — 5% commission of ₹0 is ₹0, and platform_settings.fee_only_mode
-- is false in prod so a ₹0 service also carries no booking fee. Unlimited free
-- services therefore let a host run their entire business on our infrastructure
-- at zero revenue, forever, with no pressure to charge or upgrade.
--
-- The old Starter plan capped this at 2, deliberately: a free service is a
-- lead-gen teaser (a discovery call), not a way to operate for free. This
-- restores that floor. Everything else about the generous free tier stays —
-- unlimited PAID services and bookings are PRO-revenue (every paid booking is
-- 5% + the ₹10 fee), and the ₹100 minimum price on paid services already blocks
-- the "list at ₹1 to dodge fees" dodge. free_services is the one limit that
-- protects the floor, and it is the one v3.165 wrongly switched off.
--
-- Premium (Pro) keeps free_services = -1: those hosts already paid, so
-- unlimited free offerings cost us nothing we didn't collect up front.
--
-- Enforcement already exists (middleware/planMiddleware.js canAddFreeService),
-- and only blocks NEW free services and reactivations — existing active free
-- listings are grandfathered and keep working, so no host's live page changes.
--
-- APPLY TO BOTH DBs (Tokyo staging + Mumbai prod). Idempotent.
-- ============================================================

UPDATE subscription_plans
SET limits = jsonb_set(COALESCE(limits, '{}'::jsonb), '{free_services}', '2')
WHERE slug = 'free';

-- Verify
SELECT slug, limits->>'free_services' AS free_services, limits->>'services' AS services
FROM subscription_plans WHERE slug IN ('free', 'premium');
