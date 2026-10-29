-- v3.31 — Security audit C-1: stop anonymous clients from reading secret rows
-- in platform_settings via the Supabase anon REST API.
--
-- Background: migration_v4_admin.sql created `CREATE POLICY "Settings readable
-- by all" ... USING (true)`, which (combined with the anon SELECT grant) let any
-- visitor read EVERY row — including the encrypted Razorpay key/webhook secrets
-- stored by services/razorpayConfig.js. The encrypted ciphertext was therefore
-- published to the public internet. This scopes the public read policy so secret
-- rows are never returned to anon/authenticated. The server uses the service_role
-- key (which bypasses RLS), so runtime + admin reads are unaffected.
--
-- ALSO REQUIRED (ops, not SQL): rotate razorpay_webhook_secret in the Razorpay
-- dashboard + Admin → Payment, since the ciphertext was internet-exposed, and
-- confirm GOOGLE_TOKEN_KEY is set in Render (it decrypts these values; without it
-- the key derives from the service_role key — see utils/cryptoTokens.js).

DROP POLICY IF EXISTS "Settings readable by all" ON public.platform_settings;
DROP POLICY IF EXISTS "Public non-secret settings readable" ON public.platform_settings;

CREATE POLICY "Public non-secret settings readable"
  ON public.platform_settings FOR SELECT
  USING (key NOT IN (
    'razorpay_key_secret',
    'razorpay_webhook_secret',
    'smtp_password',
    'resend_api_key',
    'twilio_auth_token',
    'aisensy_api_key'
  ));

-- Applied live to prod (ayjhlwyzszykqtnaktpb) + staging (xwvciqkayammbvsidqig)
-- via MCP on 2026-06-23 and verified: `SET LOCAL ROLE anon; SELECT key FROM
-- platform_settings` no longer returns razorpay_webhook_secret.
