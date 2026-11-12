-- v3.205: Lock down profiles column exposure to the public anon key. [SECURITY / P0]
--
-- VULN (confirmed live 2026-11-12): the "Profiles are viewable by everyone" RLS
-- policy is USING (true) for roles {anon, authenticated}, and the anon role held
-- a table-wide SELECT grant on public.profiles. The publishable anon key ships in
-- the client bundle by design, so ANYONE could run
--   supabase.from('profiles').select('email, phone, date_of_birth, admin_notes,
--                                      billing_details, google_id, ...')
-- and dump that for EVERY user. Verified as role anon: all rows + all PII columns
-- (email/phone/admin_notes) were readable.
--
-- WHY SAFE TO RESTRICT: the client uses supabase-js for OAuth + realtime broadcast
-- only — it never reads `profiles` (or any table) through supabase-js/PostgREST.
-- All profile data is served by the Express API using the service-role key, which
-- bypasses RLS and column grants. So anon/authenticated column SELECT can be
-- removed with zero app impact.
--
-- FIX: drop the table-wide SELECT grant; re-grant SELECT only on public display
-- columns. A column-list GRANT does NOT auto-cover columns added later, so every
-- future column defaults to hidden from anon/authenticated (fail-safe) until it is
-- explicitly granted. Server reads (service_role) are untouched. The RLS policies
-- are left as-is; column grants are the correct mechanism for column-level hiding.
--
-- Idempotent: REVOKE/GRANT are safe to re-run.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, name, username, first_name, last_name,
  bio, tagline, profession, primary_category, location, map_link,
  profile_image, cover_image, background_key, theme_color,
  social_links, badges, is_verified, is_host, vendor_type, categories,
  booking_type, invite_slug, onboarding_slug,
  seo_title, seo_description, seo_image, is_indexable,
  og_title, og_description, og_image
) ON public.profiles TO anon, authenticated;
