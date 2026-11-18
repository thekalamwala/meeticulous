-- v3.224 Dashboard sections v2 feature flag — ships DORMANT (opt-in, default OFF).
-- Same posture as v3.223 (dashboard_v2): the registry defaults every flag to
-- enabled=true and isFeatureEnabled() is FAIL-OPEN, so an opt-in gate MUST be
-- pre-seeded disabled. The boot upsert preserves enabled=false (it never
-- overwrites an existing row's enabled).
-- Gates the graduated host-dashboard sections that were previously Host Lab
-- prototypes on mock data: Intelligence (Overview, Revenue) and the Community
-- console (Activity, Spaces, Answer). Routes are additive and only reachable /
-- rendered while this is ON, so flipping it back is a full revert.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'dashboard_sections_v2',
  'Dashboard sections v2 (Intelligence + Community)',
  'Graduates the Host Lab Intelligence and Community console sections onto REAL data: Intelligence > Overview + Revenue (live bookings), Community > Activity + Spaces + Answer (community API). Ships OFF. Off = the sections are hidden from the rail and their routes redirect to the dashboard home.',
  'Operations',
  'vendor',
  false
)
ON CONFLICT (key) DO NOTHING;
