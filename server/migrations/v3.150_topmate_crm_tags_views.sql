-- ============================================================
-- v3.150 — Topmate outbound: seed CRM tag catalog + saved segments.
--
-- Pure DATA seed for founder-led outbound to the Topmate prospect list.
-- No schema change: `leads.tags` (v3.105) + `crm_tags` (v3.108) + `crm_views`
-- (v3.111) already exist. This just gives the Topmate tags a colour and saves
-- the reusable lead-list segments the founder emails from.
--
-- The actual leads are loaded separately by scripts/importTopmateLeads.js
-- (PII CSV, never committed) — this file is safe to run before OR after that.
--
-- Idempotent. Run staging (Tokyo xwvciqkayammbvsidqig) → prod (Mumbai
-- ayjhlwyzszykqtnaktpb), the same order as every migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tag catalog — colours for the Topmate cohort's chips.
--    ON CONFLICT DO UPDATE so a tag already auto-created (grey) by a lead
--    write gets its intended colour. Palette keys (v3.108): gray|brown|orange
--    |yellow|green|blue|purple|pink|red|teal.
-- ------------------------------------------------------------
INSERT INTO crm_tags (name, color, created_by) VALUES
  ('topmate',            'purple', 'seed'),  -- every lead from the Topmate dataset
  ('verified-email',     'teal',   'seed'),  -- has a real, deliverable email
  ('business-email',     'blue',   'seed'),  -- on-domain / professional address
  ('personal-email',     'gray',   'seed'),  -- free provider (gmail/outlook/…)
  ('potential-switcher', 'green',  'seed'),  -- owns a branded domain + on-domain email
  ('high-priority',      'red',    'seed'),  -- grade A: verified + on-domain email + site
  ('nurture',            'brown',  'seed'),  -- not email-ready yet
  -- data-grade of the source pair (verified LinkedIn ↔ email). Lets you email the
  -- verified A/B set confidently and hold grade-d (unconfirmed pairing) for review.
  ('grade-a', 'red',    'seed'),
  ('grade-b', 'orange', 'seed'),
  ('grade-c', 'teal',   'seed'),
  ('grade-d', 'pink',   'seed'),
  -- inferred profession/type (best-effort at import; low-confidence flagged in attributes)
  ('coach',      'yellow', 'seed'),
  ('mentor',     'yellow', 'seed'),
  ('consultant', 'yellow', 'seed'),
  ('creator',    'yellow', 'seed'),
  ('developer',  'yellow', 'seed'),
  ('designer',   'yellow', 'seed'),
  ('finance',    'yellow', 'seed'),
  ('health',     'yellow', 'seed'),
  ('career',     'yellow', 'seed'),
  ('product',    'yellow', 'seed'),
  ('marketing',  'yellow', 'seed'),
  ('founder',    'yellow', 'seed')
ON CONFLICT (lower(name)) DO UPDATE SET color = EXCLUDED.color, updated_at = now();

-- ------------------------------------------------------------
-- 2. Saved segments — dynamic lens over the leads list. Resolved fresh on
--    open (SalesLeads.applyView → listLeads), so "Ready to Contact" shrinks
--    automatically as leads move off status='new'. definition shape (v3.111):
--    { viewType, filters:{ smartView, stage, source, tag, q } }.
-- ------------------------------------------------------------
INSERT INTO crm_views (name, definition, created_by) VALUES
  ('Topmate — All Prospects',
   '{"viewType":"table","filters":{"tag":"topmate"}}', 'seed'),
  ('Topmate — Ready to Contact',
   '{"viewType":"table","filters":{"tag":"topmate","stage":"new"}}', 'seed'),
  ('Topmate — High Priority',
   '{"viewType":"table","filters":{"tag":"high-priority","stage":"new"}}', 'seed'),
  ('Topmate — Potential Switchers',
   '{"viewType":"table","filters":{"tag":"potential-switcher","stage":"new"}}', 'seed'),
  ('Topmate — Business Email',
   '{"viewType":"table","filters":{"tag":"business-email"}}', 'seed'),
  ('Topmate — Personal Email',
   '{"viewType":"table","filters":{"tag":"personal-email"}}', 'seed'),
  ('Topmate — Verified (A/B)',
   '{"viewType":"table","filters":{"tag":"verified-email","stage":"new"}}', 'seed'),
  ('Topmate — Verify First (D)',
   '{"viewType":"table","filters":{"tag":"grade-d","stage":"new"}}', 'seed')
ON CONFLICT (lower(name)) DO UPDATE SET definition = EXCLUDED.definition, updated_at = now();

-- ============================================================
-- End v3.150
-- ============================================================
