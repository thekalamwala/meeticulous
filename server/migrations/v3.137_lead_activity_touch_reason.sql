-- v3.137 — link a timeline activity to the relationship-touch reason that prompted it
-- (relationship engine PR-4).
--
-- When a human acts on a touch_recommendation, the resulting lead_activities row is
-- stamped with the rec's `reason` so the timeline reads "check-in (cooling)" rather
-- than a bare `whatsapp_sent`. The same write goes through logActivity, so acting a
-- rec via a real channel also stamps the meaningful-interaction clock (v3.133).
--
-- (lead_activities.is_meaningful was added in v3.133.) Additive + idempotent.
-- APPLIED 2026-08-30 on staging (xwvciqkayammbvsidqig) + prod (ayjhlwyzszykqtnaktpb)
-- via the Supabase MCP.

ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS touch_reason TEXT;
