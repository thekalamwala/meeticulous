-- ============================================================
-- v3.151 — Topmate campaign audiences (segments over the prospect contacts).
--
-- Companion to v3.150 (lead-side crm_views). These are `segments` — audiences
-- the CAMPAIGN composer targets. They resolve against `contacts` of
-- contact_type='prospect' filtered by the lead tags now mirrored onto the
-- contact (attributes.tags, via contactsService.buildLeadContactRow). Empty
-- until the prospects are opted-in + synced (post-deploy runbook).
--
-- Adds a unique index on segments.name so "Save as campaign audience" and these
-- seeds are idempotent on name.
--
-- Additive, idempotent. Run staging (Tokyo) → prod (Mumbai).
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_segments_name ON segments (name);

INSERT INTO segments (name, description, definition, is_system)
SELECT v.name, v.descr,
  CASE WHEN v.tag IS NULL
    THEN '{"contact_type":"prospect"}'::jsonb
    ELSE jsonb_build_object(
      'contact_type', 'prospect',
      'filters', jsonb_build_array(jsonb_build_object('field', 'tags', 'op', 'contains', 'value', v.tag)))
  END,
  false
FROM (VALUES
  ('Topmate — All Prospects',        'Every Topmate prospect (opted-in)',          NULL),
  ('Topmate — Verified (A/B)',       'Verified LinkedIn + real email',             'verified-email'),
  ('Topmate — High Priority (A)',    'Grade A: on-domain email + site',            'high-priority'),
  ('Topmate — Grade B',              'Grade B prospects',                          'grade-b'),
  ('Topmate — Verify First (D)',     'Grade D: unconfirmed pairing — review',      'grade-d'),
  ('Topmate — Potential Switchers',  'Own a branded domain + on-domain email',     'potential-switcher'),
  ('Topmate — Business Email',       'On-domain / professional address',           'business-email'),
  ('Topmate — Personal Email',       'Free provider (gmail/outlook/…)',            'personal-email'),
  ('Topmate — Coaches',              'Profession: coach',                          'coach'),
  ('Topmate — Mentors',              'Profession: mentor',                         'mentor'),
  ('Topmate — Consultants',          'Profession: consultant',                     'consultant'),
  ('Topmate — Creators',             'Profession: creator',                        'creator'),
  ('Topmate — Developers',           'Profession: developer',                      'developer'),
  ('Topmate — Designers',            'Profession: designer',                       'designer'),
  ('Topmate — Finance',              'Profession: finance',                        'finance'),
  ('Topmate — Health',               'Profession: health',                         'health'),
  ('Topmate — Career',               'Profession: career',                         'career'),
  ('Topmate — Product',              'Profession: product',                        'product'),
  ('Topmate — Marketing',            'Profession: marketing',                      'marketing'),
  ('Topmate — Founders',             'Profession: founder',                        'founder')
) AS v(name, descr, tag)
ON CONFLICT (name) DO UPDATE
  SET definition = EXCLUDED.definition, description = EXCLUDED.description, updated_at = now();

-- ============================================================
-- End v3.151
-- ============================================================
