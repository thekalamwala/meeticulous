-- v3.187 — email_templates.seed_hash (auto-sync of template copy on deploy)
--
-- services/email/templateSync.js runs on every production boot and pushes the
-- copy in config/emailTemplates.js into email_templates. seed_hash = sha256 of
-- the content the sync last wrote, so it can tell "untouched since our last
-- write" (safe to update) from "edited in the admin editor" (keep).
--
-- Additive + nullable. NULL = never tracked: the first sync stamps rows whose
-- content already matches the code and leaves any differing row alone.
-- Code is schema-fallback safe: without this column the sync skips entirely.

ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS seed_hash text;

COMMENT ON COLUMN email_templates.seed_hash IS
  'sha256 of the template content last written by templateSync (config/emailTemplates.js). Differs from the row content = edited in admin; sync keeps it.';
