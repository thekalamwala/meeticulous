-- ============================================================
-- v3.195 — Festival / calendar-day greetings (Humanity track, PR-6)
-- ------------------------------------------------------------
-- Opens the Humanity track from docs/email-journey-map.md.
--
-- Three parts:
--   1) calendar_events table — (date, event_key, audience_filter, enabled).
--      Daily cron (services/festivalGreetings.js) reads today's rows and
--      fires the NotificationEngine event for each. Future years can be
--      added by seed script without a code change.
--
--   2) 13 notification_events rows — all Shubham, email ON, WhatsApp OFF,
--      is_active ON. The Shubham sender holds the Founder voice; copy is
--      authored with the shubham-voice skill (see email-playbook.md).
--
--   3) feature_flag `festival_nudges` seeded OFF — master switch.
--
-- Profession-day greetings (Teachers' Day, Mental Health Day, Yoga Day)
-- carry audience_filter='profession:<slug>' so they only reach hosts whose
-- profession matches. Everything else is 'all'. The service enforces the
-- filter at send time — no SQL join yet.
--
-- Nothing sends until the master flag is flipped on.
--
-- Dates seeded: 2026-11-10 through 2027-12-31. Add further years by
-- running scripts/seedCalendarEvents.js (future).
--
-- Additive. Idempotent. Apply to the Meeticulous DB (spquowzrefozmrzoszkf).
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date             date        NOT NULL,
  event_key        text        NOT NULL,
  audience_filter  text        NOT NULL DEFAULT 'all',
  enabled          boolean     NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, event_key)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date_enabled
  ON calendar_events (date) WHERE enabled = true;

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
-- service_role only; no policies.

-- ────────────────────────────────────────────────────────────
-- Notification events (13)
-- ────────────────────────────────────────────────────────────
INSERT INTO notification_events
  (event_key, display_name, campaign_name, email_subject,
   whatsapp_enabled, email_enabled, in_app_enabled, is_active)
VALUES
  ('GREETING_DIWALI',             'Greeting — Diwali',             NULL, 'Diwali mubarak, {{first_name}}',          false, true, false, true),
  ('GREETING_HOLI',               'Greeting — Holi',               NULL, 'Happy Holi, {{first_name}}',              false, true, false, true),
  ('GREETING_EID',                'Greeting — Eid',                NULL, 'Eid mubarak, {{first_name}}',             false, true, false, true),
  ('GREETING_CHRISTMAS',          'Greeting — Christmas',          NULL, 'Merry Christmas, {{first_name}}',         false, true, false, true),
  ('GREETING_NEWYEAR',            'Greeting — New Year',           NULL, 'A new year, {{first_name}}',              false, true, false, true),
  ('GREETING_PONGAL_SANKRANTI',   'Greeting — Pongal / Sankranti', NULL, 'Happy Pongal, {{first_name}}',            false, true, false, true),
  ('GREETING_ONAM',               'Greeting — Onam',               NULL, 'Happy Onam, {{first_name}}',              false, true, false, true),
  ('GREETING_INDEPENDENCE_DAY',   'Greeting — Independence Day',   NULL, 'On this day, a quick note',               false, true, false, true),
  ('GREETING_REPUBLIC_DAY',       'Greeting — Republic Day',       NULL, 'On this day, a quick note',               false, true, false, true),
  ('GREETING_TEACHERS_DAY',       'Greeting — Teachers'' Day',     NULL, 'Thank you, {{first_name}}',               false, true, false, true),
  ('GREETING_MENTAL_HEALTH_DAY',  'Greeting — Mental Health Day',  NULL, 'A note on the work you do',               false, true, false, true),
  ('GREETING_YOGA_DAY',           'Greeting — Yoga Day',           NULL, 'Happy International Yoga Day',            false, true, false, true),
  ('GREETING_WOMENS_DAY',         'Greeting — Women''s Day',       NULL, 'A note, {{first_name}}',                  false, true, false, true)
ON CONFLICT (event_key) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  email_subject = EXCLUDED.email_subject,
  updated_at    = now();

-- ────────────────────────────────────────────────────────────
-- Calendar seed — today's date forward through 2027-12-31.
-- Diwali 2027 date confirmed via calendar; others are fixed-date.
-- ────────────────────────────────────────────────────────────
INSERT INTO calendar_events (date, event_key, audience_filter, notes) VALUES
  -- 2026 remaining
  ('2026-12-25', 'GREETING_CHRISTMAS',          'all',                   'Christmas 2026'),

  -- 2027
  ('2027-01-01', 'GREETING_NEWYEAR',            'all',                   'New Year 2027'),
  ('2027-01-14', 'GREETING_PONGAL_SANKRANTI',   'all',                   'Pongal / Makar Sankranti 2027'),
  ('2027-01-26', 'GREETING_REPUBLIC_DAY',       'all',                   'Republic Day 2027'),
  ('2027-03-08', 'GREETING_WOMENS_DAY',         'all',                   'International Women''s Day 2027'),
  ('2027-03-22', 'GREETING_HOLI',               'all',                   'Holi 2027'),
  ('2027-03-21', 'GREETING_EID',                'all',                   'Eid-ul-Fitr 2027 (approx)'),
  ('2027-05-28', 'GREETING_EID',                'all',                   'Eid-ul-Adha 2027 (approx)'),
  ('2027-06-21', 'GREETING_YOGA_DAY',           'profession:yoga',       'International Yoga Day 2027'),
  ('2027-08-15', 'GREETING_INDEPENDENCE_DAY',   'all',                   'Independence Day 2027'),
  ('2027-09-03', 'GREETING_ONAM',               'all',                   'Onam 2027 (Thiru Onam, approx)'),
  ('2027-09-05', 'GREETING_TEACHERS_DAY',       'profession:coach,mentor,teacher', 'Teachers'' Day 2027'),
  ('2027-10-10', 'GREETING_MENTAL_HEALTH_DAY',  'profession:therapist,counsellor',  'World Mental Health Day 2027'),
  ('2027-10-28', 'GREETING_DIWALI',             'all',                   'Diwali 2027'),
  ('2027-12-25', 'GREETING_CHRISTMAS',          'all',                   'Christmas 2027'),
  ('2028-01-01', 'GREETING_NEWYEAR',            'all',                   'New Year 2028')
ON CONFLICT (date, event_key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- Master switch (OFF)
-- ────────────────────────────────────────────────────────────
INSERT INTO feature_flags (key, label, category, scope, enabled, description)
VALUES ('festival_nudges',
        'Festival greetings',
        'Notifications',
        'global',
        false,
        'Master switch for services/festivalGreetings.js. OFF = no sends. ON = daily cron reads calendar_events and fires the day''s greeting events (all Founder-frame, Shubham sender).')
ON CONFLICT (key) DO NOTHING;
