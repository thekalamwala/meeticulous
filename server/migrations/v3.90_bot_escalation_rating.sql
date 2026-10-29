-- v3.90_bot_escalation_rating.sql — post-handoff satisfaction rating.
-- Idempotent. Apply on BOTH DBs (prod ayjhlwyzszykqtnaktpb + staging xwvciqkayammbvsidqig).
-- After a support request is sent, the widget asks for a 1–5 emoji rating; stored here
-- and surfaced in the admin Escalations view. Additive, schema-fallback safe.

ALTER TABLE bot_escalations ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating BETWEEN 1 AND 5);
