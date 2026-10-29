-- Migration v1.5: atomic product purchase count increment (BUG-15 fix)
-- Run this in Supabase SQL editor before deploying the BUG-15 fix

CREATE OR REPLACE FUNCTION increment_product_purchase_count(row_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE products
  SET purchase_count = COALESCE(purchase_count, 0) + 1
  WHERE id = row_id;
$$;
