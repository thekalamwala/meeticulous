-- v3.35 Unified login feature flag (Phase 3) — ships DORMANT (opt-in, default OFF).
-- The kill-switch registry (featureRegistry.js) defaults every flag to enabled=true
-- ("nothing ships off"), and isFeatureEnabled() is FAIL-OPEN (an unknown key returns
-- enabled). So for an opt-in auth flag we MUST pre-seed the row disabled; the boot
-- upsert then preserves enabled=false (it never overwrites an existing row's enabled).
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'unified_login',
  'Unified Login',
  'Sign in by email OR phone to one account (any role). Off = phone login/OTP is guest-only (separate host/guest sign-in).',
  'Auth',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
