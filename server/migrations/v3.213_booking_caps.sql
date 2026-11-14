-- ============================================================
-- v3.213 — Host-configurable booking caps (Pro power-host control)
-- (renumbered from v3.207 to avoid collision with v3.207_bot_tool_loop_flag.sql;
--  already applied live on 2026-11-14 under the name `v3_207_booking_caps`.)
-- ------------------------------------------------------------
-- A host can cap how many bookings they take per day / per week, and how many
-- a single guest can ever make with them. A booking that would exceed a set cap
-- is blocked at creation (server/lib/bookingCaps.js, enforced inside the existing
-- booking-quota lock in bookingController.createBooking).
--
-- WHY `availability` (not a new table): this row is already the per-host booking-
-- rules record (timezone, buffer_minutes, blocked_dates) that createBooking loads
-- anyway, so caps ride along with zero new reads and the existing PUT /api/host/
-- availability endpoint persists them — no new table, route or join.
--
-- NULL = no cap (the default). A CHECK keeps any set value >= 1 (0 would block
-- every booking, which the UI never offers). Enforcement is Pro-gated in code; a
-- free host's values are ignored and the server strips them on save, so these
-- columns are simply dormant for free hosts.
--
-- Additive + nullable → the code is schema-fallback safe before this is applied:
-- `avail.cap_per_*` reads back undefined and bookingCaps treats that as "no cap".
-- ------------------------------------------------------------
ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS cap_per_day   integer,
  ADD COLUMN IF NOT EXISTS cap_per_week  integer,
  ADD COLUMN IF NOT EXISTS cap_per_guest integer;

ALTER TABLE availability
  DROP CONSTRAINT IF EXISTS availability_caps_positive,
  ADD  CONSTRAINT availability_caps_positive CHECK (
    (cap_per_day   IS NULL OR cap_per_day   >= 1) AND
    (cap_per_week  IS NULL OR cap_per_week  >= 1) AND
    (cap_per_guest IS NULL OR cap_per_guest >= 1)
  );
