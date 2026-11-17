-- v3.211 Bot gap digest feature flag — ships DORMANT (opt-in, default OFF).
-- When ON, a weekly job clusters the week's unanswered support questions (knowledge_gaps,
-- reason='escalated') into themes, drafts a help-doc stub for the top one, and emails the
-- team — closing the learning loop so the KB's gaps become its next entries.
-- Read-only except the digest email; clustering is a cheap keyword signature.
--
-- Pre-seeded disabled + in FAIL_CLOSED_KEYS (registry defaults flags on, isFeatureEnabled()
-- is FAIL-OPEN for unknown keys). The boot upsert keeps enabled=false.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'bot_gap_digest',
  'Bot Gap Digest',
  'Weekly: cluster the week''s unanswered support questions into themes, draft a help-doc stub for the top one, and email the team. Off = no digest. Email only.',
  'Support',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
