-- v3.143_gst_exports_bucket.sql — private Storage bucket for GST CA packs (P4).
-- Packs contain PAN + financial data, so the bucket is PRIVATE (public=false):
-- no anon/authed access; the server uses the service role to write and to mint
-- short-lived signed URLs for the gst.export-gated download endpoint.
--
-- Idempotent. Apply on BOTH DBs (staging Tokyo + prod Mumbai).
insert into storage.buckets (id, name, public)
values ('gst-exports', 'gst-exports', false)
on conflict (id) do nothing;
