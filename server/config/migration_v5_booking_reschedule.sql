-- Run in Supabase SQL Editor
-- Adds reminder flags and guest acknowledgement fields for reschedules.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_status TEXT DEFAULT 'none'
  CHECK (reschedule_status IN ('none', 'awaiting_guest_ack', 'acknowledged'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_ack_token TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bookings_reschedule_ack_token_idx
  ON bookings(reschedule_ack_token)
  WHERE reschedule_ack_token IS NOT NULL;
