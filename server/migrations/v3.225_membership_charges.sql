-- v3.225_membership_charges.sql — one row per successful membership charge.
-- Idempotent. Apply on the live DB (spquowzrefozmrzoszkf).
--
-- WHY. Until now a membership charge left no trace on our side: the webhook moved
-- community_membership_subscriptions.current_period_end forward and dropped the
-- payment entity on the floor. Razorpay billed the member every month and we held
-- no record of the amount, the payment id, the commission, or the withholding.
--
-- Everything downstream reads rows, so membership revenue was invisible to all of it:
--   routeAutoPayoutService  needs a payment id to attach a Route transfer to
--   settlementService       sums bookings.vendor_amount for the withdrawable balance
--   withholdingReportService reads per-row tds_amount / tcs_amount for the filings
--   gstExportService        reads the per-row fee + commission GST
-- This table is the missing record. It carries the same money columns a booking
-- does, so those consumers can union it in rather than grow a second money model.
--
-- The money snapshot is computed by lib/pricingEngine.js — the same engine bookings
-- use — so commission, TDS and TCS come out identical for the same host. A membership
-- charges no platform fee on top (the tier price IS what Razorpay bills), so
-- platform_fee_amount is 0 and customer_total equals the amount charged.
--
-- Additive only; the writer keeps a schema fallback (a missing table degrades to a
-- logged no-op) so entitlement is never blocked by this not being applied yet.

CREATE TABLE IF NOT EXISTS membership_charges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  member_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  host_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  tier_id                 UUID REFERENCES community_membership_tiers(id) ON DELETE SET NULL,
  subscription_row_id     UUID REFERENCES community_membership_subscriptions(id) ON DELETE SET NULL,

  -- 'subscription' = a recurring charge; 'upgrade' = the one-time prorated difference.
  kind                    TEXT NOT NULL DEFAULT 'subscription'
                            CHECK (kind IN ('subscription', 'upgrade')),

  razorpay_subscription_id TEXT,
  razorpay_payment_id      TEXT,
  razorpay_order_id        TEXT,

  -- Money, in rupees, mirroring bookings. customer_total is what the member paid.
  customer_total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- always 0 today: no fee on top of a tier price
  platform_fee_gst        NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_applied      NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_gst          NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_taxable      NUMERIC(12,2),
  commission_percentage   NUMERIC(5,2),
  razorpay_fee_actual     NUMERIC(12,2) NOT NULL DEFAULT 0,
  razorpay_tax_actual     NUMERIC(12,2) NOT NULL DEFAULT 0,
  tds_amount              NUMERIC(12,2),
  tcs_amount              NUMERIC(12,2),
  gst_rate                NUMERIC(5,4) NOT NULL DEFAULT 0.18,
  vendor_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,   -- what the host is owed
  host_plan_type          TEXT,                                -- plan the commission % came from

  payment_status          TEXT NOT NULL DEFAULT 'paid'
                            CHECK (payment_status IN ('paid', 'refunded')),
  paid_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded_amount         NUMERIC(12,2),
  refunded_at             TIMESTAMPTZ,

  -- Route payout bookkeeping, same shape and vocabulary as bookings (v3.98/v3.99)
  -- so one rail can drive both once it is generalised.
  settlement_status       TEXT NOT NULL DEFAULT 'pending_completion',
  razorpay_transfer_id    TEXT,
  transfer_status         TEXT,
  transfer_error          TEXT,
  transfer_hold_until     TIMESTAMPTZ,
  transfer_released_at    TIMESTAMPTZ,
  transfer_attempts       INTEGER NOT NULL DEFAULT 0,
  transfer_last_attempt_at TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- THE idempotency key. Razorpay redelivers webhooks, and the reconciler replays
-- them; one payment must never become two charge rows (which would be two payouts).
CREATE UNIQUE INDEX IF NOT EXISTS membership_charges_payment_uidx
  ON membership_charges (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- Same guard for the one-time upgrade order.
CREATE UNIQUE INDEX IF NOT EXISTS membership_charges_order_uidx
  ON membership_charges (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- One charge per Route transfer (mirrors bookings_transfer_uidx).
CREATE UNIQUE INDEX IF NOT EXISTS membership_charges_transfer_uidx
  ON membership_charges (razorpay_transfer_id)
  WHERE razorpay_transfer_id IS NOT NULL;

-- Host earnings reads: "what is owed to this host", newest first.
CREATE INDEX IF NOT EXISTS membership_charges_host_paid_idx
  ON membership_charges (host_id, paid_at DESC)
  WHERE payment_status = 'paid';

-- Statutory reports sweep a date range across all hosts.
CREATE INDEX IF NOT EXISTS membership_charges_paid_at_idx
  ON membership_charges (paid_at)
  WHERE payment_status = 'paid';

-- Release/reverse workers look for transfers still in flight.
CREATE INDEX IF NOT EXISTS membership_charges_transfer_pending_idx
  ON membership_charges (transfer_status)
  WHERE transfer_status = 'pending';

-- Service-role only, like every other money table here: RLS on, no policies.
-- The API reaches this through supabaseAdmin; the browser must never read another
-- member's charges or a host's payout maths.
ALTER TABLE membership_charges ENABLE ROW LEVEL SECURITY;
