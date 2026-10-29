-- v3.128 — Backfill: regress phantom money-state leads out of Customer Relations.
--
-- Root cause (fixed in the same PR, leadService.computeAccountFacts): `isPaid`
-- accepted `plan_activated_at` as proof of payment. That column is stamped by
-- onboarding/admin with NO Razorpay charge, so free & never-paid hosts were promoted
-- to `paid`/`activated` and — because resolveAccountStatus never auto-regresses a MONEY
-- state (lifecycleRules.js) — stayed there forever. Result: the Relations board showed
-- ~79 "customers" when only 3 had ever paid a subscription.
--
-- This one-time correction resets every money-state lead whose linked profile fails the
-- CORRECTED paid test back to `qualified` (Presale · warm: onboarded/engaged but unpaid,
-- prime for sales re-approach) and clears the false converted_at stamp. The 3 genuine
-- subscribers (real Razorpay sub id or a paid subscription_payments row, non-comped,
-- not cancelled) are preserved by the WHERE clause. Idempotent: re-running is a no-op
-- once the code fix stops re-promoting them.
--
-- paid test mirrors computeAccountFacts exactly:
--   non-free AND non-comped AND not cancelled AND (razorpay_subscription_id OR paid charge)

UPDATE leads l
SET    status = 'qualified',
       converted_at = NULL
WHERE  l.status IN ('paid','activated','won','sloth','retained','ambassador','enterprised','champion')
  AND  NOT EXISTS (
         SELECT 1
         FROM   profiles p
         LEFT JOIN LATERAL (
                  SELECT 1 FROM subscription_payments sp
                  WHERE  sp.vendor_id = p.id AND sp.status = 'paid'
                  LIMIT  1
               ) paid_charge ON TRUE
         WHERE  p.id = l.profile_id
           AND  lower(coalesce(p.plan,'')) NOT IN ('starter','explorer','free','starter_legacy')  -- free tiers
           AND  lower(coalesce(p.plan,'')) <> 'supreme'                                            -- comped tier
           AND  coalesce(p.subscription_status,'') <> 'cancelled'
           AND  (p.razorpay_subscription_id IS NOT NULL OR paid_charge IS NOT NULL)
       );

-- Note: internal/demo accounts (Bolt, Sloth, Finance, Greyhawks staff) are also reset to
-- `qualified` by the above. They are not paying customers either; DNC/tag them separately
-- if they should stay out of the sales queue.
