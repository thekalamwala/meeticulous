-- v3.3_booking_reschedule.sql
-- google_event_id: lets reschedule move the existing Google Calendar event
--   (keeps the same Meet link) instead of orphaning it.
-- reschedule_count: guest-initiated reschedule counter — drives "first reschedule
--   free" fee logic and the admin abuse signal (badge at >= 3).
alter table bookings add column if not exists google_event_id text;
alter table bookings add column if not exists reschedule_count integer not null default 0;
