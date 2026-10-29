-- v3.32_set_onboarding_username.sql
--
-- Atomic onboarding username claim, executed inside a single plpgsql function
-- body (one implicit transaction). Replaces the 3-sequential-Supabase-call path
-- in usernameService.setOnboardingUsername.
--
-- Design notes:
--   • source='onboarding' does NOT count toward the 2/365-day user-initiated
--     change allowance tracked by source='user' in change_username. This
--     function intentionally skips the WhatsApp gate, rate-window, and gap
--     checks — this is the host's FIRST real name choice; the auto placeholder
--     recorded by upsertProfile is not a "change".
--   • Idempotent: if the user's current username_history row already equals
--     p_username (case-insensitive), the function is a no-op and returns ok.
--   • Conflict: if the global lower(username) unique index fires (name taken by
--     ANY other row, current or historical), raises EXCEPTION 'username_taken'
--     so the JS caller can map it to a 400 "Slug already taken" without parsing
--     Postgres error codes.
--
-- Security model: mirrors change_username exactly.
--   • SECURITY DEFINER — runs as the function owner (postgres/supabase admin),
--     bypassing row-level security on username_history and profiles. The
--     service-role key (supabaseAdmin) is the only caller from the application.
--   • REVOKE from PUBLIC/anon/authenticated — the supabase-anon-api-exposure
--     incident (2026-06-22) proved that functions default EXECUTE to PUBLIC and
--     can be called directly via the anon REST endpoint. This is prevented here.
--   • service_role retains execute via its superuser-equivalent role; no
--     explicit GRANT is needed (and none appears in change_username either).

CREATE OR REPLACE FUNCTION set_onboarding_username(p_user_id uuid, p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean      text := lower(trim(p_username));
  v_current_id uuid;
  v_current_un text;
BEGIN
  -- Look up the user's current username_history row (is_current=true).
  SELECT id, lower(username)
    INTO v_current_id, v_current_un
    FROM username_history
   WHERE user_id = p_user_id AND is_current = true
   LIMIT 1;

  -- Idempotent: already this name, nothing to do.
  IF v_current_un = v_clean THEN
    RETURN jsonb_build_object('ok', true, 'username', v_clean);
  END IF;

  -- Retire the current row (if any).
  UPDATE username_history
     SET is_current = false, released_at = now()
   WHERE user_id = p_user_id AND is_current = true;

  -- Insert new current row (source='onboarding' is exempt from rate gates).
  -- The global unique index on lower(username) fires here on conflict.
  INSERT INTO username_history (user_id, username, source, is_current)
  VALUES (p_user_id, v_clean, 'onboarding', true);

  -- Update the denormalized cache on profiles.
  UPDATE profiles
     SET username = v_clean, updated_at = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'username', v_clean);

EXCEPTION WHEN unique_violation THEN
  -- The global lower(username) unique index fired: name is taken (current or
  -- historical). Raise a named exception so JS can catch it without parsing
  -- Postgres error codes.
  RAISE EXCEPTION 'username_taken';
END;
$$;

-- ── Security: deny public/anon/authenticated — server-only via service_role ──
-- Mirrors change_username's REVOKE lines exactly. The supabase-anon-api-exposure
-- incident showed that omitting this lets the function be called via the public
-- REST endpoint. service_role retains execute implicitly (superuser-equivalent).
REVOKE ALL ON FUNCTION set_onboarding_username(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_onboarding_username(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION set_onboarding_username(uuid, text) FROM authenticated;
