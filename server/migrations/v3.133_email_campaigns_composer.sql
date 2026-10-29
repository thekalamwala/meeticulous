-- v3.133 — Custom email composer fields on email_campaigns.
--
-- The admin campaigns builder gains a visual composer: instead of only picking a
-- pre-made email_templates row, an admin composes a one-off email (block model)
-- that compiles to email-safe HTML sent as a named sender (default: Shubham,
-- Founder). These columns hold that composed campaign; template-based campaigns
-- keep working unchanged (template_id path untouched).
--
--   audience_type  'segment' | 'manual' | 'single' — how recipients are chosen.
--                  Existing rows default to 'segment' (current behaviour).
--   audience_ref   for manual/single: the picked contact ids / emails.
--   design_json    the composer block model (source of truth for editing).
--   html_content   compiled, chrome-less body HTML (the shell is wrapped per
--                  recipient at send time so the unsubscribe token stays correct).
--   subject        composed subject (template path still uses the template's).
--   preview_text   inbox preheader.
--   sender_key     email_senders key the send is from (default 'shubham').
--
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo). All additive + nullable.
-- campaignService / communicationEngine keep schema-safe fallbacks (a SELECT of
-- sender_key that errors pre-migration falls back to the global sender), so
-- nothing breaks until this runs.

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS audience_type TEXT DEFAULT 'segment',
  ADD COLUMN IF NOT EXISTS audience_ref  JSONB,
  ADD COLUMN IF NOT EXISTS design_json   JSONB,
  ADD COLUMN IF NOT EXISTS html_content  TEXT,
  ADD COLUMN IF NOT EXISTS subject       TEXT,
  ADD COLUMN IF NOT EXISTS preview_text  TEXT,
  ADD COLUMN IF NOT EXISTS sender_key    TEXT DEFAULT 'shubham';
