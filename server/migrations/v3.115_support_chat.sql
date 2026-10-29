-- v3.115_support_chat.sql — Host↔Admin + Guest↔Admin support chat (Bolt AI → human handoff).
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- One live thread per host/guest support conversation. It starts with the Bolt AI
-- (status 'bot'); on handoff it goes 'waiting', an admin 'assigned', then 'resolved'.
--
-- Same posture as every bot_* table: RLS ENABLED, no policies, service_role only —
-- the browser NEVER reads these directly. History is served through Express; live
-- updates arrive over a Supabase Realtime BROADCAST channel (server-authoritative,
-- needs no RLS because the DB row written through the authz-checked API is the
-- source of truth and the broadcast is display-only).
--
-- Schema-fallback-safe: the controllers destructure defensively so the app degrades
-- (no chat) rather than 500s if this hasn't been applied everywhere yet.

CREATE TABLE IF NOT EXISTS support_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference         TEXT NOT NULL,                                   -- human ref e.g. SUP-8F92AB
  participant_type  TEXT NOT NULL CHECK (participant_type IN ('host','guest')),
  user_id           UUID,                                           -- profiles.id (host or guest); decoupled, no hard FK
  guest_phone       TEXT,                                           -- guest identity when there is no profile row
  subject           TEXT,
  ai_summary        TEXT,                                           -- one-sentence Bolt summary captured at handoff
  status            TEXT NOT NULL DEFAULT 'bot' CHECK (status IN ('bot','waiting','assigned','resolved')),
  assigned_admin    TEXT,                                           -- admin id/email currently handling it
  user_unread       INTEGER NOT NULL DEFAULT 0,                     -- messages the host/guest hasn't seen
  admin_unread      INTEGER NOT NULL DEFAULT 0,                     -- messages support hasn't seen
  rating            SMALLINT CHECK (rating BETWEEN 1 AND 5),        -- optional post-resolution rating
  last_message_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_threads_user_idx   ON support_threads (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_threads_status_idx ON support_threads (status, last_message_at DESC NULLS LAST);
ALTER TABLE support_threads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON support_threads FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS support_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  sender       TEXT NOT NULL CHECK (sender IN ('user','bot','admin','system')),
  sender_id    TEXT,                                                -- profile id / admin id (null for bot/system)
  sender_name  TEXT,                                                -- display name snapshot (e.g. the admin's name)
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_thread_idx ON support_messages (thread_id, created_at);
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON support_messages FROM anon, authenticated;
