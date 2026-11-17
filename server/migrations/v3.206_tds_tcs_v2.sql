-- v3.206 TDS/TCS v2 withholding engine — ships DORMANT (opt-in, default OFF).
--
-- Moves host-payout withholding from the hardcoded flat 1% TDS + 1% TCS to the
-- CA-confirmable FY2026-27 rules (docs/tds-tcs-withholding-design.md): 0.1% TDS
-- (194-O), 0.5% TCS (Sec 52), ₹5L individual threshold, 5% no-PAN — every rate a
-- configurable value, gated behind the `tds_tcs_v2` flag.
--
-- The kill-switch registry (featureRegistry.js) defaults flags to enabled=true and
-- isFeatureEnabled() is FAIL-OPEN, so a MONEY flag MUST be pre-seeded disabled here
-- (and carries enabled:false in the registry). While OFF, resolveWithholding() returns
-- the legacy 1% + 1%, so deploying this migration changes NOTHING in production.
-- DO NOT flip ON until the CA sign-off (the 5 questions in the design doc) is confirmed.

-- 1) The master flag — OFF.
INSERT INTO feature_flags (key, label, description, category, scope, enabled)
VALUES (
  'tds_tcs_v2',
  'TDS/TCS v2 Withholding',
  'Config-driven TDS (194-O) + TCS (Sec 52) withholding on host payouts with PAN / entity / Rs5L-threshold rules. Off = legacy flat 1% TDS + 1% TCS. On = rates from platform_settings (default 0.1% TDS / 0.5% TCS), 5% no-PAN, Rs5L individual exemption. Flip ON only after CA sign-off.',
  'Payments',
  'vendor',
  false
)
ON CONFLICT (key) DO NOTHING;

-- 2) The configurable rates (read by platformConfig; only applied when the flag is ON).
--    Seeded with the researched FY2026-27 values — the CA's answer is a value edit here.
INSERT INTO platform_settings (key, value) VALUES
  ('tds_rate',                 '0.001'),   -- 194-O, 0.1%
  ('tds_rate_no_pan',          '0.05'),    -- 5% when no PAN/Aadhaar
  ('tcs_rate',                 '0.005'),   -- Sec 52, 0.5%
  ('tds_threshold_individual', '500000')   -- Rs5L/FY TDS exemption, resident individual/HUF with PAN
ON CONFLICT (key) DO NOTHING;

-- 3) Host entity type — drives the TDS threshold / carve-out. Defaults to the
--    conservative individual/HUF; the Rs5L exemption only ever applies with a PROVEN
--    FY-gross-under-threshold, so the default never causes under-deduction.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS host_entity_type text NOT NULL DEFAULT 'individual_huf';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_host_entity_type_chk'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_host_entity_type_chk
      CHECK (host_entity_type IN ('individual_huf', 'company_firm_llp'));
  END IF;
END $$;
