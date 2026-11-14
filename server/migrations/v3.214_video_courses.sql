-- v3.214 Video Courses — a Pro-gated billable product line.
-- A course is a structured, buy-once product: title/description/price + ordered
-- video lessons, watchable in-app by the buyer. Mirrors the digital-products
-- purchase rail (Razorpay one-time order + verify), but access is an in-app grant
-- (a course_purchases row), not an emailed download token.
--
-- Apply by hand on BOTH DBs (founder). Additive + RLS-on/no-policy/service-role
-- only, matching products/product_purchases. Code is schema-fallback safe until
-- applied everywhere.

-- ── courses ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  price          NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
  thumbnail_url  TEXT,
  slug           TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT false,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (host_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_courses_host_active ON courses(host_id) WHERE is_active;

-- ── course_lessons ───────────────────────────────────────────────
-- Ordered video lessons. video_url is any shareable video link (YouTube/Vimeo/
-- storage) — gated behind purchase, never returned on the public course view.
CREATE TABLE IF NOT EXISTS course_lessons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  video_url  TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_lessons_course ON course_lessons(course_id, sort_order);

-- ── course_purchases ─────────────────────────────────────────────
-- One row per paid buyer = the access grant. Unique on razorpay_order_id so the
-- verify path and the webhook safety-net can both run without double-issuing.
CREATE TABLE IF NOT EXISTS course_purchases (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  host_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_name         TEXT,
  buyer_email        TEXT,
  buyer_phone        TEXT,
  amount_paid        NUMERIC NOT NULL DEFAULT 0,
  platform_fee       NUMERIC NOT NULL DEFAULT 0,
  payment_status     TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  razorpay_order_id  TEXT,
  razorpay_payment_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (razorpay_order_id)
);
CREATE INDEX IF NOT EXISTS idx_course_purchases_buyer ON course_purchases(buyer_id) WHERE payment_status = 'paid';
CREATE INDEX IF NOT EXISTS idx_course_purchases_course ON course_purchases(course_id);

-- Atomic purchase_count bump (mirrors increment_product_purchase_count).
CREATE OR REPLACE FUNCTION increment_course_purchase_count(row_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE courses SET purchase_count = purchase_count + 1 WHERE id = row_id;
$$;
-- v3.186 lockdown posture: a new function gets PUBLIC EXECUTE by default, so the
-- anon/publishable key could call this to inflate purchase_count. Revoke that and
-- grant only service_role (the API calls it via supabaseAdmin).
REVOKE ALL ON FUNCTION increment_course_purchase_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_course_purchase_count(uuid) TO service_role;

-- RLS on, no policies → service_role only (all reads/writes go through the API).
ALTER TABLE courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons   ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_purchases ENABLE ROW LEVEL SECURITY;
