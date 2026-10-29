-- v3.2_feature_flags.sql — generic admin kill-switches ("Feature Status")
create table if not exists feature_flags (
  key         text primary key,
  label       text not null,
  description text,
  category    text,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into feature_flags (key, label, description, category, enabled) values
  ('reschedule', 'Booking Reschedule',
   'Allow guests and vendors to reschedule bookings. Off = all reschedule blocked.',
   'bookings', true),
  ('reschedule_fee', 'Reschedule Fee Charging',
   'Charge guests the vendor-set reschedule fee from the 2nd reschedule onward. Off = all reschedules free.',
   'bookings', true)
on conflict (key) do nothing;
