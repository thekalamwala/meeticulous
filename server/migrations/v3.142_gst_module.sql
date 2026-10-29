-- v3.142_gst_module.sql — GST command center workflow state (P1).
--
-- The GST module DERIVES every figure from the immutable `invoices` table (the
-- source of truth). These tables store ONLY workflow state that does not exist
-- yet — never duplicated monetary values:
--   gst_returns      — return preparation/filing status per period (§9)
--   gst_export_runs  — CA-pack / export history (§13, generation lands in P4)
--   gst_issue_status — resolution overlay for the computed action center (§4)
-- The GST audit trail REUSES admin_audit_logs (auditService) — no new table.
--
-- Additive + idempotent. RLS ON, service-role only (no policy) — same posture as
-- bot_escalations. Apply on BOTH DBs:
--   prod    Mumbai  ayjhlwyzszykqtnaktpb
--   staging Tokyo   xwvciqkayammbvsidqig
-- Code is schema-fallback safe (reads fail soft) so it is safe before apply.

-- ── Return tracking ───────────────────────────────────────────
create table if not exists public.gst_returns (
  id                    uuid primary key default gen_random_uuid(),
  gstin                 text not null,
  period_type           text not null check (period_type in ('month','quarter')),
  fiscal_year           text not null,                        -- '26' (2-digit FY start)
  period_key            text not null,                        -- 'M07' | 'Q2'
  return_type           text not null check (return_type in ('GSTR1','GSTR3B')),
  status                text not null default 'not_started'
                          check (status in ('not_started','preparing','needs_review','ready','filed')),
  reconciliation_status text,
  arn                   text,                                 -- govt ref; required to be 'filed'
  filed_at              timestamptz,
  prepared_by           uuid,
  filed_by              uuid,
  snapshot              jsonb,
  updated_at            timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (gstin, fiscal_year, period_key, return_type)
);

-- ── Export / CA-pack history ──────────────────────────────────
create table if not exists public.gst_export_runs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  pack_type      text not null,                               -- monthly|quarterly|annual|full|report
  gstin          text,
  fiscal_year    text,
  period_key     text,
  params_hash    text,                                        -- content-address immutable closed periods
  record_count   int,
  taxable_total  numeric,
  gst_total      numeric,
  status         text not null default 'pending'
                   check (status in ('pending','running','complete','failed')),
  storage_path   text,
  generated_by   uuid,
  generated_at   timestamptz not null default now()
);
create index if not exists gst_export_runs_hash_idx on public.gst_export_runs (params_hash);

-- ── Action-center resolution overlay ──────────────────────────
-- Exceptions are computed live; this only remembers the human decision.
create table if not exists public.gst_issue_status (
  id           uuid primary key default gen_random_uuid(),
  issue_type   text not null,
  source_type  text not null,                                 -- invoice|booking|subscription|commission
  source_id    text not null,
  status       text not null default 'open'
                 check (status in ('open','under_review','resolved','ignored')),
  owner        text,
  note         text,
  updated_by   uuid,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (issue_type, source_type, source_id)
);

-- ── Reporting performance: invoices are queried by issued_at + source_type ──
create index if not exists invoices_issued_at_idx  on public.invoices (issued_at);
create index if not exists invoices_source_type_idx on public.invoices (source_type);

-- ── RLS: service-role only (server uses the service key; block anon/authed) ──
alter table public.gst_returns      enable row level security;
alter table public.gst_export_runs  enable row level security;
alter table public.gst_issue_status enable row level security;
