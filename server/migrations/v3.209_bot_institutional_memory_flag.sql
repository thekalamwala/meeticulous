-- v3.209 Bot institutional memory feature flag — ships DORMANT (opt-in, default OFF).
-- When ON, botService.retrieve() also recalls the team's prior ANSWERED community
-- questions matching the query (Postgres full-text over community_posts/comments) and
-- appends the best answer as an extra retrieval source, so Tithi reuses real past answers
-- instead of only the help docs. Read-only, schema-fallback (missing data → docs-only).
--
-- Registry defaults flags to enabled=true and isFeatureEnabled() is FAIL-OPEN for unknown
-- keys, so this opt-in flag is pre-seeded disabled AND listed in FAIL_CLOSED_KEYS. The boot
-- upsert never overwrites an existing row's enabled.
--
-- Optional (not required — v1 full-text-searches on the fly): for scale, add a GIN index
--   CREATE INDEX IF NOT EXISTS idx_community_posts_body_fts
--     ON community_posts USING gin (to_tsvector('english', body));
-- so the recall query doesn't seq-scan once the community grows.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'bot_institutional_memory',
  'Bot Institutional Memory',
  'Tithi recalls the team''s prior answered community questions at retrieval time and uses the best answer as an extra source, instead of only the help docs. Off = docs-only retrieval. Read-only.',
  'Support',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
