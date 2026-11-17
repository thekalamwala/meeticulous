-- v3.210 Bot per-person memory feature flag — ships DORMANT (opt-in, default OFF).
-- When ON, an authenticated support thread adds a compact "what you already know about
-- this person" line to Tithi's prompt (tenure + prior support topics — already fetched
-- into the support context), so she has continuity instead of answering each thread cold.
-- Read-only, PII-light (counts + subjects, no names/numbers).
--
-- Pre-seeded disabled + in FAIL_CLOSED_KEYS because the registry defaults flags on and
-- isFeatureEnabled() is FAIL-OPEN for unknown keys. The boot upsert keeps enabled=false.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'bot_person_memory',
  'Bot Per-Person Memory',
  'On an authenticated support thread, Tithi gets a compact memory line (tenure + prior support topics) for continuity across sessions. Off = each thread is answered cold. Read-only.',
  'Support',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
