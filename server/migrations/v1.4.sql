-- ============================================================
-- Book A Sloth — v1.4 Migration
-- Run in Supabase SQL Editor before deploying v1.4
-- ============================================================

-- ── Payout requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  notes       TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_host ON payout_requests(host_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- RLS: hosts see own requests only; admin (service role) sees all
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts see own payout requests" ON payout_requests
  FOR SELECT USING (auth.uid() = host_id);
CREATE POLICY "Hosts can create payout requests" ON payout_requests
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- ── Supabase Storage bucket ──────────────────────────────────
-- Step 1: Create the bucket in Supabase Dashboard → Storage → New Bucket
--   Name: images  |  Public: ON  |  File size limit: 2097152  |  MIME: image/jpeg,image/png,image/webp

-- Step 2: Run these storage RLS policies in the SQL Editor:

-- Allow any authenticated user to upload (INSERT) into the images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('images', 'images', true, 2097152, ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'images');

-- Allow public read (needed to show uploaded images)
CREATE POLICY "Public can view images"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Allow users to update/overwrite their own uploads
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'images');

-- Allow users to delete their own uploads
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'images');
