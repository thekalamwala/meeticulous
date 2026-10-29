-- v3.21 — Industry categories taxonomy (phased 20/20/20)
-- - Adds group_label; extends status enum with 'disabled' (OFF/red)
-- - Replaces the 11-row v1.9 seed with the curated 60 (20 active / 40 disabled)
-- - Adds profiles.primary_category (the designated Primary)
-- - Clears host category arrays that referenced the old slugs (replace-entirely)
-- - Adds a per-plan `categories` limit (0=locked, N=self-manage cap)
-- - Adds admin_category_stats() for the admin table analytics

BEGIN;

-- 1) categories: group_label + extended status enum --------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_label text;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_status_check;
ALTER TABLE categories ADD CONSTRAINT categories_status_check
  CHECK (status IN ('active', 'disabled', 'pending', 'rejected'));

-- 2) Replace the seed entirely ----------------------------------------------
DELETE FROM categories;

INSERT INTO categories (slug, label, group_label, sort_order, status) VALUES
  -- Day 1 — active (20)
  ('software-engineer',        'Software Engineer',        'Technology & Product',  10,  'active'),
  ('product-manager',          'Product Manager',          'Technology & Product',  20,  'active'),
  ('ux-designer',              'UX Designer',              'Technology & Product',  30,  'active'),
  ('data-scientist',           'Data Scientist',           'Technology & Product',  40,  'active'),
  ('ai-engineer',              'AI Engineer',              'Technology & Product',  50,  'active'),
  ('career-coach',             'Career Coach',             'Coaching & Consulting', 60,  'active'),
  ('life-coach',               'Life Coach',               'Coaching & Consulting', 70,  'active'),
  ('executive-coach',          'Executive Coach',          'Coaching & Consulting', 80,  'active'),
  ('leadership-coach',         'Leadership Coach',         'Coaching & Consulting', 90,  'active'),
  ('business-coach',           'Business Coach',           'Coaching & Consulting', 100, 'active'),
  ('psychologist',             'Psychologist',             'Health & Wellness',     110, 'active'),
  ('nutritionist',             'Nutritionist',             'Health & Wellness',     120, 'active'),
  ('speech-therapist',         'Speech Therapist',         'Health & Wellness',     130, 'active'),
  ('language-tutor',           'Language Tutor',           'Education',             140, 'active'),
  ('ielts-coach',              'IELTS Coach',              'Education',             150, 'active'),
  ('study-abroad-consultant',  'Study Abroad Consultant',  'Education',             160, 'active'),
  ('financial-advisor',        'Financial Advisor',        'Business Services',     170, 'active'),
  ('startup-advisor',          'Startup Advisor',          'Business Services',     180, 'active'),
  ('business-consultant',      'Business Consultant',      'Business Services',     190, 'active'),
  ('hr-consultant',            'HR Consultant',            'Business Services',     200, 'active'),
  -- Day 30 — disabled (20)
  ('content-creator',          'Content Creator',          'Marketing & Creative',  210, 'disabled'),
  ('content-writer',           'Content Writer',           'Marketing & Creative',  220, 'disabled'),
  ('digital-marketer',         'Digital Marketer',         'Marketing & Creative',  230, 'disabled'),
  ('social-media-manager',     'Social Media Manager',     'Marketing & Creative',  240, 'disabled'),
  ('brand-consultant',         'Brand Consultant',         'Marketing & Creative',  250, 'disabled'),
  ('graphic-designer',         'Graphic Designer',         'Marketing & Creative',  260, 'disabled'),
  ('voice-artist',             'Voice Artist',             'Marketing & Creative',  270, 'disabled'),
  ('music-producer',           'Music Producer',           'Marketing & Creative',  280, 'disabled'),
  ('astrologer',               'Astrologer',               'Spiritual & Wellness',  290, 'disabled'),
  ('tarot-reader',             'Tarot Reader',             'Spiritual & Wellness',  300, 'disabled'),
  ('reiki-practitioner',       'Reiki Practitioner',       'Spiritual & Wellness',  310, 'disabled'),
  ('architect',                'Architect',                'Design & Advisory',     320, 'disabled'),
  ('interior-designer',        'Interior Designer',        'Design & Advisory',     330, 'disabled'),
  ('fashion-stylist',          'Fashion Stylist',          'Design & Advisory',     340, 'disabled'),
  ('music-teacher',            'Music Teacher',            'Teaching & Skills',     350, 'disabled'),
  ('dance-teacher',            'Dance Teacher',            'Teaching & Skills',     360, 'disabled'),
  ('art-teacher',              'Art Teacher',              'Teaching & Skills',     370, 'disabled'),
  ('coding-instructor',        'Coding Instructor',        'Teaching & Skills',     380, 'disabled'),
  ('public-speaking-coach',    'Public Speaking Coach',    'Teaching & Skills',     390, 'disabled'),
  ('communication-coach',      'Communication Coach',      'Teaching & Skills',     400, 'disabled'),
  -- Day 60 — disabled (20, offline hosts)
  ('makeup-artist',            'Makeup Artist',            'Offline Hosts',         410, 'disabled'),
  ('hair-stylist',             'Hair Stylist',             'Offline Hosts',         420, 'disabled'),
  ('nail-artist',              'Nail Artist',              'Offline Hosts',         430, 'disabled'),
  ('tattoo-artist',            'Tattoo Artist',            'Offline Hosts',         440, 'disabled'),
  ('photographer',             'Photographer',             'Offline Hosts',         450, 'disabled'),
  ('videographer',             'Videographer',             'Offline Hosts',         460, 'disabled'),
  ('physiotherapist',          'Physiotherapist',          'Offline Hosts',         470, 'disabled'),
  ('dentist',                  'Dentist',                  'Offline Hosts',         480, 'disabled'),
  ('dermatologist',            'Dermatologist',            'Offline Hosts',         490, 'disabled'),
  ('doctor',                   'Doctor',                   'Offline Hosts',         500, 'disabled'),
  ('yoga-trainer',             'Yoga Trainer',             'Offline Hosts',         510, 'disabled'),
  ('fitness-coach',            'Fitness Coach',            'Offline Hosts',         520, 'disabled'),
  ('dance-studio',             'Dance Studio',             'Offline Hosts',         530, 'disabled'),
  ('music-academy',            'Music Academy',            'Offline Hosts',         540, 'disabled'),
  ('coworking-space-owner',    'Coworking Space Owner',    'Offline Hosts',         550, 'disabled'),
  ('event-planner',            'Event Planner',            'Offline Hosts',         560, 'disabled'),
  ('wedding-planner',          'Wedding Planner',          'Offline Hosts',         570, 'disabled'),
  ('spa-owner',                'Spa Owner',                'Offline Hosts',         580, 'disabled'),
  ('salon-owner',              'Salon Owner',              'Offline Hosts',         590, 'disabled'),
  ('recording-studio-owner',   'Recording Studio Owner',   'Offline Hosts',         600, 'disabled');

