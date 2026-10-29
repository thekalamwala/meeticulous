-- v3.153 — email_campaigns.layout: persist the composer's Layout choice so the
-- send worker (and test/preview) can honor 'cold' outreach (PR #999's cold shell).
-- Before this, the layout dropdown was dropped on save and the worker derived the
-- shell from contact_type, so 'cold' never fired. Additive + schema-fallback safe:
-- campaignService.create strips the column on "column not found".
--
-- Apply on BOTH DBs (staging Tokyo xwvciqkayammbvsidqig, prod Mumbai ayjhlwyzszykqtnaktpb).

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'customer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_layout_check'
  ) THEN
    ALTER TABLE public.email_campaigns
      ADD CONSTRAINT email_campaigns_layout_check
      CHECK (layout IN ('customer', 'vendor', 'cold'));
  END IF;
END $$;

COMMENT ON COLUMN public.email_campaigns.layout IS
  'Email shell for this campaign: customer (branded) | vendor (host) | cold (plain founder outreach). Set from the composer Layout dropdown.';
