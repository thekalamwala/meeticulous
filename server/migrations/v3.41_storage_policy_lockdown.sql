-- v3.41 — Storage policy lockdown (audit P0-3)
--
-- BEFORE: the `images` and `products` storage buckets granted UPDATE / DELETE /
-- INSERT on storage.objects to the ENTIRE `authenticated` role, scoped only by
-- `bucket_id` (no owner check). Every logged-in user holds a real Supabase
-- GoTrue JWT (minted by the anon-key client), so any authenticated guest/host
-- could call the Storage REST API directly and delete or overwrite EVERY host's
-- profile photos, cover images, and service/product files — platform-wide media
-- destruction, bypassing the Express server entirely.
--
-- All legitimate writes go through the server (uploadController.js) using the
-- service_role key, which BYPASSES RLS. So these client-facing write policies
-- serve no purpose and are pure attack surface. Drop them.
--
-- Reads are unaffected: the `images` bucket stays public-readable; `products`
-- is private + signed-URL (v3.28) and its read path is unchanged.

DROP POLICY IF EXISTS "Authenticated users can delete images"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product files" ON storage.objects;
