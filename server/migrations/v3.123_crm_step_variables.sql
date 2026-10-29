-- v3.123 — per-step template variables for CRM sequence steps (sends redesign).
-- WhatsApp steps carry their ordered AiSensy template params here (jsonb array,
-- e.g. ["{{first_name}}"]); email steps leave it NULL. seedLifecycleSequences.js
-- writes this column, and sequenceService reads it to render WhatsApp params.
-- Additive & idempotent. Applied on BOTH DBs 2026-08-27.

ALTER TABLE public.crm_sequence_steps ADD COLUMN IF NOT EXISTS variables jsonb;
