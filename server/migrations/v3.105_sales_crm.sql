-- ============================================================
-- v3.105 — Sales CRM (Admin Command Center, Phase 1: schema)
-- Run on STAGING (Tokyo xwvciqkayammbvsidqig) first, verify, then
-- PROD (Mumbai ayjhlwyzszykqtnaktpb). Apply via Supabase SQL Editor
-- or MCP apply_migration.
--
-- Additive only; safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- All tables: RLS ENABLED, NO policy → service-role (supabaseAdmin) only.
--
-- Design notes:
--  * `leads` is the CRM source-of-truth. It LINKS to the existing
--    `contacts` table (v2.6) via contact_id for actual WA/email delivery —
--    we reuse the campaign/send/opt-out engines, never duplicate them.
--  * `leads.profile_id` links a lead back to profiles once matched/converted,
--    enabling revenue attribution against bookings.host_id.
--  * Tags are a text[] column with a GIN index (covers add/remove/filter and
--    bulk tag ops). A normalized tag catalog is deferred until rename/analytics
--    is actually needed.
--  * `crm_messages` is BOTH the CRM send-record (source of truth) AND the send
--    work-queue — status='queued' rows are the worklist a worker drains, the
--    same lifecycle pattern as email_logs. No separate queue table.
-- ============================================================

-- Trigram search over lead name/business/email/phone (fast ILIKE).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- 1. leads — CRM system of record
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        UUID REFERENCES contacts(id),   -- link for reuse of send engines (nullable until first send)
  profile_id        UUID REFERENCES profiles(id),   -- set when lead maps to a registered user (attribution)

  -- Identity / contact
  name              TEXT,
  phone             TEXT,                            -- primary dedup key; normalized (see backfill)
  whatsapp_phone    TEXT,                            -- may differ from primary phone
  email             TEXT,

  -- Business context
  business_name     TEXT,
  website           TEXT,
  instagram         TEXT,
  linkedin          TEXT,
  city              TEXT,
  profession        TEXT,                            -- maps to profiles.profession / primary_category

  -- Pipeline
  source            TEXT NOT NULL DEFAULT 'manual',  -- instagram|facebook|google|linkedin|website|referral|whatsapp|cold_outreach|event|manual|import|host_signup|guest_booking
  status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN (
                        'new','contacted','replied','qualified','demo_scheduled',
                        'trial','activated','paid','lost','do_not_contact')),
  owner_admin_id    UUID REFERENCES admin_users(id),
  do_not_contact    BOOLEAN NOT NULL DEFAULT FALSE,  -- hard send-gate (mirrors status do_not_contact)
  lost_reason       TEXT,

  -- Attribution (refreshed from bookings/subscriptions by the attribution job)
  revenue_paise     BIGINT NOT NULL DEFAULT 0,       -- attributed paid revenue, minor units
  converted_at      TIMESTAMPTZ,                      -- first paid booking / activation

  -- Denormalized activity stamps (kept fresh by app on write)
  last_contacted_at TIMESTAMPTZ,
  last_activity_at  TIMESTAMPTZ,

  tags              TEXT[] NOT NULL DEFAULT '{}',
  attributes        JSONB  NOT NULL DEFAULT '{}',    -- overflow: extra imported columns, utm, etc.
  created_by        TEXT   DEFAULT '',               -- admin id | 'backfill' | 'import'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup: phone is the primary arbiter (identity in this product). Backfill/sync
