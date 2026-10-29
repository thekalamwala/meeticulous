-- v3.117 — Contact-reason taxonomy capture.
--
-- Stamps WHY a conversation happened when it's resolved/closed, so support turns
-- into product intelligence (top reasons, product-caused rate). Codes come from
-- server/config/supportReasons.js. Both stores get the column so the insights
-- report can aggregate the human inbox AND the Bolt-widget escalations together.
--
-- Additive + nullable → schema-fallback safe: reason_code is written via a
-- best-effort update that no-ops if the column isn't there yet, so resolving a
-- conversation never breaks before this runs.
--
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo).

ALTER TABLE support_threads  ADD COLUMN IF NOT EXISTS reason_code TEXT;
ALTER TABLE bot_escalations  ADD COLUMN IF NOT EXISTS reason_code TEXT;
