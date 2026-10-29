-- v3.28 — Privatize the products storage bucket + stop public bucket listing
-- ============================================================================
-- SECURITY (audit H4 + L4)
--
-- H4: paid digital-product files lived in a PUBLIC storage bucket, so the
-- per-purchase paid/expiry/3-download gate in downloadProduct was bypassable —
-- anyone with (or guessing) the object URL could download forever. The app code
-- now mints short-lived (60s) SIGNED URLs in downloadProduct/freeDownload, which
-- work on a private bucket, so we can safely make the bucket private.
--
-- L4: the linter flagged broad "list everything" SELECT policies on
-- storage.objects for both buckets. For the (still public) images bucket this
-- only enables enumeration — direct object-URL GET keeps working without it. For
-- the now-private products bucket it removes anon read entirely.
--
-- ⚠️ DEPLOY ORDER: run this ONLY together with / after the signed-URL code is
-- live (this branch). Running it against a server still returning raw public
-- URLs would break product downloads. Applied to STAGING on 2026-06-23; apply to
-- PROD (ayjhlwyzszykqtnaktpb) at deploy time.
-- ============================================================================

-- Make the products bucket private — object GET now requires a signed URL.
update storage.buckets set public = false where id = 'products';

-- Remove the broad listing policies flagged by the linter.
drop policy if exists "Public can view product files" on storage.objects;
drop policy if exists "Public can view images" on storage.objects;
