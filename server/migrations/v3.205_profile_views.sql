-- v3.205 Profile view counter — a host's public-profile view count, shown on
-- their dashboard and used as a free→Pro growth hook (GMV-lifter).
--
-- Additive + code-side schema-fallback safe: hostController.recordProfileView and
-- getMyProfileViews both swallow errors, so a boot before this migration applies
-- simply reports 0 views and the beacon no-ops. Apply on the live DB at/before merge.
--
-- ponytail: a plain INT counter, not a profile_views events table. It over-counts
-- refreshes/bots and can't do unique-visitors or per-day charts — fine for a vanity
-- + nudge metric. Upgrade to an events table only if those are later required.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_views integer NOT NULL DEFAULT 0;

-- Atomic increment (no read-modify-write race). SECURITY DEFINER so the counter
-- updates regardless of the caller's RLS; called only from the server with the
-- service role. Per v3.186 lockdown: revoke anon/authenticated EXECUTE explicitly.
CREATE OR REPLACE FUNCTION increment_profile_views(p_username text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles SET profile_views = profile_views + 1
  WHERE lower(username) = lower(p_username);
$$;

REVOKE ALL ON FUNCTION increment_profile_views(text) FROM anon, authenticated;
