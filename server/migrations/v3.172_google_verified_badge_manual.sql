-- v3.172_google_verified_badge_manual.sql
--
-- "Google Verified" is an ACCOUNT ATTRIBUTE (the host authenticated via Google),
-- not a metric-driven achievement. It had been configured as an AUTOMATIC badge
-- with the rule `revenue = 0`, so the badge engine auto-REVOKED it the moment a
-- host earned any revenue — which is why it was missing for exactly the hosts
-- who had made money, instead of being held by everyone who signed in with
-- Google.
--
-- Fix: make it a MANUAL badge (the engine never auto-awards or auto-revokes
-- manual badges) and drop the bogus revenue rule. It is now awarded in
-- authController.googleCallback → awardGoogleVerifiedBadge() on every Google
-- login (idempotent, best-effort), plus a one-time backfill for existing hosts
-- with a Google identity.
--
-- Idempotent + safe on BOTH DBs: creates the badge row if it is missing (e.g.
-- staging, which had no google-verified row), otherwise flips the existing row
-- to manual/active. Run on staging (Tokyo) and prod (Mumbai).

-- 1) Ensure the badge exists and is a manual/active badge.
INSERT INTO badges (name, slug, description, badge_type, status)
VALUES ('Google Verified', 'google-verified',
        'Signed in with a verified Google account.', 'manual', 'active')
ON CONFLICT (slug) DO UPDATE
  SET badge_type = 'manual',
      status     = 'active';

-- 2) Remove the metric rule(s) — a manual badge is never rule-evaluated, and the
--    `revenue = 0` rule is what caused the erroneous revocations.
DELETE FROM badge_rules
WHERE badge_id = (SELECT id FROM badges WHERE slug = 'google-verified');

-- 3) One-time backfill: award to every host with a Google identity who does not
--    already hold an active award. assigned_by = NULL (system), non-duplicating.
INSERT INTO vendor_badges (vendor_id, badge_id, assigned_by, reason)
SELECT p.id,
       (SELECT id FROM badges WHERE slug = 'google-verified'),
       NULL,
       'Signed in with Google (backfill)'
FROM profiles p
WHERE p.role = 'host'
  AND p.google_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM vendor_badges vb
    WHERE vb.vendor_id = p.id
      AND vb.badge_id = (SELECT id FROM badges WHERE slug = 'google-verified')
      AND vb.revoked_at IS NULL
  );
