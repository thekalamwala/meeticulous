-- ============================================================
-- v3.26 — Product links: external URL, uploaded-file metadata
-- (Renumbered from v2.9 on port to main — v2.9 is taken by v2.9_explore.sql.)
--
-- Purpose: Let products carry an external product URL plus the
--          name and size of an uploaded file (file itself lives
--          in the Supabase 'products' storage bucket; file_url
--          already exists from v1.6).
--
-- Additive only. Safe to re-run — uses IF NOT EXISTS / idempotent
-- comments and ON CONFLICT for the storage bucket.
-- Server code uses the schema-fallback pattern, so it works
-- before and after this migration is applied.
-- Run this in Supabase SQL Editor before deploying Wave 3.
-- ============================================================

-- ─── PRODUCTS: new columns ───────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_url      TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS file_name        TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS file_size_bytes  INTEGER;

COMMENT ON COLUMN products.product_url IS
  'Optional external URL for the product (landing page, store link, etc.). '
  'Distinct from file_url, which points at the downloadable asset.';
COMMENT ON COLUMN products.file_name IS
  'Original filename of the uploaded product file (for display only).';
COMMENT ON COLUMN products.file_size_bytes IS
  'Size in bytes of the uploaded product file (for display only).';

-- ─── SUPABASE STORAGE BUCKET: products ───────────────────────
-- Public bucket for uploaded product files (≤2 MB). Content is
-- validated server-side by extension allowlist + magic bytes, so
-- the bucket-level mime list is intentionally broad; the API is
-- the real gate.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('products', 'products', true, 2097152)  -- 2 MB
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152;

-- Storage RLS policies for the products bucket
DROP POLICY IF EXISTS "Authenticated users can upload product files" ON storage.objects;
CREATE POLICY "Authenticated users can upload product files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Public can view product files" ON storage.objects;
CREATE POLICY "Public can view product files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Authenticated users can update product files" ON storage.objects;
CREATE POLICY "Authenticated users can update product files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Authenticated users can delete product files" ON storage.objects;
CREATE POLICY "Authenticated users can delete product files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'products');

-- ─── Done ────────────────────────────────────────────────────