-- 3) profiles.primary_category (new column → NULL for all existing rows) ------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_category text;

-- 4) Clear orphaned category arrays referencing the old v1.9 slugs ------------
UPDATE profiles SET categories = '[]'::jsonb
WHERE categories ?| array[
  'coaching','consulting','tutoring','wellness','music',
  'photography','design','writing','tech','beauty','other'
];

-- 5) Per-plan category cap (0=locked, 1=creator swap, 3=professional) ---------
UPDATE subscription_plans
SET limits = coalesce(limits, '{}'::jsonb) || jsonb_build_object(
  'categories',
  CASE slug WHEN 'creator' THEN 1 WHEN 'professional' THEN 3 ELSE 0 END
);

-- 6) Analytics RPC: registered hosts + active services per category ----------
CREATE OR REPLACE FUNCTION admin_category_stats()
RETURNS TABLE (slug text, registered_hosts bigint, active_services bigint)
LANGUAGE sql STABLE AS $$
  SELECT c.slug,
    (SELECT count(*) FROM profiles p WHERE p.categories ? c.slug) AS registered_hosts,
    (SELECT count(*) FROM services s
       JOIN profiles p2 ON s.host_id = p2.id
       WHERE s.is_active = true AND p2.categories ? c.slug) AS active_services
  FROM categories c;
$$;

COMMIT;
