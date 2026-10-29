-- v3.33_reserved_slugs.sql
--
-- L2 of the reserved-namespace system: runtime admin / premium / business-prefix
-- reservations. The L1 route + system names live in code
-- (server/config/reservedNamespaces.js) so they can never be deleted by a DB
-- write; this table holds only what admins add at runtime. The app-layer
-- reservedSlugService unions L1 + L2 + username_history.
--
-- is_reserved_slug() lets the two username RPCs (change_username,
-- set_onboarding_username) reject L2 names as defense-in-depth WITHOUT
-- duplicating the L1 list in SQL. Idempotent — safe to run on both DBs.

-- ── Table ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reserved_slugs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,                  -- canonical (normalized) form
  kind        text NOT NULL DEFAULT 'admin',  -- 'system' | 'admin' | 'premium' | 'prefix'
  reason      text,                           -- human note (brand, future product, partner)
  is_prefix   boolean NOT NULL DEFAULT false, -- also block slug-* (business namespace)
  premium     boolean NOT NULL DEFAULT false, -- reservable/sellable (Phase 9 stub)
  assignable  boolean NOT NULL DEFAULT false, -- premium: grantable to a user
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz                     -- soft release (nullable)
);

-- One ACTIVE reservation per name (released rows don't block re-adding).
CREATE UNIQUE INDEX IF NOT EXISTS reserved_slugs_slug_active
  ON reserved_slugs (lower(slug)) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS reserved_slugs_kind_idx
  ON reserved_slugs (kind) WHERE released_at IS NULL;

-- RLS deny-all (service-role only) — parity with username_history. The
-- supabase-anon-api-exposure incident (2026-06-22) is why anon/authenticated
-- are explicitly revoked: table grants default to PUBLIC otherwise.
ALTER TABLE reserved_slugs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'reserved_slugs' AND policyname = 'deny_all'
  ) THEN
    CREATE POLICY deny_all ON reserved_slugs FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;
REVOKE ALL ON reserved_slugs FROM anon, authenticated;

-- ── Helper: exact + prefix match against ACTIVE L2 rows ─────────────────────
-- SECURITY DEFINER so the (also-definer) username RPCs can call it. Checks only
-- the table, never the L1 code list. STABLE: pure read.
CREATE OR REPLACE FUNCTION is_reserved_slug(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM reserved_slugs
     WHERE released_at IS NULL
       AND (
         lower(slug) = lower(p_slug)
         OR (is_prefix AND lower(p_slug) LIKE lower(slug) || '-%')
       )
  );
$$;
REVOKE ALL ON FUNCTION is_reserved_slug(text) FROM PUBLIC, anon, authenticated;

-- ── Harden change_username: add L2 guard ────────────────────────────────────
-- Verbatim copy of the v3.17 body with one inserted check after the global
-- non-reuse test. L1 route enforcement stays in the app layer (this RPC is
-- service-role-only and every caller passes through the JS gate).
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

  -- L2 reserved (admin/premium/prefix). Mapped to 'taken' so the controller's
  -- existing reason handling applies with no new code path.
  IF is_reserved_slug(v_new) THEN
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

-- ── Harden set_onboarding_username: add L2 guard ────────────────────────────
-- Verbatim copy of the v3.32 body with one inserted check AFTER the idempotent
-- self-claim (so a user keeping a name that was reserved later is grandfathered)
-- and before the retire/insert.
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

  -- L2 reserved (admin/premium/prefix). After the idempotent check so a
  -- grandfathered self-claim still succeeds; a NEW reserved name is rejected.
  IF is_reserved_slug(v_clean) THEN
    RAISE EXCEPTION 'username_taken';
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
  RAISE EXCEPTION 'username_taken';
END;
$$;
REVOKE ALL ON FUNCTION set_onboarding_username(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_onboarding_username(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION set_onboarding_username(uuid, text) FROM authenticated;
