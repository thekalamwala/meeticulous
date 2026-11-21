-- v3.226 — Community post collaborators.
--
-- A community post can credit up to 2 collaborators (enforced in the API, not the
-- DB). Instant credit, no accept step: a row here means the person is shown on the
-- post and the post surfaces on their community profile feed. Max-2 and
-- self-exclusion live in communityController.createItem.
--
-- Apply on BOTH DBs. Additive + RLS-on/no-policy/service_role-only, like every
-- other community_* table. store.js keeps a schema fallback
-- (loadCollaboratorsByPost returns an empty map on "table missing"), so the
-- feature degrades to "no collaborators" before this runs, and the
-- community_collaborators flag ships OFF regardless.

CREATE TABLE IF NOT EXISTS community_post_collaborators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  position    SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS community_post_collaborators_post_profile_uq
  ON community_post_collaborators (post_id, profile_id);

CREATE INDEX IF NOT EXISTS community_post_collaborators_profile_idx
  ON community_post_collaborators (profile_id);

ALTER TABLE community_post_collaborators ENABLE ROW LEVEL SECURITY;

-- Seed the semantic event so the notifications console can govern email/WhatsApp
-- later. In-app is sent directly via inAppNotify (does not consult this row), so
-- the feature works whether or not this row exists.
INSERT INTO notification_events
  (event_key, display_name, email_enabled, whatsapp_enabled, in_app_enabled, is_active, email_subject)
VALUES
  ('COMMUNITY_COLLABORATOR_ADDED', 'Added as a post collaborator', FALSE, FALSE, TRUE, TRUE, 'You were added as a collaborator')
ON CONFLICT (event_key) DO UPDATE
  SET in_app_enabled = EXCLUDED.in_app_enabled,
      is_active      = EXCLUDED.is_active;
