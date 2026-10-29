-- v3.159 — Two-axis lead model, foundation (B1 of the lifecycle engine).
--
-- The pipeline axis already exists as `leads.status` (list→new→qualified→…).
-- This adds the SECOND axis — the last email's state — plus the engagement
-- counters the list-engagement threshold (B2: opens≥1 & clicks≥2 → promote to
-- 'new') will read. Set by the Resend/AiSensy webhook (webhookEvents).
--
--   email_status  last email event for the lead: sent/delivered/opened/clicked/bounced/complained.
--   opens/clicks  running counts, bumped per open/click event.
--
-- Additive; opens/clicks default 0 so existing rows are valid. Code has a schema
-- fallback (webhookEvents drops these keys on "column missing"), so it is safe to
-- deploy before this lands. Apply on BOTH DBs (staging Tokyo → prod Mumbai).

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_status TEXT,
  ADD COLUMN IF NOT EXISTS opens  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks INT NOT NULL DEFAULT 0;
