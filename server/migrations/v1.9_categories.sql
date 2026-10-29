-- v1.9 — Vendor categories / professions registry
-- Replaces the hardcoded CATEGORIES array in CategoryStep.jsx with a DB-backed,
-- admin-managed, vendor-suggestable list.
--
-- status:
--   'active'   — visible in the onboarding picker
--   'pending'  — vendor-suggested custom category awaiting admin approval
--   'rejected' — admin declined; kept for audit, never shown
--
-- All reads/writes go through the server (service role), so no RLS policies are
-- required for the app to function. Enable RLS to deny direct anon access.

CREATE TABLE IF NOT EXISTS categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  label        text NOT NULL,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'pending', 'rejected')),
  sort_order   integer NOT NULL DEFAULT 100,
  suggested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Seed the original onboarding categories as active.
INSERT INTO categories (slug, label, sort_order, status) VALUES
  ('coaching',     'Coaching & Mentoring',  10, 'active'),
  ('consulting',   'Consulting',            20, 'active'),
  ('tutoring',     'Tutoring & Education',  30, 'active'),
  ('wellness',     'Wellness & Fitness',    40, 'active'),
  ('music',        'Music Lessons',         50, 'active'),
  ('photography',  'Photography',           60, 'active'),
  ('design',       'Design Services',       70, 'active'),
  ('writing',      'Writing & Content',     80, 'active'),
  ('tech',         'Tech & Programming',    90, 'active'),
  ('beauty',       'Beauty & Styling',     100, 'active'),
  ('other',        'Other',                999, 'active')
ON CONFLICT (slug) DO NOTHING;
