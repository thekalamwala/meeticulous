-- v3.128 — Backfill bookings.guest_id from the OTP-verified phone.
--
-- Bookings placed while logged-out store no guest_id; the guest's identity lives
-- only in guest_phone (OTP-verified at booking time via the booking grant). The
-- guest console (getGuestBookings) now also matches such rows by phone at query
-- time, but attribution stays NULL for every OTHER reader (analytics, CRM, admin).
--
-- This claims each NULL-guest_id row onto the profile whose phone matches, but
-- ONLY when exactly one profile owns that phone — no guessing on shared/duplicate
-- numbers. Match is on the last 10 digits because guest_phone / profiles.phone are
-- stored inconsistently (8637758344 / +91… / 91…). Idempotent and re-runnable:
-- touches only rows where guest_id IS NULL.

UPDATE bookings b
SET    guest_id = p.id
FROM   profiles p
WHERE  b.guest_id IS NULL
  AND  b.guest_phone IS NOT NULL
  AND  length(regexp_replace(b.guest_phone, '\D', '', 'g')) >= 10
  AND  p.phone IS NOT NULL
  AND  right(regexp_replace(p.phone,        '\D', '', 'g'), 10)
     = right(regexp_replace(b.guest_phone,  '\D', '', 'g'), 10)
  AND (
        SELECT count(*) FROM profiles p2
        WHERE  p2.phone IS NOT NULL
          AND  right(regexp_replace(p2.phone,       '\D', '', 'g'), 10)
             = right(regexp_replace(b.guest_phone,  '\D', '', 'g'), 10)
      ) = 1;
