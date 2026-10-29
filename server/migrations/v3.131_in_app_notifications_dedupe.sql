-- v3.131 — In-app notification de-duplication key.
--
-- Adds in_app_notifications.dedupe_key so a repeated emit (e.g. the confirmation
-- reconciler re-firing a booking, or a webhook retry) doesn't stack duplicate bell
-- rows. inAppNotify skips the insert when a row with the same (user_id, dedupe_key)
-- already exists; the partial unique index also enforces it at the DB level to
-- close the app-check race.
--
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo). inAppNotify keeps a schema
-- fallback: before this runs it retries the insert without dedupe_key, so nothing
-- breaks — dedupe simply no-ops until the column exists.

ALTER TABLE in_app_notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS in_app_notifications_user_dedupe_uq
  ON in_app_notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
