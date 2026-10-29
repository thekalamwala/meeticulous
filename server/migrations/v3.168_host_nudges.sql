-- ============================================================
-- v3.168 — host_nudges: server-tracked dismissal for the dashboard "Next step" card
-- ------------------------------------------------------------
-- The host dashboard used to show several separate nudge banners (set up payouts /
-- upgrade / legacy auto-renew / share your link), each dismissed via localStorage —
-- so a dismiss never stuck across devices and hosts got re-nagged. This table records
-- WHICH nudge a host has snoozed and until when, so the single ranked "Next step" card
-- respects a dismiss everywhere.
--
-- The nudge content + ranking are computed client-side from data already loaded; the
-- server only owns this snooze state. Additive, RLS on / no policy / service_role only
-- (all reads/writes go through supabaseAdmin in hostNudgeController).
--
-- APPLY TO BOTH DBs (Tokyo staging + Mumbai prod). Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS host_nudges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nudge_key    text NOT NULL,
  snooze_until timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, nudge_key)
);

-- "Which of my nudges are still snoozed" — the only read pattern.
CREATE INDEX IF NOT EXISTS idx_host_nudges_host ON host_nudges (host_id);

ALTER TABLE host_nudges ENABLE ROW LEVEL SECURITY;
-- No policy: service_role (supabaseAdmin) bypasses RLS; the anon/auth clients must
-- never touch this table directly.
