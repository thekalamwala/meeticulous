-- v3.68_kyc.sql — Host KYC verification (identity + bank + selfie/PAN/Aadhaar docs).
-- Idempotent. Apply on BOTH DBs (prod Mumbai ayjhlwyzszykqtnaktpb + staging Tokyo xwvciqkayammbvsidqig).
--
-- PAN / Aadhaar / account number are stored ENCRYPTED (app-level AES-256-GCM,
-- see server/utils/kycCrypto.js) — the columns hold ciphertext, never plaintext.
-- Documents live in a PRIVATE storage bucket ('kyc'); only the service_role
-- (server) can read them, and admins view them via short-lived signed URLs.

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE,        -- one active KYC per host

  -- Identity
  full_name       TEXT,
  email           TEXT,
  phone           TEXT,
  pan_number      TEXT,   -- AES-256-GCM ciphertext, write-only, never returned raw
  aadhaar_number  TEXT,   -- AES-256-GCM ciphertext, write-only, never returned raw

  -- Bank
  holder_name     TEXT,
  bank_name       TEXT,
  account_number  TEXT,   -- AES-256-GCM ciphertext, write-only, never returned raw
  ifsc            TEXT,
  branch          TEXT,
  account_type    TEXT,

  -- Documents (private-bucket storage keys, not public URLs)
  selfie_url      TEXT,
  pan_doc_url     TEXT,
  aadhaar_doc_url TEXT,

  -- Review
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note     TEXT,
  reviewed_by     UUID,                          -- admin id (nullable)
  reviewed_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kyc_user_idx   ON kyc_submissions (user_id);
CREATE INDEX IF NOT EXISTS kyc_status_idx ON kyc_submissions (status);

-- Private bucket for KYC documents. public=false → not web-readable; the server
-- (service_role) reads/writes directly and hands admins signed URLs. No RLS
-- policies are added on purpose: authenticated/anon get zero access, service_role
-- bypasses RLS. Mirrors the private-product-bucket lockdown (v3.28 / v3.41).
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc', 'kyc', false)
ON CONFLICT (id) DO NOTHING;
