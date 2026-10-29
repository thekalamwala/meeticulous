-- demoPersonaSeed.sql — bookable services for the /demo persona switch.
--
-- The public /demo host (username 'demo') shows a "view as" switcher that filters
-- services by SLUG (see client/src/data/demoPersonas.js → each persona's
-- serviceSlugs). This seeds 4 personas × 3 services so each persona has a real,
-- bookable set. Keep these slugs in sync with demoPersonas.js.
--
-- FREE (price 0) on purpose: the switch is PUBLIC, so any visitor can book these.
-- Free bookings skip Razorpay, so nobody is ever charged. To rehearse the payment
-- screen, do it on the local + staging test-mode setup, not here on prod.
--
-- category/primary_category are left NULL: services.(primary_category, category)
-- is a composite FK into service_categories, so arbitrary persona tags aren't
-- valid there. Both-null passes chk_category_pair and the FK (MATCH SIMPLE), and
-- the client matches on slug anyway. is_indexable=false keeps these out of the
-- sitemap. Idempotent (fixed UUIDs). Reset block at the bottom removes them.
--
-- Demo host id (prod Mumbai): 1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55

begin;

insert into services (id, host_id, title, slug, short_description, description, type, meeting_mode, duration, price, currency, is_active, is_indexable, rating, total_reviews, total_bookings) values
  -- Coach
  ('de300000-0000-4000-8000-00000000c001','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Career Clarity Call','demo-career-clarity-call','45-min 1:1 to unblock your next move.','A focused 1:1 to pin down your next role, pitch, and next step — you leave with a written plan.','one_on_one','online',45,0,'INR',true,false,4.9,3,41),
  ('de300000-0000-4000-8000-00000000c002','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Business Strategy Hour','demo-business-strategy-hour','60-min working session on your business.','One hour on the one problem holding your business back, with a concrete action list to leave with.','one_on_one','online',60,0,'INR',true,false,5.0,2,23),
  ('de300000-0000-4000-8000-00000000c003','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Mock Interview + Feedback','demo-mock-interview','Realistic mock interview with a scorecard.','A realistic mock interview for your target role, followed by direct feedback and a written scorecard.','one_on_one','online',60,0,'INR',true,false,4.8,4,31),
  -- Salon
  ('de300000-0000-4000-8000-0000000005a1','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Haircut & Style','demo-haircut-style','Cut, wash, and finish.','A fresh cut tailored to you, with a wash and a styled finish. Walk out event-ready.','one_on_one','online',45,0,'INR',true,false,4.9,6,88),
  ('de300000-0000-4000-8000-0000000005a2','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Bridal Makeup Trial','demo-bridal-makeup-trial','A full trial before the big day.','A relaxed trial to lock your bridal look — skin prep, base, eyes, and finish, exactly to your brief.','one_on_one','online',90,0,'INR',true,false,5.0,3,19),
  ('de300000-0000-4000-8000-0000000005a3','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Spa Facial','demo-spa-facial','Deep-clean, calm, and glow.','A calming facial matched to your skin — cleanse, exfoliate, mask, and finish. Leave glowing.','one_on_one','online',60,0,'INR',true,false,4.8,5,54),
  -- Wellness
  ('de300000-0000-4000-8000-00000000e001','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Therapy Session','demo-therapy-session','A confidential 1:1.','A calm, confidential space to talk things through with practical, judgement-free support.','one_on_one','online',50,0,'INR',true,false,5.0,7,120),
  ('de300000-0000-4000-8000-00000000e002','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Nutrition Consult','demo-nutrition-consult','Food plan that fits your life.','A no-fad nutrition consult — we build an eating plan around your goals and your actual routine.','one_on_one','online',45,0,'INR',true,false,4.9,4,37),
  ('de300000-0000-4000-8000-00000000e003','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','1:1 Yoga','demo-1-1-yoga','Private session at your level.','A private session built around your body and level — mobility, strength, and breath, at your pace.','one_on_one','online',60,0,'INR',true,false,4.9,3,28),
  -- Sports Arena
  ('de300000-0000-4000-8000-00000000a001','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','1-Hour Turf Slot','demo-turf-slot','Book the turf by the hour.','Reserve the full-size turf for an hour — 5s, 7s, or a kickabout. Instant slot, no calls.','one_on_one','online',60,0,'INR',true,false,4.8,9,210),
  ('de300000-0000-4000-8000-00000000a002','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Badminton Court','demo-badminton-court','Indoor court, per hour.','A well-lit indoor court by the hour. Bring your racket — we handle the rest.','one_on_one','online',60,0,'INR',true,false,4.9,6,142),
  ('de300000-0000-4000-8000-00000000a003','1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55','Cricket Practice Net','demo-cricket-net','Bowling machine optional.','A dedicated practice net by the hour, bowling machine on request. Perfect for a focused session.','one_on_one','online',60,0,'INR',true,false,4.7,5,96)
on conflict (id) do update set
  title=excluded.title, slug=excluded.slug, short_description=excluded.short_description,
  description=excluded.description, duration=excluded.duration, price=excluded.price,
  is_active=true, is_indexable=false,
  rating=excluded.rating, total_reviews=excluded.total_reviews, total_bookings=excluded.total_bookings,
  updated_at=now();

commit;

select left(slug, 24) slug, price, is_active from services
where host_id='1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55' and slug like 'demo-%' order by slug;


-- ============================================================================
-- RESET — remove all persona demo services (keeps the base /demo account).
-- ============================================================================
-- delete from services
--  where host_id = '1fc92e01-2e3d-4e4f-b47b-8f2dc257ec55'
--    and slug in ('demo-career-clarity-call','demo-business-strategy-hour','demo-mock-interview',
--                 'demo-haircut-style','demo-bridal-makeup-trial','demo-spa-facial',
--                 'demo-therapy-session','demo-nutrition-consult','demo-1-1-yoga',
--                 'demo-turf-slot','demo-badminton-court','demo-cricket-net');
