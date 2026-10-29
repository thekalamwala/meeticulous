-- ============================================================
-- v3.110 — Lead expected deal value (pipeline value).
--
-- `revenue_paise` is REALIZED (from paid bookings/subs). This is the ESTIMATE a
-- salesperson sets for an open lead, so the pipeline can show expected value.
-- Minor units (paise), like revenue_paise.
--
-- Additive. Run staging (Tokyo) → prod (Mumbai).
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS expected_value_paise BIGINT NOT NULL DEFAULT 0;
