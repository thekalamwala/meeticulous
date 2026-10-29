-- v3.92 — bot_faqs.category
-- Final-FAQ admin page groups saved answers by category (Bookings, Payments, …).
-- Additive + backward-compatible: existing rows default to 'General'.
-- Run on BOTH prod (Mumbai ayjhlwyzszykqtnaktpb) and staging (Tokyo xwvciqkayammbvsidqig).
ALTER TABLE public.bot_faqs
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';
