-- v3.208 Tithi proactive in-app nudges feature flag — ships DORMANT (opt-in, default OFF).
-- When ON, tithiProactive.js drops IN-APP nudges in a host's notification bell for a
-- resolvable blocker (verification stuck, no live service, earnings waiting, plan expiring).
-- In-app only, deduped per host per blocker, quiet-hours 09–20 IST. Complements (does not
-- replace) the email/WhatsApp activation nudges (activation_nudges).
--
-- The registry defaults flags to enabled=true and isFeatureEnabled() is FAIL-OPEN for
-- unknown keys, so this opt-in flag MUST be pre-seeded disabled AND listed in
-- FAIL_CLOSED_KEYS. The boot upsert never overwrites an existing row's enabled.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'tithi_proactive',
  'Tithi Proactive Nudges',
  'Tithi proactively drops in-app nudges in a host''s bell for a resolvable blocker (verification stuck, no live service, earnings waiting, plan expiring). Off = no proactive nudges. In-app only, deduped per host per blocker.',
  'Support',
  'vendor',
  false
)
ON CONFLICT (key) DO NOTHING;
