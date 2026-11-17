-- v3.219 — seed the membership_purchase SAFETY flag OFF (paid membership checkout, M6).
-- Additive, idempotent. The registry also creates it OFF on boot; this guarantees the
-- row exists before the first paid subscribe ships. APPLY TO the Meeticulous DB.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'membership_purchase',
  'Membership Purchase',
  'Paid membership checkout (Razorpay recurring). SAFETY kill-switch. Ships OFF.',
  'Community',
  'both',
  false
)
ON CONFLICT (key) DO NOTHING;
