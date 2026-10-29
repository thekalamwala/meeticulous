-- v3.20_vendor_feedback.sql
-- Vendor → platform feedback. Unified schema: P1 widget submissions; P2 surveys
-- reuse the same table (source='survey', survey_id, rating); P3 roadmap reuses
-- the dormant vote_count/is_public columns. All access is server-side via the
-- service-role client, so RLS is enabled with NO client policies (deny direct
-- anon/authenticated key access; service role bypasses RLS).

CREATE TABLE IF NOT EXISTS feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source        text NOT NULL DEFAULT 'widget' CHECK (source IN ('widget','survey')),
  type          text NOT NULL CHECK (type IN ('idea','bug','complaint','praise','other')),
  area          text CHECK (area IN ('booking','payments','dashboard','profile','availability','other')),
  rating        int  CHECK (rating BETWEEN 0 AND 10),
  subject       text,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','planned','shipped','declined')),
  admin_note    text,
  admin_response text,
  screenshot_url text,
  context       jsonb,
  vote_count    int NOT NULL DEFAULT 0,      -- dormant (P3)
  is_public     boolean NOT NULL DEFAULT false, -- dormant (P3)
  survey_id     uuid,                         -- P2 link; FK added in P2 migration
  handled_by    uuid,
  handled_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_vendor ON feedback (vendor_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback (source);
CREATE INDEX IF NOT EXISTS idx_feedback_type   ON feedback (type);

-- Server-only access (service role bypasses RLS; no client-key policies).
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Vendor-facing loop-close notification. Email on; WhatsApp off (disabled
-- platform-wide). campaign_name blank — admin can wire AiSensy later.
INSERT INTO notification_events
  (event_key, display_name, whatsapp_enabled, email_enabled, campaign_name, email_subject)
VALUES
  ('FEEDBACK_STATUS_CHANGED', 'Vendor Feedback Status Update', false, true, '', NULL)
ON CONFLICT (event_key) DO NOTHING;
