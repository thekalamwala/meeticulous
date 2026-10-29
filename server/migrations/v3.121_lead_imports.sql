-- v3.121 — external lead ingest audit log (CRM audit Phase 5)
-- The integration layer's system-of-record: every inbound lead from an external
-- source (Meta Lead Ads, Zoho, website/partner forms) lands here first, then is
-- mapped and fed into leads via upsertLead. Gives idempotency (unique provider +
-- external_id), retry state, and a full audit trail of the raw payload.
-- Additive & idempotent; ingestService carries a schema fallback so lead capture
-- still works if this table isn't present yet.

CREATE TABLE IF NOT EXISTS public.lead_imports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,                        -- 'meta' | 'zoho' | 'form' | …
  external_id  text,                                 -- provider's own lead id (idempotency)
  status       text NOT NULL DEFAULT 'received',     -- received | upserted | failed | skipped
  lead_id      uuid REFERENCES public.leads(id),     -- the lead it produced
  raw          jsonb,                                -- original payload (audit)
  mapped       jsonb,                                -- normalized lead patch
  error        text,
  attempts     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: one import per (provider, external_id). A repeated webhook with the
-- same external_id is deduped instead of creating a second lead_imports row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_imports_provider_external
  ON public.lead_imports (provider, external_id) WHERE external_id IS NOT NULL;

-- Retry/monitoring: scan everything not yet successfully upserted.
CREATE INDEX IF NOT EXISTS idx_lead_imports_unfinished
  ON public.lead_imports (status) WHERE status <> 'upserted';

ALTER TABLE public.lead_imports ENABLE ROW LEVEL SECURITY;  -- service-role only (no policy)
