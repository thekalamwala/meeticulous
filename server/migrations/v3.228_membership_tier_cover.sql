-- v3.228 — Membership tier cover image + description (Catalog upgrade, Kept tiers).
--
-- Each tier now carries a cover image and a one-paragraph description beside the
-- existing name / price / perks (perks is already jsonb, v3.218). Both nullable,
-- no default: a tier without them renders exactly as before.
--
-- Additive only. Code is schema-fallback safe (membershipController strips these
-- two fields and retries when the columns are missing), so this can be applied
-- before or after the code deploys. RLS / grants untouched (v3.206 default
-- privileges already deny anon/authenticated writes on this table).
--
-- Rollback:
--   ALTER TABLE community_membership_tiers DROP COLUMN IF EXISTS cover_url;
--   ALTER TABLE community_membership_tiers DROP COLUMN IF EXISTS description;

ALTER TABLE community_membership_tiers ADD COLUMN IF NOT EXISTS cover_url   text;
ALTER TABLE community_membership_tiers ADD COLUMN IF NOT EXISTS description text;

-- Same caps the controller enforces, so a direct write can't exceed them.
DO $$ BEGIN
  ALTER TABLE community_membership_tiers
    ADD CONSTRAINT tier_description_len CHECK (description IS NULL OR char_length(description) <= 600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
