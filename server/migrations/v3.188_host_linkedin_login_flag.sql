-- v3.188 Host LinkedIn login feature flag (Phase 2) — ships DORMANT (opt-in, default OFF).
-- The kill-switch registry (featureRegistry.js) defaults every flag to enabled=true
-- ("nothing ships off"), and isFeatureEnabled() is FAIL-OPEN (an unknown key returns
-- enabled). So for an opt-in auth flag we MUST pre-seed the row disabled; the boot
-- upsert then preserves enabled=false (it never overwrites an existing row's enabled).
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'host_linkedin_login',
  'LinkedIn host login',
  'Hosts can sign up and log in with LinkedIn on the host door. Off = LinkedIn button hidden and POST /api/auth/linkedin/host returns 503.',
  'Auth',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
