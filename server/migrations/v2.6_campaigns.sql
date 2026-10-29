-- ============================================================
-- v2.6 — Campaign platform (Phase 1: contacts, segments, email campaigns)
-- Run in Supabase SQL Editor (or via Supabase MCP apply_migration).
-- Additive only; safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- 1. Contacts — one row per contactable, consented person (derived/synced)
CREATE TABLE IF NOT EXISTS contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT,
  phone               TEXT,
  name                TEXT,
  user_id             UUID,                         -- profiles.id if registered
  contact_type        TEXT NOT NULL DEFAULT 'guest',-- 'vendor' | 'guest' | 'buyer'
  email_opt_in        BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_opt_in     BOOLEAN NOT NULL DEFAULT TRUE,
  email_suppressed    BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  attributes          JSONB NOT NULL DEFAULT '{}',  -- plan, total_bookings, last_booking_at, city...
  source              TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  last_synced_at      TIMESTAMPTZ
);
-- Dedup key: one row per email. The sync service lowercases email before upsert
-- (case-insensitive dedup), so a plain unique index on (email) is a valid
-- ON CONFLICT (email) arbiter. Null/empty emails are never inserted in Phase 1
-- (email channel only). NOTE: a non-partial unique index is required so that
-- supabase-js .upsert({ onConflict: 'email' }) can use it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (contact_type);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;   -- service-role only (no public policy)

-- 2. Segments — saved filter over contacts
CREATE TABLE IF NOT EXISTS segments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  definition  JSONB NOT NULL DEFAULT '{}',  -- { contact_type?, filters:[{field,op,value}] }
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

-- 3. Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'email',
  segment_id      UUID REFERENCES segments(id),
  template_id     UUID REFERENCES email_templates(id),
  subject_override TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft',   -- draft|scheduled|sending|sent|paused|failed
  scheduled_at    TIMESTAMPTZ,
  throttle_per_min INTEGER NOT NULL DEFAULT 120,
  stats           JSONB NOT NULL DEFAULT '{}',     -- { total, queued, sent, failed, skipped }
  created_by      TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns (status);
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

-- 4. Per-recipient work queue (mirrors email_logs lifecycle)
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES contacts(id),
  channel      TEXT NOT NULL DEFAULT 'email',
  destination  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',     -- queued|sent|failed|skipped
  error        TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  email_log_id UUID,                               -- link to email_logs row
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_camp_recipients_campaign ON campaign_recipients (campaign_id, status);
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

-- 5. Tag email_logs rows that belong to a campaign
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS campaign_id UUID;
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON email_logs (campaign_id);

-- 6. Seed system segments (idempotent by name)
INSERT INTO segments (name, description, definition, is_system)
SELECT v.name, v.description, v.definition::jsonb, TRUE FROM (VALUES
  ('All vendors',        'Every host/vendor contact',                  '{"contact_type":"vendor"}'),
  ('Free-plan vendors',  'Vendors on the explorer (free) plan',        '{"contact_type":"vendor","filters":[{"field":"plan","op":"eq","value":"explorer"}]}'),
  ('All guests',         'Everyone who booked as a guest',             '{"contact_type":"guest"}'),
  ('All contacts',       'Every contactable person',                   '{}')
) AS v(name, description, definition)
WHERE NOT EXISTS (SELECT 1 FROM segments s WHERE s.name = v.name);
