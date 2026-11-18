-- v3.223 Dashboard v2 shell feature flag — ships DORMANT (opt-in, default OFF).
-- The kill-switch registry (featureRegistry.js) defaults every flag to enabled=true
-- ("nothing ships off"), and isFeatureEnabled() is FAIL-OPEN (an unknown key returns
-- enabled). So for this opt-in LAYOUT flag we MUST pre-seed the row disabled; the boot
-- upsert then preserves enabled=false (it never overwrites an existing row's enabled).
-- Gates the Host Lab redesign adopted as the real host dashboard shell. Routes are
-- unchanged with it on or off, so flipping it back is a full revert.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'dashboard_v2',
  'Dashboard v2 (shell)',
  'Host Lab redesign adopted as the host dashboard shell: one flat, collapsible, chevron-expand rail for every host page (Overview included). Ships OFF. Off = the current rail/panel layout is served. Same routes either way.',
  'Operations',
  'vendor',
  false
)
ON CONFLICT (key) DO NOTHING;
