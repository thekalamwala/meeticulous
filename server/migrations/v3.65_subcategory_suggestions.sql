-- v3.65 — host-suggested subcategories
-- Per-profession opt-in gate (curated professions stay locked).
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS allow_subcategory_suggestions BOOLEAN NOT NULL DEFAULT false;

-- Subcategory lifecycle. Existing rows default to 'active'.
ALTER TABLE service_categories
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Fast lookup of a profession's pending queue.
CREATE INDEX IF NOT EXISTS idx_service_categories_status
  ON service_categories (primary_category, status);
