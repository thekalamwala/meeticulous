-- v3.207 Bot account tool-loop feature flag — ships DORMANT (opt-in, default OFF).
-- Tithi's agentic path: on the AUTHENTICATED support thread she uses a model tool-loop
-- to answer a signed-in user's own account questions (booking / refund / listing /
-- payout / plan status) from live state, instead of the regex contextAnswer ladder.
-- Read-only in this slice (no writes, no amounts).
--
-- The kill-switch registry (featureRegistry.js) defaults every flag to enabled=true and
-- isFeatureEnabled() is FAIL-OPEN for unknown keys, so an account-touching opt-in flag
-- MUST be pre-seeded disabled AND listed in FAIL_CLOSED_KEYS. The boot upsert never
-- overwrites an existing row's `enabled`, so this stays OFF until an admin flips it.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'bot_tool_loop',
  'Bot Account Tool-Loop',
  'Tithi answers a signed-in user''s own account questions (booking/refund/listing/payout/plan status) via a read-only model tool-loop instead of the regex ladder. Off = existing regex path.',
  'Support',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
