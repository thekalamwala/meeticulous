-- ============================================================
-- v3.185 — Community (public feed + threads), schema for ALL phases
-- ------------------------------------------------------------
-- 18 tables, counter triggers, 5 seeded spaces, 3 notification events.
-- All tables: RLS on, NO policy (service_role / supabaseAdmin only).
-- Account deletion: authors/reporters -> ON DELETE SET NULL (content stays as
-- "Deleted account"); personal rows -> ON DELETE CASCADE, counters corrected by
-- the triggers below (they also run on DELETE).
-- moderated_by / resolved_by are plain uuid (no FK to admin_users) so deleting an
-- admin never touches the moderation trail.
-- accepted_comment_id is a plain uuid (no FK) to avoid a posts<->comments cycle.
-- APPLY TO the Meeticulous DB. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS community_members (
  user_id            uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  terms_version      text,
  terms_accepted_at  timestamptz,
  badge              text CHECK (badge IN ('official','ai','staff')),
  banned_until       timestamptz,
  ban_reason         text,
  links_allowed      boolean NOT NULL DEFAULT false,
  early_access       boolean NOT NULL DEFAULT false,
  email_replies      boolean NOT NULL DEFAULT true,
  post_count         int NOT NULL DEFAULT 0,
  comment_count      int NOT NULL DEFAULT 0,
  follower_count     int NOT NULL DEFAULT 0,
  following_count    int NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_spaces (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  position      int NOT NULL DEFAULT 0,
  post_policy   text NOT NULL DEFAULT 'everyone' CHECK (post_policy IN ('everyone','hosts','official')),
  reply_policy  text NOT NULL DEFAULT 'everyone' CHECK (reply_policy IN ('everyone','hosts')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                text NOT NULL CHECK (kind IN ('post','thread')),
  format              text NOT NULL DEFAULT 'text' CHECK (format IN
                        ('text','question','link','poll','quote','repost','service','slot_drop','announcement')),
  author_id           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  space_id            uuid REFERENCES community_spaces(id),
  title               text,
  body                text NOT NULL DEFAULT '',
  slug                text NOT NULL UNIQUE,
  quoted_post_id      uuid REFERENCES community_posts(id) ON DELETE SET NULL,
  accepted_comment_id uuid,
  mentions_host_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified_booking    boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed','deleted')),
  is_pinned           boolean NOT NULL DEFAULT false,
  pinned_until        timestamptz,
  is_indexable        boolean NOT NULL DEFAULT false,
  like_count          int NOT NULL DEFAULT 0,
  comment_count       int NOT NULL DEFAULT 0,
  repost_count        int NOT NULL DEFAULT 0,
  save_count          int NOT NULL DEFAULT 0,
  last_activity_at    timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  edited_at           timestamptz,
  deleted_at          timestamptz,
  moderated_by        uuid,
  moderated_at        timestamptz,
  admin_note          text,
  CONSTRAINT community_posts_thread_req CHECK ((kind <> 'thread') OR (title IS NOT NULL AND space_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_community_repost ON community_posts (author_id, quoted_post_id) WHERE format = 'repost';
CREATE INDEX IF NOT EXISTS idx_community_posts_feed ON community_posts (status, created_at DESC, id DESC) WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS idx_community_posts_space ON community_posts (space_id, last_activity_at DESC, id DESC) WHERE kind = 'thread' AND status = 'visible';
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_indexable ON community_posts (is_indexable, last_activity_at DESC) WHERE is_indexable;

CREATE TABLE IF NOT EXISTS community_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES community_comments(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed','deleted')),
  like_count    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz,
  deleted_at    timestamptz,
  moderated_by  uuid,
  moderated_at  timestamptz,
  admin_note    text
);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments (post_id, created_at, id);

CREATE TABLE IF NOT EXISTS community_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id  uuid REFERENCES community_comments(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('image','video')),
  url         text NOT NULL,
  width       int,
  height      int,
  alt         text,
  position    smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_media_one_target CHECK ((post_id IS NULL) <> (comment_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_community_media_post ON community_media (post_id, position);
CREATE INDEX IF NOT EXISTS idx_community_media_comment ON community_media (comment_id) WHERE comment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS community_embeds (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id              uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  kind                 text NOT NULL CHECK (kind IN ('service','slot','link')),
  position             smallint NOT NULL DEFAULT 0,
  service_id           uuid REFERENCES services(id) ON DELETE SET NULL,
  slot_start           timestamptz,
  slot_end             timestamptz,
  url                  text,
  preview_title        text,
  preview_description  text,
  preview_image        text
);
CREATE INDEX IF NOT EXISTS idx_community_embeds_post ON community_embeds (post_id, position);

CREATE TABLE IF NOT EXISTS community_polls (
  post_id      uuid PRIMARY KEY REFERENCES community_posts(id) ON DELETE CASCADE,
  closes_at    timestamptz,
  total_votes  int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS community_poll_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES community_polls(post_id) ON DELETE CASCADE,
  label       text NOT NULL,
  position    smallint NOT NULL DEFAULT 0,
  vote_count  int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_community_poll_options_post ON community_poll_options (post_id, position);

CREATE TABLE IF NOT EXISTS community_poll_votes (
  post_id     uuid NOT NULL REFERENCES community_polls(post_id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES community_poll_options(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_reactions (
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type  text NOT NULL CHECK (target_type IN ('post','comment')),
  target_id    uuid NOT NULL,
  kind         text NOT NULL DEFAULT 'like' CHECK (kind IN ('like')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_community_reactions_target ON community_reactions (target_type, target_id);

CREATE TABLE IF NOT EXISTS community_follows (
  follower_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followee_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS idx_community_follows_followee ON community_follows (followee_id);

CREATE TABLE IF NOT EXISTS community_blocks (
  blocker_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_community_blocks_blocked ON community_blocks (blocked_id);

CREATE TABLE IF NOT EXISTS community_saves (
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS community_mentions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id            uuid REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id         uuid REFERENCES community_comments(id) ON DELETE CASCADE,
  mentioned_user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_mentions_one_target CHECK ((post_id IS NULL) <> (comment_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_community_mentions_user ON community_mentions (mentioned_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_hashtags (
  tag        text PRIMARY KEY,
  use_count  int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS community_post_hashtags (
  post_id  uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  tag      text NOT NULL REFERENCES community_hashtags(tag) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_community_post_hashtags_tag ON community_post_hashtags (tag);

CREATE TABLE IF NOT EXISTS community_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type      text NOT NULL CHECK (target_type IN ('post','comment','member')),
  target_id        uuid NOT NULL,
  reporter_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reason           text NOT NULL CHECK (reason IN
                     ('spam','harassment','hate','sexual','violence','off_platform','defamation','illegal','other')),
  details          text,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by      uuid,
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_community_reports_status ON community_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS community_ads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser        text NOT NULL,
  slot              text NOT NULL CHECK (slot IN ('feed','rail','sidebar','space_banner')),
  title             text NOT NULL,
  body              text,
  image_url         text,
  link_url          text NOT NULL,
  cta_label         text,
  starts_at         timestamptz NOT NULL DEFAULT now(),
  ends_at           timestamptz,
  is_active         boolean NOT NULL DEFAULT true,
  priority          int NOT NULL DEFAULT 0,
  max_views_per_day smallint NOT NULL DEFAULT 3,
  space_id          uuid REFERENCES community_spaces(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_ads_slot ON community_ads (slot, priority DESC) WHERE is_active;

-- RLS: on, no policy (service_role bypasses; anon/auth clients never touch these).
ALTER TABLE community_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_spaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_media          ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_embeds         ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_polls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_poll_options   ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_poll_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_follows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_saves          ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_mentions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_hashtags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_hashtags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_ads            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Counter + integrity triggers (run on DELETE too, so cascades from account
-- deletion keep counters right; every decrement is GREATEST(x-1, 0)).
-- ============================================================

-- 1. Reactions: integrity check (BEFORE INSERT) + like_count
CREATE OR REPLACE FUNCTION community_reaction_check() RETURNS trigger AS $$
BEGIN
  IF NEW.target_type = 'post' THEN
    IF NOT EXISTS (SELECT 1 FROM community_posts WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'community_reactions: post % does not exist', NEW.target_id;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM community_comments WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'community_reactions: comment % does not exist', NEW.target_id;
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION community_reaction_count() RETURNS trigger AS $$
DECLARE
  r community_reactions;
  d int;
BEGIN
  IF TG_OP = 'INSERT' THEN r := NEW; d := 1; ELSE r := OLD; d := -1; END IF;
  IF r.target_type = 'post' THEN
    UPDATE community_posts SET like_count = GREATEST(like_count + d, 0) WHERE id = r.target_id;
  ELSE
    UPDATE community_comments SET like_count = GREATEST(like_count + d, 0) WHERE id = r.target_id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_reaction_check ON community_reactions;
CREATE TRIGGER trg_community_reaction_check BEFORE INSERT ON community_reactions
  FOR EACH ROW EXECUTE FUNCTION community_reaction_check();
DROP TRIGGER IF EXISTS trg_community_reaction_count ON community_reactions;
CREATE TRIGGER trg_community_reaction_count AFTER INSERT OR DELETE ON community_reactions
  FOR EACH ROW EXECUTE FUNCTION community_reaction_count();

-- 2. Comments: post.comment_count counts VISIBLE comments only; a new visible comment bumps last_activity_at
CREATE OR REPLACE FUNCTION community_comment_post_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'visible' THEN
      UPDATE community_posts SET comment_count = comment_count + 1, last_activity_at = now() WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'visible' AND NEW.status <> 'visible' THEN
      UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.post_id;
    ELSIF OLD.status <> 'visible' AND NEW.status = 'visible' THEN
      UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'visible' THEN
      UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_comment_post_count ON community_comments;
CREATE TRIGGER trg_community_comment_post_count AFTER INSERT OR UPDATE OF status OR DELETE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION community_comment_post_count();

-- 3. Member post_count / comment_count (+1 on insert; upsert the member row; skip deleted authors)
CREATE OR REPLACE FUNCTION community_member_post_count() RETURNS trigger AS $$
BEGIN
  IF NEW.author_id IS NOT NULL THEN
    INSERT INTO community_members (user_id, post_count) VALUES (NEW.author_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET post_count = community_members.post_count + 1;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION community_member_comment_count() RETURNS trigger AS $$
BEGIN
  IF NEW.author_id IS NOT NULL THEN
    INSERT INTO community_members (user_id, comment_count) VALUES (NEW.author_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET comment_count = community_members.comment_count + 1;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_member_post_count ON community_posts;
CREATE TRIGGER trg_community_member_post_count AFTER INSERT ON community_posts
  FOR EACH ROW EXECUTE FUNCTION community_member_post_count();
DROP TRIGGER IF EXISTS trg_community_member_comment_count ON community_comments;
CREATE TRIGGER trg_community_member_comment_count AFTER INSERT ON community_comments
  FOR EACH ROW EXECUTE FUNCTION community_member_comment_count();

-- 4. Follows: follower_count / following_count.
-- INSERT upserts; DELETE only UPDATEs (an upsert during an account-deletion cascade
-- would try to re-create a member row for a profile that is going away).
CREATE OR REPLACE FUNCTION community_follow_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO community_members (user_id, follower_count) VALUES (NEW.followee_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET follower_count = community_members.follower_count + 1;
    INSERT INTO community_members (user_id, following_count) VALUES (NEW.follower_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET following_count = community_members.following_count + 1;
  ELSE
    UPDATE community_members SET follower_count = GREATEST(follower_count - 1, 0) WHERE user_id = OLD.followee_id;
    UPDATE community_members SET following_count = GREATEST(following_count - 1, 0) WHERE user_id = OLD.follower_id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_follow_count ON community_follows;
CREATE TRIGGER trg_community_follow_count AFTER INSERT OR DELETE ON community_follows
  FOR EACH ROW EXECUTE FUNCTION community_follow_count();

-- 5. Saves: save_count
CREATE OR REPLACE FUNCTION community_save_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET save_count = save_count + 1 WHERE id = NEW.post_id;
  ELSE
    UPDATE community_posts SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_save_count ON community_saves;
CREATE TRIGGER trg_community_save_count AFTER INSERT OR DELETE ON community_saves
  FOR EACH ROW EXECUTE FUNCTION community_save_count();

-- 6. Reposts: repost_count on the original
CREATE OR REPLACE FUNCTION community_repost_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.format = 'repost' AND NEW.quoted_post_id IS NOT NULL THEN
      UPDATE community_posts SET repost_count = repost_count + 1 WHERE id = NEW.quoted_post_id;
    END IF;
  ELSIF OLD.format = 'repost' AND OLD.quoted_post_id IS NOT NULL THEN
    UPDATE community_posts SET repost_count = GREATEST(repost_count - 1, 0) WHERE id = OLD.quoted_post_id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_repost_count ON community_posts;
CREATE TRIGGER trg_community_repost_count AFTER INSERT OR DELETE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION community_repost_count();

-- 7. Poll votes: option vote_count + poll total_votes
CREATE OR REPLACE FUNCTION community_poll_vote_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    UPDATE community_polls SET total_votes = total_votes + 1 WHERE post_id = NEW.post_id;
  ELSE
    UPDATE community_poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
    UPDATE community_polls SET total_votes = GREATEST(total_votes - 1, 0) WHERE post_id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_poll_vote_count ON community_poll_votes;
CREATE TRIGGER trg_community_poll_vote_count AFTER INSERT OR DELETE ON community_poll_votes
  FOR EACH ROW EXECUTE FUNCTION community_poll_vote_count();

-- ============================================================
-- Seeds
-- ============================================================
INSERT INTO community_spaces (key, name, description, position, post_policy, reply_policy) VALUES
  ('updates',     'Meeticulous Updates', 'Product news and announcements from the Meeticulous team.', 1, 'official', 'everyone'),
  ('help',        'Help & Questions',    'Ask how things work and get answers from the community.',   2, 'everyone', 'everyone'),
  ('ideas',       'Ideas & Feedback',    'Tell us what to build next.',                               3, 'everyone', 'everyone'),
  ('host-corner', 'Host Corner',         'Hosts talk shop: pricing, growth and what is working.',     4, 'hosts',    'hosts'),
  ('general',     'General',             'Everything else.',                                          5, 'everyone', 'everyone')
ON CONFLICT (key) DO NOTHING;

INSERT INTO notification_events
  (event_key, display_name, email_enabled, whatsapp_enabled, in_app_enabled, is_active, email_subject)
VALUES
  ('COMMUNITY_REPLY',           'Community reply',            TRUE, FALSE, TRUE, TRUE, 'Someone replied to you in the community'),
  ('COMMUNITY_MENTION',         'Community mention',          TRUE, FALSE, TRUE, TRUE, 'You were mentioned in the community'),
  ('COMMUNITY_CONTENT_REMOVED', 'Community content removed',  TRUE, FALSE, TRUE, TRUE, 'Your community post was removed')
ON CONFLICT (event_key) DO UPDATE
  SET in_app_enabled = EXCLUDED.in_app_enabled,
      email_enabled  = EXCLUDED.email_enabled,
      is_active      = EXCLUDED.is_active;
