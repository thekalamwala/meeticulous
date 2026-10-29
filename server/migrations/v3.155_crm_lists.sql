-- v3.155 — CRM Lists (cold contact pool). Additive + idempotent.
-- Cold contacts are leads with status='list' + a list_id grouping. See
-- docs/superpowers/specs/2026-09-11-crm-lists-cold-pool-design.md.

CREATE TABLE IF NOT EXISTS public.lead_lists (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  source         text,
  consent_basis  text,
  description    text,
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;  -- service-role only (no policy)

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.lead_lists(id);

-- Widen the status CHECK to add 'list' (keep every value from v3.126).
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  'list',
  'new','contacted','replied','qualified','demo',
  'paid','activated','won','sloth',
  'retained','ambassador','enterprised','champion',
  'not_reachable','not_interested','disqualified','lost','churned',
  'do_not_contact',
  'demo_scheduled','trial'
));

CREATE INDEX IF NOT EXISTS idx_leads_cold ON public.leads (list_id) WHERE status = 'list';
