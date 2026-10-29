-- ============================================================
-- v2.3 — Email Communication Engine (applied live via MCP 2026-06-10)
--
--   email_settings   single-row provider + brand/layout config
--   email_templates  DB-stored templates (body only; layout adds header/footer)
--                    keyed by (event_key, audience); one ACTIVE per pair
--   email_logs       backs BOTH the queue (status=queued) and the delivery log
--
-- Templates are seeded by server/config/emailTemplates.js via
-- `node scripts/seedEmailTemplates.js` (idempotent upsert by event_key+audience).
-- ============================================================

CREATE TABLE IF NOT EXISTS email_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  provider      TEXT NOT NULL DEFAULT 'smtp',
  from_name     TEXT NOT NULL DEFAULT 'Book A Sloth',
  from_email    TEXT DEFAULT '',
  support_email TEXT NOT NULL DEFAULT 'support@bookasloth.in',
  website_url   TEXT NOT NULL DEFAULT 'https://bookasloth.in',
  logo_url      TEXT DEFAULT '',
  brand_color   TEXT NOT NULL DEFAULT '#FE5100',
  footer_html   TEXT DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT email_settings_singleton CHECK (id = 1)
);
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO email_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key     TEXT NOT NULL,
  audience      TEXT NOT NULL DEFAULT 'all',
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Booking',
  subject       TEXT NOT NULL DEFAULT '',
  preview_text  TEXT DEFAULT '',
  html_content  TEXT NOT NULL DEFAULT '',
  cta_label     TEXT DEFAULT '',
  cta_url       TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_template_active
  ON email_templates (event_key, audience) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_email_templates_event ON email_templates (event_key);
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS email_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key         TEXT NOT NULL,
  template_id       UUID,
  audience          TEXT DEFAULT 'all',
  recipient         TEXT NOT NULL,
  recipient_user_id UUID,
  booking_id        UUID,
  subject           TEXT DEFAULT '',
  html              TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'queued',
  provider          TEXT DEFAULT '',
  provider_response JSONB DEFAULT '{}',
  error             TEXT,
  attempts          INTEGER NOT NULL DEFAULT 0,
  next_attempt_at   TIMESTAMPTZ DEFAULT now(),
  is_test           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  sent_at           TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_queue     ON email_logs (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_created   ON email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs (recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_booking   ON email_logs (booking_id);
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
