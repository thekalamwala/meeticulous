-- v3.190 — Gifted Pro (complimentary Pro for a fixed tenure, from the team).
--
-- Plan: docs/superpowers/plans/2026-11-04-gifted-pro.md
--
-- A gift IS plain `premium` on the profile, with profiles.plan_expires_at = the
-- gift's ends_at, so every existing gate (planService.resolveVendorPlan, the
-- PR #134 palette, badges, limits from subscription_plans.limits) works with no
-- new slug. This table is the gift's own record: who granted it, for how long,
-- why, and how it closed. One active gift per host; extending moves ends_at on
-- the same row. Every grant/extend/revoke is also written to admin_audit_logs.
--
-- share_* (share-to-extend) and forward_* (pay-it-forward) ship now but stay
-- unused until PR C builds those flows.
--
-- Additive. RLS on with no policies = service-role only (same as platform_reviews).
-- Code is schema-fallback safe: planGiftService treats a missing table as
-- "no gifts" (admin routes return 503, the cron is a no-op).

CREATE TABLE IF NOT EXISTS plan_gifts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  months               int  NOT NULL CHECK (months IN (1, 2, 6, 12, 24, 60)),
  starts_at            timestamptz NOT NULL DEFAULT now(),
  ends_at              timestamptz NOT NULL,
  status               text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'ended', 'revoked', 'converted')),
  extended_months      int  NOT NULL DEFAULT 0 CHECK (extended_months >= 0),
  campaign             text CHECK (char_length(campaign) <= 60),
  reason               text NOT NULL CHECK (char_length(reason) <= 500),
  note                 text CHECK (char_length(note) <= 280),
  granted_by           uuid,
  closed_at            timestamptz,
  closed_by            uuid,
  close_reason         text,
  ending_notified_days int[] NOT NULL DEFAULT '{}',
  share_url            text,
  share_status         text CHECK (share_status IN ('pending', 'approved', 'rejected')),
  share_reviewed_at    timestamptz,
  forward_code         text UNIQUE,
  forward_redeemed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  forward_redeemed_at  timestamptz,
  forwarded_from       uuid REFERENCES plan_gifts(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_plan_gifts_active   ON plan_gifts (host_id) WHERE status = 'active';
CREATE INDEX        IF NOT EXISTS idx_plan_gifts_active_ends ON plan_gifts (ends_at) WHERE status = 'active';
CREATE INDEX        IF NOT EXISTS idx_plan_gifts_host        ON plan_gifts (host_id, created_at DESC);

ALTER TABLE plan_gifts ENABLE ROW LEVEL SECURITY;

-- Gift lifecycle notices: email + in-app on. WhatsApp stays OFF until the
-- AiSensy templates are approved (then set whatsapp_enabled + campaign_name).
-- Email copy ships in config/emailTemplates.js and is inserted by templateSync
-- on the next production boot (gift email from Shubham, the rest from Tithi).
INSERT INTO notification_events
  (event_key, display_name, email_enabled, whatsapp_enabled, in_app_enabled, is_active, email_subject)
VALUES
  ('PLAN_GIFT_RECEIVED', 'Gifted Pro received',    TRUE, FALSE, TRUE, TRUE, 'A gift from me: Meeticulous Pro'),
  ('PLAN_GIFT_ENDING',   'Gifted Pro ending soon', TRUE, FALSE, TRUE, TRUE, 'Your gifted Pro ends soon'),
  ('PLAN_GIFT_ENDED',    'Gifted Pro expired',     TRUE, FALSE, TRUE, TRUE, 'Your gifted Pro has expired')
ON CONFLICT (event_key) DO NOTHING;
