-- ============================================================
-- v2.2 — Final commission, fees & payout model
-- (Applied to live DB via MCP on 2026-06-10.)
--
-- Money model:
--   Customer pays = service_price + platform_fee + GST(platform_fee)
--   Platform fee  = flat, admin-configurable (default ₹10), 0 for free services
--   GST           = 18% of platform_fee (tax liability, not platform revenue)
--   Razorpay fee  = ALWAYS borne by the vendor, recorded ACTUAL from capture
--   Vendor payout = service_price − commission − actual_razorpay_fee
--   Commission    = plan.commission_percentage % of service_price
--                   (read from subscription_plans; 5% free, 0% paid)
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_gst    NUMERIC(10,2) NOT NULL DEFAULT 0;  -- GST on platform fee
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_fee_actual NUMERIC(10,2) NOT NULL DEFAULT 0;  -- actual PG fee, vendor-borne
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_total      NUMERIC(10,2) NOT NULL DEFAULT 0;  -- what the customer paid
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gst_rate            NUMERIC(5,4)  NOT NULL DEFAULT 0.18;-- snapshot of GST rate used

INSERT INTO platform_settings (key, value) VALUES
  ('platform_fee', '10'),
  ('platform_fee_gst_rate', '0.18')
ON CONFLICT (key) DO NOTHING;
