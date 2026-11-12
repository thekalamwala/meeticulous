-- v3.203 Paid-booking-without-PAN feature flag — ships DORMANT (opt-in, default OFF).
-- The kill-switch registry (featureRegistry.js) defaults flags to enabled=true, and
-- isFeatureEnabled() is FAIL-OPEN (an unknown key returns ENABLED). So an opt-in flag
-- that gates MONEY behaviour MUST be pre-seeded disabled here; the boot upsert then
-- preserves enabled=false (it never overwrites an existing row's enabled).
--
-- When OFF (default): a paid booking is blocked until the host has PAN on file (legacy).
-- When ON: the booking is accepted, money is collected and HELD (payout still requires
-- approved KYC), and TDS is withheld at the no-PAN 5% rate (§206AA) instead of 1%.
-- DO NOT flip ON until the TDS/CA sign-off is confirmed.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'paid_booking_without_pan',
  'Paid Booking Without PAN',
  'Let a host take a PAID booking before KYC. Off = paid bookings blocked until the host has PAN on file (legacy). On = booking accepted, money collected and HELD (payout still needs approved KYC), TDS withheld at the no-PAN 5% rate (§206AA) instead of 1%.',
  'Payments',
  'vendor',
  false
)
ON CONFLICT (key) DO NOTHING;
