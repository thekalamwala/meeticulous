-- demoHostSeed.sql — reusable "generic but polished" demo host for sales demos.
--
-- WHY: sales needs a full end-to-end demo (real WhatsApp OTP guest login, real
-- booking flow, Razorpay in TEST mode) without spinning up a new account per
-- customer. One standalone host profile + services + reviews/stats, reused and
-- wiped between demos. Run on STAGING only (Tokyo xwvciqkayammbvsidqig) where
-- Razorpay uses test keys — NEVER prod.
--
-- The demo host is never logged into. You show the host dashboard from your own
-- account; the customer experiences the public profile + guest booking end-to-end
-- against this host. profiles.id FKs auth.users, so step 0 creates a confirmed
-- auth user purely to satisfy that FK (no password — nobody signs in as it).
--
-- Idempotent: fixed UUIDs + ON CONFLICT, so re-running just refreshes the data.
-- Reset (wipe live-demo bookings) is the block at the bottom — run it alone.
--
-- Deterministic IDs (so reset/re-run is surgical):
--   host    de510000-0000-4000-8000-000000000001
--   service de510000-0000-4000-8000-0000000000a1 / a2 / a3

begin;

-- 0) auth.users row — required by profiles_id_fkey. Confirmed, passwordless.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
) values (
  'de510000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'demo-host@meeticulous.com', now(),
  now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false
)
on conflict (id) do nothing;

-- 1) The host profile. paid_enabled=true so it passes paid-only visibility;
--    is_indexable=false so the demo never leaks into sitemap/SEO.
insert into profiles (
  id, name, first_name, last_name, email, username, role, is_host,
  paid_enabled, plan, onboarding_completed, whatsapp_verified,
  vendor_type, booking_type, bio, tagline, profession,
  profile_image, is_indexable, is_banned
) values (
  'de510000-0000-4000-8000-000000000001',
  'Aanya Kapoor', 'Aanya', 'Kapoor',
  'demo-host@meeticulous.com', 'demo-studio', 'host', true,
  true, 'professional', true, true,
  'individual', 'both',
  'Career & confidence coach helping early-career professionals land roles they actually want. 8 years, 500+ sessions. Book a slot below — first call is where it clicks.',
  'Career & Confidence Coach · 500+ sessions',
  'Career Coach',
  'https://api.dicebear.com/7.x/initials/svg?seed=Aanya%20Kapoor&backgroundColor=b6e3f4',
  false, false
)
on conflict (id) do update set
  name = excluded.name, first_name = excluded.first_name, last_name = excluded.last_name,
  username = excluded.username, is_host = true, paid_enabled = true,
  plan = excluded.plan, onboarding_completed = true, whatsapp_verified = true,
  vendor_type = excluded.vendor_type, booking_type = excluded.booking_type,
  bio = excluded.bio, tagline = excluded.tagline, profession = excluded.profession,
  profile_image = excluded.profile_image, is_indexable = false, is_banned = false,
  updated_at = now();

-- 2) Three polished services. Prices >= ₹100 (platform min). Established-looking
--    rating / total_reviews / total_bookings so the profile reads as active.
insert into services (
  id, host_id, title, slug, description, short_description,
  type, meeting_mode, duration, price, currency, is_active, is_indexable,
  rating, total_reviews, total_bookings
) values
  ('de510000-0000-4000-8000-0000000000a1', 'de510000-0000-4000-8000-000000000001',
   'Career Clarity Call', 'career-clarity-call',
   'A focused 45-minute 1:1 to pin down your next move — role, pitch, and the exact next step. You leave with a written plan.',
   '45-min 1:1 to unblock your next career move.',
   'one_on_one', 'online', 45, 499, 'INR', true, false, 4.9, 3, 41),
  ('de510000-0000-4000-8000-0000000000a2', 'de510000-0000-4000-8000-000000000001',
   'Mock Interview + Feedback', 'mock-interview-feedback',
   'A realistic 60-minute mock interview for your target role, followed by direct, specific feedback and a scorecard.',
   'Realistic mock interview with a written scorecard.',
   'one_on_one', 'online', 60, 1499, 'INR', true, false, 5.0, 2, 23),
  ('de510000-0000-4000-8000-0000000000a3', 'de510000-0000-4000-8000-000000000001',
   'Resume & LinkedIn Teardown', 'resume-linkedin-teardown',
   'Bring your resume and LinkedIn. In 30 minutes we rewrite the lines that matter so recruiters actually reply.',
   '30-min live rewrite of your resume + LinkedIn.',
   'one_on_one', 'online', 30, 799, 'INR', true, false, 4.8, 1, 15)
on conflict (id) do update set
  title = excluded.title, slug = excluded.slug, description = excluded.description,
  short_description = excluded.short_description, duration = excluded.duration,
  price = excluded.price, is_active = true, is_indexable = false,
  rating = excluded.rating, total_reviews = excluded.total_reviews,
  total_bookings = excluded.total_bookings, updated_at = now();

-- 3) A handful of visible reviews (booking_id NULL = seeded, so reset keeps them).
--    reviewer_id NULL renders as an anonymous guest — fine for a demo.
delete from reviews where host_id = 'de510000-0000-4000-8000-000000000001' and booking_id is null;
insert into reviews (id, host_id, subject_id, service_id, rating, comment, direction, status, created_at) values
  ('de510000-0000-4000-8000-0000000000f1','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-0000000000a1',5,'Walked in stuck, walked out with a plan. Booked my next call already.','guest_to_host','visible', now() - interval '9 days'),
  ('de510000-0000-4000-8000-0000000000f2','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-0000000000a2',5,'The mock interview was harder than the real one. Exactly what I needed.','guest_to_host','visible', now() - interval '6 days'),
  ('de510000-0000-4000-8000-0000000000f3','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-0000000000a1',5,'Clear, direct, zero fluff. Got two callbacks the week after.','guest_to_host','visible', now() - interval '4 days'),
  ('de510000-0000-4000-8000-0000000000f4','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-0000000000a3',4,'Rewrote my summary line on the call. Recruiters started replying.','guest_to_host','visible', now() - interval '2 days'),
  ('de510000-0000-4000-8000-0000000000f5','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-000000000001','de510000-0000-4000-8000-0000000000a2',5,'Best money I spent on my job switch. Highly recommend.','guest_to_host','visible', now() - interval '1 days')
on conflict (id) do nothing;

commit;

-- Confirm
select 'host' t, name::text v from profiles where id='de510000-0000-4000-8000-000000000001'
union all select 'services', count(*)::text from services where host_id='de510000-0000-4000-8000-000000000001'
union all select 'reviews', count(*)::text from reviews where host_id='de510000-0000-4000-8000-000000000001';


-- ============================================================================
-- RESET — run this block ALONE between demos to wipe live-demo bookings.
-- Keeps the host, services, and seeded reviews. Deletes real bookings the
-- customer made and any review tied to one.
-- ============================================================================
-- begin;
--   delete from reviews
--    where host_id = 'de510000-0000-4000-8000-000000000001'
--      and booking_id is not null;
--   delete from bookings
--    where host_id = 'de510000-0000-4000-8000-000000000001';
-- commit;