-- upserts ON CONFLICT (phone). Email-only leads (e.g. CSV import with no phone)
-- dedup on email instead. The two partial uniques cover non-overlapping domains.
-- ponytail: phone-first dedup; a person with both a phone lead and a later
-- email-only lead won't merge — add a merge tool if that collision shows up.
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_phone
  ON leads (phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_email_only
  ON leads (email) WHERE email IS NOT NULL AND email <> '' AND (phone IS NULL OR phone = '');

CREATE INDEX IF NOT EXISTS idx_leads_status        ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_owner         ON leads (owner_admin_id);
CREATE INDEX IF NOT EXISTS idx_leads_source        ON leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_created       ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_last_activity ON leads (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_profile       ON leads (profile_id);
CREATE INDEX IF NOT EXISTS idx_leads_tags_gin      ON leads USING gin (tags);

-- Fast global search (name / business / email / phone).
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm     ON leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_business_trgm ON leads USING gin (business_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm    ON leads USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm    ON leads USING gin (phone gin_trgm_ops);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. lead_notes — free-text internal notes (surface in timeline)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_admin_id  UUID REFERENCES admin_users(id),
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes (lead_id, created_at DESC);
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. lead_activities — the unified CRM timeline (CRM-native events).
--    Read side UNIONs this with notification_logs + email_logs
--    (matched by lead phone/email) for a complete history.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,   -- lead_created|status_changed|note_added|tag_added|tag_removed|
                                   -- owner_assigned|call_logged|follow_up_created|follow_up_completed|
                                   -- whatsapp_sent|email_sent|whatsapp_reply|email_opened|email_clicked|
                                   -- booking_created|account_created|subscription_purchased|converted|
                                   -- imported|sequence_enrolled|sequence_stopped
  actor_admin_id  UUID REFERENCES admin_users(id),  -- null = system/automation
  title           TEXT,
  body            TEXT,
  meta            JSONB NOT NULL DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities (lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON lead_activities (type);
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4. lead_follow_ups — sales tasks/reminders (owner-facing).
--    Distinct from scheduled_followups (that is booking-nudge drip).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  owner_admin_id  UUID REFERENCES admin_users(id),
  title           TEXT NOT NULL,
  due_at          TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','done','cancelled')),
  remind          BOOLEAN NOT NULL DEFAULT TRUE,   -- ping owner via email/WA when due
  reminded_at     TIMESTAMPTZ,                      -- guard against duplicate reminders
  completed_at    TIMESTAMPTZ,
  created_by      TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_followups_due
  ON lead_follow_ups (due_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_lead_followups_owner
  ON lead_follow_ups (owner_admin_id, due_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead ON lead_follow_ups (lead_id);
ALTER TABLE lead_follow_ups ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 5. crm_messages — CRM outbound send record + work-queue (source of truth).
--    status='queued' rows are the worklist; the CRM send worker drains them
--    through WhatsAppService/EmailService (which wrap AiSensy/Resend), applies
--    the DNC + kill-switch gate, and updates status. Idempotency key prevents
--    duplicate sends on retry.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES contacts(id),
  channel             TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  direction           TEXT NOT NULL DEFAULT 'outbound'
                        CHECK (direction IN ('outbound','inbound')),
  template_key        TEXT,            -- email event_key OR AiSensy approved campaign/template name
  subject             TEXT,            -- email only
  body_preview        TEXT,            -- rendered snippet for the timeline
  variables           JSONB NOT NULL DEFAULT '{}',
  provider            TEXT,            -- aisensy|resend|smtp
  provider_message_id TEXT,
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','processing','sent','delivered','read','failed','bounced','skipped')),
  error               TEXT,
  attempts            INTEGER NOT NULL DEFAULT 0,
  next_attempt_at     TIMESTAMPTZ,
  campaign_id         UUID,            -- links to email_campaigns(id) when part of a campaign
  sequence_id         UUID,            -- links to crm_sequences(id) when sent by a sequence
  enrollment_id       UUID,            -- links to crm_sequence_enrollments(id)
  idempotency_key     TEXT,            -- unique; prevents double-send
  queued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  created_by          TEXT DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_messages_idem
  ON crm_messages (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_messages_worklist
  ON crm_messages (next_attempt_at) WHERE status IN ('queued','processing');
CREATE INDEX IF NOT EXISTS idx_crm_messages_lead ON crm_messages (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_messages_provider
  ON crm_messages (provider, provider_message_id);  -- webhook status lookup (Phase 4)
ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 6. crm_message_events — normalized provider delivery events (Phase 4 webhooks).
--    Table added now; webhook ingestion wired later.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_message_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    UUID NOT NULL REFERENCES crm_messages(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,   -- sent|delivered|read|opened|clicked|bounced|failed|replied|complained
  payload       JSONB NOT NULL DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_message_events_msg ON crm_message_events (message_id, occurred_at);
ALTER TABLE crm_message_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 7-9. Sequences (lightweight drip). Engine wired in the backend PR,
--      gated by the CRM send kill-switch (default OFF) so nothing fires
--      until explicitly enabled.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_sequences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  stop_on_reply    BOOLEAN NOT NULL DEFAULT TRUE,
  stop_on_convert  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       TEXT DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE crm_sequences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS crm_sequence_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   UUID NOT NULL REFERENCES crm_sequences(id) ON DELETE CASCADE,
  step_no       INTEGER NOT NULL,
  delay_hours   INTEGER NOT NULL DEFAULT 0,   -- delay after prior step (step 1: after enrollment)
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  template_key  TEXT,                          -- email event_key OR AiSensy approved template
  subject       TEXT,
  body          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_seq_steps ON crm_sequence_steps (sequence_id, step_no);
ALTER TABLE crm_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS crm_sequence_enrollments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id    UUID NOT NULL REFERENCES crm_sequences(id) ON DELETE CASCADE,
  lead_id        UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','completed','stopped')),
  current_step   INTEGER NOT NULL DEFAULT 0,   -- last completed step
  next_run_at    TIMESTAMPTZ,                   -- when the next step is due
  stopped_reason TEXT,                          -- replied|converted|dnc|manual|unsubscribed
  enrolled_by    TEXT DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_seq_enroll ON crm_sequence_enrollments (sequence_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_seq_enroll_due
  ON crm_sequence_enrollments (next_run_at) WHERE status = 'active';
ALTER TABLE crm_sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- End v3.105
-- ============================================================
