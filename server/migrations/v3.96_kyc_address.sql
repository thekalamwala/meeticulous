-- v3.96_kyc_address.sql — host registered address for Razorpay Route linked accounts.
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- Razorpay Route's v2 Accounts API REQUIRES a registered address per linked
-- account (profile.addresses.registered — verified against the live test API:
-- "The addresses field is required"). kyc_submissions did not capture one, so we
-- add address columns here and collect them in the host KYC form.
--
-- Not encrypted: a business/registered address is not sensitive PII the way PAN /
-- Aadhaar / bank number are (those stay AES-encrypted). country defaults 'IN'.
-- Additive only; code keeps a schema fallback until applied on both DBs.

ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS addr_street1     TEXT,
  ADD COLUMN IF NOT EXISTS addr_street2     TEXT,
  ADD COLUMN IF NOT EXISTS addr_city        TEXT,
  ADD COLUMN IF NOT EXISTS addr_state       TEXT,
  ADD COLUMN IF NOT EXISTS addr_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS addr_country     TEXT NOT NULL DEFAULT 'IN';
