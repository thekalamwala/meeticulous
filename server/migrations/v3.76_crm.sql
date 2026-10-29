-- v3.76_crm.sql — Studio Client CRM ("Host 360").
-- Thin host-authored layer over DERIVED clients (clients are aggregated from
-- bookings in-Node; these tables hold ONLY host-authored data keyed by a stable
-- customer_key). ALL statements additive + idempotent — safe on a live DB.
-- Apply on BOTH DBs (staging Tokyo xwvciqkayammbvsidqig FIRST, then prod Mumbai
-- ayjhlwyzszykqtnaktpb). Then create private Storage bucket 'customer-files' on both.

-- ── Core CRM tables ──────────────────────────────────────────────────────────
-- One row per (host, normalized customer key). id (UUID) is the public handle
-- used in URLs; customer_key ('p:<digits>' | 'e:<email>') stays server-side.
CREATE TABLE IF NOT EXISTS crm_customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_key TEXT NOT NULL,                 -- 'p:9876543210' | 'e:jane@x.com'
  attributes   JSONB NOT NULL DEFAULT '{}',   -- host tags / light custom fields (UI deferred)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (host_id, customer_key)
);

CREATE TABLE IF NOT EXISTS crm_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,                  -- PLAINTEXT (security decision A)
  booking_id  UUID,                           -- optional: pins a note to a booking (Phase 6, Task 15)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Idempotent add for DBs where crm_notes predates the booking_id column.
ALTER TABLE crm_notes ADD COLUMN IF NOT EXISTS booking_id UUID;

CREATE TABLE IF NOT EXISTS crm_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  host_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_key  TEXT NOT NULL,                 -- key in private 'customer-files' bucket
  file_name    TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   INT  NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_host ON crm_customers(host_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_customer ON crm_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_files_customer ON crm_files(customer_id);

-- RLS ENABLED, NO POLICIES = service-role only. anon/auth can never read/write.
-- (Respects supabase-anon-api-exposure: app reaches these ONLY via supabaseAdmin.)
ALTER TABLE crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_files     ENABLE ROW LEVEL SECURITY;

-- ── Plan limit: limits.crm (-1 unlimited, 0 not included) ────────────────────
-- Studio ('professional') AND ABOVE ('supreme', god-tier) get CRM. Everyone
-- else (starter, starter_legacy, creator) = 0. requireCrm allows only crm===-1.
UPDATE subscription_plans SET limits = jsonb_set(COALESCE(limits,'{}'), '{crm}', '-1') WHERE slug IN ('professional','supreme');
UPDATE subscription_plans SET limits = jsonb_set(COALESCE(limits,'{}'), '{crm}', '0')  WHERE slug IN ('starter','starter_legacy','creator');

-- ── Phase 6, Task 16: walk-in / manual cash bookings ─────────────────────────
-- Additive marker. Existing rows default 'platform' → zero behaviour change.
-- 'manual_cash' rows are INCLUDED in host revenue/CRM but EXCLUDED from every
-- PLATFORM aggregation (GMV, commission, settlement, payout, bookings_per_year,
-- public counts) — enforced in application code, see crmService/manualBooking.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'platform';
