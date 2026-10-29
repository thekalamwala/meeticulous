-- v3.64 — review moderation.
--
-- Adds an admin-controlled moderation state to reviews so the admin Reviews
-- Moderation page can hide/flag/remove reviews. Default 'visible' preserves
-- current behaviour (every existing review stays publicly visible).
--   visible  → shown everywhere (default)
--   hidden   → excluded from all public reads (host profile, service page, dashboards)
--   flagged  → still visible, marked for admin attention; drives the
--              "Reviews to moderate" count on the ops dashboard.
--
-- APPLIED: prod (Mumbai ayjhlwyzszykqtnaktpb) + staging (Tokyo xwvciqkayammbvsidqig)
-- on 2026-07-03 via Supabase MCP (migration name v3_61_reviews_moderation).

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS admin_note    text,
  ADD COLUMN IF NOT EXISTS moderated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by  uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_status_check'
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_status_check
      CHECK (status IN ('visible', 'hidden', 'flagged'));
  END IF;
END $$;

-- Partial index: the moderation queue reads only non-visible rows.
CREATE INDEX IF NOT EXISTS idx_reviews_status_active
  ON reviews (status) WHERE status <> 'visible';
