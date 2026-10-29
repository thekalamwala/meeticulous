-- v3.4_reschedule_fee.sql — per-vendor reschedule fee (0 or 10), platform-kept.
-- Default 0 ⇒ reschedules are free in production until a vendor opts in to ₹10.
-- The guest's FIRST reschedule is always free; the fee applies from the 2nd
-- onward (enforced in rescheduleBooking via reschedule_count).
alter table profiles add column if not exists reschedule_fee integer not null default 0;
