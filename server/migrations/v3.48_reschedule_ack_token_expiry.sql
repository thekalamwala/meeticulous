-- v3.48 — reschedule ack token expiry (audit P3-1)
--
-- The host-initiated reschedule ack token (emailed link the guest clicks to
-- acknowledge a new time) was unguessable + single-use but never expired — a
-- leaked/forwarded link worked indefinitely. Add an expiry column; the server
-- stamps now+7d when minting the token and rejects an expired token (410) in
-- confirmReschedule. Nullable: existing rows and guest-initiated moves (no token)
-- have no expiry.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reschedule_ack_token_expires_at timestamptz;
