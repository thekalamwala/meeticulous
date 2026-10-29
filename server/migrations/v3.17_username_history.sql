-- v3.17_username_history.sql
-- Permanent usernames with history + redirects (Facebook/GitHub style).
--
-- Identity model unchanged: profiles.id (= auth.users.id) is the immutable UUID.
-- username is a mutable alias. username_history is the source of truth for
-- alias -> user resolution AND for "never reusable". profiles.username stays as
-- a denormalized cache of the CURRENT alias so existing read paths keep working.

-- ── History table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS username_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT true,
  source      TEXT NOT NULL DEFAULT 'user',   -- 'auto' (initial, uncounted) | 'user'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);

-- Global non-reuse: a username, once used, is blocked forever (current OR historical).
CREATE UNIQUE INDEX IF NOT EXISTS username_history_username_key
  ON username_history (lower(username));

-- At most one current alias per user.
CREATE UNIQUE INDEX IF NOT EXISTS username_history_one_current
  ON username_history (user_id) WHERE is_current;

CREATE INDEX IF NOT EXISTS username_history_user_idx ON username_history (user_id);

-- Backfill existing usernames as the current alias, marked 'auto' so they do NOT
-- consume a user's change allowance (those names were auto/name-derived, not chosen).
INSERT INTO username_history (user_id, username, is_current, source)
SELECT id, username, true, 'auto'
FROM profiles
WHERE username IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS: deny-all (service-role only). Lookups go through the API, like otp_codes.
ALTER TABLE username_history ENABLE ROW LEVEL SECURITY;

-- ── Atomic, race-safe username change ──────────────────────────────────────
-- Enforces (in one transaction): whatsapp gate, global non-reuse, max 2
-- user-initiated changes per rolling 365 days, and >= 6 months between changes.
-- Reserved-word + format validation is done in the app layer BEFORE this call.
CREATE OR REPLACE FUNCTION change_username(p_user_id uuid, p_new text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wa     boolean;
  v_count  int;
  v_last   timestamptz;
  v_new    text := lower(trim(p_new));
BEGIN
  -- WhatsApp gate
  SELECT whatsapp_verified INTO v_wa FROM profiles WHERE id = p_user_id;
  IF v_wa IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'whatsapp_unverified');
  END IF;

  -- Global non-reuse (case-insensitive, current OR historical)
  IF EXISTS (SELECT 1 FROM username_history WHERE lower(username) = v_new) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'taken');
  END IF;

  -- Rate window: fewer than 2 user-initiated changes in the last 365 days
  SELECT count(*) INTO v_count
    FROM username_history
   WHERE user_id = p_user_id AND source = 'user'
     AND created_at > now() - interval '365 days';
  IF v_count >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached');
  END IF;

  -- Gap: most recent user change must be >= 6 months ago
  SELECT max(created_at) INTO v_last
    FROM username_history
   WHERE user_id = p_user_id AND source = 'user';
  IF v_last IS NOT NULL AND v_last > now() - interval '6 months' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_soon',
                              'next_eligible', v_last + interval '6 months');
  END IF;

  -- Swap: release current, insert new current, refresh the cache on profiles
  UPDATE username_history SET is_current = false, released_at = now()
   WHERE user_id = p_user_id AND is_current;

  INSERT INTO username_history (user_id, username, is_current, source)
   VALUES (p_user_id, v_new, true, 'user');

  UPDATE profiles SET username = v_new, updated_at = now() WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'username', v_new);
EXCEPTION WHEN unique_violation THEN
  -- Lost a race for the same name
  RETURN jsonb_build_object('ok', false, 'reason', 'taken');
END;
$$;

REVOKE ALL ON FUNCTION change_username(uuid, text) FROM anon, authenticated;

-- ── Trigger: stop auto-deriving username from email ────────────────────────
-- The old handle_new_user() set username = <emailpart><uuid4>. That would defeat
-- the new permanent {adjective}-{noun}-{suffix} generator (upsertProfile would
-- "preserve" the trigger value instead of generating). Leave username NULL on
-- auth.users insert; the app (authController.upsertProfile) generates + records
-- the permanent username and writes the username_history row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
