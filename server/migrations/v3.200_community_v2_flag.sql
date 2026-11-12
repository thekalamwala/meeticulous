-- v3.200 Community v2 (mobile redesign) feature flag — ships DORMANT (default OFF).
-- Same pattern as v3.188: the kill-switch registry defaults flags to enabled=true
-- and isFeatureEnabled() is fail-open, so an opt-in UI flag MUST be pre-seeded
-- disabled. The boot upsert then preserves enabled=false (it never overwrites an
-- existing row's enabled). community_v2 is also in FAIL_CLOSED_KEYS, so a missing
-- row or a DB read error serves the current (v1) layout, never the half-wired v2.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'community_v2',
  'Community v2 (mobile)',
  'Feed-first mobile redesign of the community (new navbar, bottom bar, composer, drawers). Off = the current community layout is served.',
  'Community',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
