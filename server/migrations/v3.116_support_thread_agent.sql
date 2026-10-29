-- v3.116 — Support thread agent (persona) snapshot.
--
-- Stores the customer-facing display name of the agent currently handling a
-- thread, so the inbox and transcript header can show "Tithi is on it" without
-- re-resolving the persona from assigned_admin (which holds the admin id, not
-- an email). Snapshotting keeps historic threads correct if the roster changes.
--
-- Additive + nullable → code is schema-fallback safe: agent_name is written via
-- a best-effort update that swallows the error when this column is absent, so the
-- feature degrades (no name badge) rather than breaking assign before this runs.
--
-- Apply on BOTH DBs (prod Mumbai + staging Tokyo) per repo workflow.

ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS agent_name TEXT;
