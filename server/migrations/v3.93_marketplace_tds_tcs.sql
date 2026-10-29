-- v3.93 — Marketplace model v4 (docs/payment-model.md v4)
-- Adds host TDS (194-O) + TCS (GST Sec 52) withholding to booking payouts and
-- the commission-taxable snapshot (commission is now GST-inclusive).
--
-- Additive + idempotent. Apply on BOTH DBs:
--   prod    Mumbai  ayjhlwyzszykqtnaktpb
--   staging Tokyo   xwvciqkayammbvsidqig
-- Code keeps a schema fallback (SELECT/INSERT destructure) until confirmed on both.

alter table public.bookings
  add column if not exists tds_amount         numeric(12,2),
  add column if not exists tcs_amount         numeric(12,2),
  add column if not exists commission_taxable numeric(12,2);

comment on column public.bookings.tds_amount is
  '194-O income-tax TDS withheld from host (v4); pass-through to govt, host claims credit';
comment on column public.bookings.tcs_amount is
  'GST Sec 52 TCS collected from host (v4); pass-through to govt, host claims credit';
comment on column public.bookings.commission_taxable is
  'Commission ex-GST — taxable value on the host commission invoice (v4, commission is GST-inclusive)';

-- Ledger accounts for the two new pass-through liabilities (mirrors v2.8 chart_of_accounts).
insert into public.chart_of_accounts (code, name, type) values
  ('2300', 'TDS Payable (194-O)',        'LIABILITY'),
  ('2400', 'TCS Payable (GST Sec 52)',   'LIABILITY')
on conflict (code) do nothing;
