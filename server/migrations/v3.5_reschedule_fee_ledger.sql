-- v3.5_reschedule_fee_ledger.sql
-- Allow RESCHEDULE_FEE journal entries (extend the existing CHECK).
alter table journal_entries drop constraint if exists journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in (
    'ORDER_PAYMENT','SUBSCRIPTION_PAYMENT','SETTLEMENT','REFUND',
    'ADJUSTMENT','REVERSAL','BANK_TRANSFER','BACKFILL','BACKFILL_SETTLEMENT',
    'RESCHEDULE_FEE'));

-- One row per charged reschedule fee → gives the ledger a real uuid source_id
-- and a unique idempotency anchor per charge.
create table if not exists reschedule_payments (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null,
  guest_id            uuid,
  host_id             uuid,
  amount              integer not null,
  razorpay_order_id   text,
  razorpay_payment_id text unique,
  created_at          timestamptz not null default now()
);
