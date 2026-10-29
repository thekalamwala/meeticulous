-- ============================================================================
-- Host profile tweaks: Shubham N Datarkar (id 6dbf6aac-6580-41d9-a8dd-6ba3b9609f32)
-- Date: 2026-09-11   Target: PROD (Mumbai).  DATA CHANGE ONLY.
-- ============================================================================
--
-- HONEST SCOPE: the host page already scores well (~90 SEO / ~87 GEO). Its only
-- real remaining point losses are (a) evidence = 0 reviews and (b) no search
-- traffic yet — NEITHER is a profile field. See the reviews template + GSC steps
-- for those. This file is POLISH, low score impact:
--   - bio: replace the promo CTA blurb with a real bio (readability + GEO entity
--     clarity + it's the Person.description fallback and host content-model text).
--   - seo_title / og_title / og_description: currently NULL → auto-fallbacks are
--     fine, but set them so the <title> and social card are controlled, not derived.
--     (Verified used: client/src/utils/seo.js:105-114.)
--
-- Leaves seo_description (already good, 147 chars) and seo_image (profile_image
-- fallback is fine) untouched.
--
-- Backup before running:
--   \copy (select id, bio, seo_title, seo_description, og_title, og_description
--          from profiles where id='6dbf6aac-6580-41d9-a8dd-6ba3b9609f32')
--     to 'sndatarkar_profile_backup_2026-09-11.csv' csv header;
-- ============================================================================

begin;

update profiles set
  bio = $b$I'm Shubham Datarkar, founder of Book A Sloth — the calm, zero-commission way for India's creators and professionals to sell their time. I build the product, write about what I learn along the way, and help creators turn scattered bookings into a real business. Based in Nagpur. Book a call if you'd like a walkthrough of the platform, straight-talking SEO and growth advice, or just to swap ideas — I'd rather handle your onboarding while you handle the applause. Off the clock: games.$b$,
  seo_title = $b$Shubham Datarkar — Creator of Book A Sloth$b$,
  og_title = $b$Shubham Datarkar — Creator of Book A Sloth$b$,
  og_description = $b$Founder of Book A Sloth, the zero-commission booking platform for India's creators & pros. Book a walkthrough, SEO advice, or a chat.$b$,
  seo_updated_at = now(), seo_updated_by = 'sql:sndatarkar-content-2026-09-11', updated_at = now()
where id = '6dbf6aac-6580-41d9-a8dd-6ba3b9609f32';

commit;
