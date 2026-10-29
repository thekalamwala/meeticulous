-- v3.46 — platform_settings public read = explicit allowlist (audit P2-4)
--
-- BEFORE: the public SELECT policy was deny-by-exclusion — it blocked 6 named
-- secret keys and allowed EVERYTHING ELSE to anon. Any new sensitive setting
-- added later under a non-"_secret" name would be auto-published to anon. A
-- footgun: the model defaults to exposed.
--
-- AFTER: invert to an explicit allowlist of known-public keys. Anything not on
-- the list (including any future secret) is denied to anon by default. The
-- listed keys are exactly the non-secret settings the client legitimately reads
-- (plus the public Razorpay config keys, harmless if absent on a given DB), so
-- this does not change what is currently readable — only the default for new keys.

DROP POLICY IF EXISTS "Public non-secret settings readable" ON public.platform_settings;
DROP POLICY IF EXISTS "Public allowlisted settings readable" ON public.platform_settings;

CREATE POLICY "Public allowlisted settings readable" ON public.platform_settings
  FOR SELECT TO public
  USING (key IN (
    'platform_name',
    'platform_fee',
    'platform_fee_percent',
    'platform_fee_gst_rate',
    'plan_limits',
    'plan_price_creator',
    'plan_price_professional',
    'settlement_clearing_days',
    'maintenance_mode',
    'razorpay_key_id',
    'razorpay_mode',
    'razorpay_enabled'
  ));
