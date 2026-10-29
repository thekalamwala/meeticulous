-- v3.101_booking_disputes.sql — admin dispute queue for bookings.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Records a dispute/problem on a booking so admins can see, hold the host payout,
-- and resolve. A dispute is raised by:
--   'guest'    — customer clicked "Report a problem"
--   'admin'    — an admin manually held/reversed the payout
--   'razorpay' — a Razorpay dispute.* webhook (chargeback)
-- payout_action records what happened to the held Route transfer at raise time
-- ('reversed' | 'none'). status open → resolved (admin adds a resolution note).
--
-- Additive; RLS on with NO policy (service_role bypasses — the server is the only
-- reader/writer, mirroring kyc_submissions / bot_escalations). Code keeps a schema
-- fallback (degrades to the existing adminAlert email) until applied on both DBs.

CREATE TABLE IF NOT EXISTS booking_disputes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL,
  raised_by     TEXT NOT NULL CHECK (raised_by IN ('guest', 'admin', 'razorpay')),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  payout_action TEXT,                       -- 'reversed' | 'none'
  resolution    TEXT,
  resolved_by   UUID,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_disputes_status_idx  ON booking_disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_disputes_booking_idx ON booking_disputes (booking_id);

ALTER TABLE booking_disputes ENABLE ROW LEVEL SECURITY;
