-- v3.117_route_autopilot.sql — flag: auto-approve KYC on submit + auto-onboard to
-- Razorpay Route, with humans handling only escalations (needs_clarification).
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Today a host's KYC waits for a manual admin approval before we create the Route
-- linked account. But Razorpay's linked-account activation IS the identity/bank
-- verification (PAN check + bank penny-drop), so the manual gate is duplicate work
-- and a bottleneck. With autopilot on, submit auto-approves and kicks off Route
-- onboarding immediately; payout eligibility still gates on route_activation_status
-- ='activated' (payoutEligibility), and admins only resolve escalations.
--
--   route_autopilot = false (default) → current behaviour (manual admin approval)
--   route_autopilot = true            → auto-approve on submit, auto-onboard, escalate-only
--
-- Code (platformConfig) defaults false when the row is absent, so this seed is only
-- for admin visibility/editability. Reversible — flip back to false any time.

INSERT INTO platform_settings (key, value)
VALUES ('route_autopilot', 'false')
ON CONFLICT (key) DO NOTHING;
