-- v3.122 — per-sequence / per-step / per-message sender persona (CRM sends redesign)
-- Lets CRM emails go out FROM a chosen persona (Tithi for lifecycle, Sujata for
-- offers) instead of the single generic notifications@ address. sender_key is a
-- soft reference to email_senders.sender_key; NULL falls back to the global default.
-- Additive & idempotent; the send path carries a schema fallback (strips sender_key
-- on a missing-column error) so it is safe to deploy before or after this migration.

ALTER TABLE public.crm_sequences      ADD COLUMN IF NOT EXISTS sender_key text;
ALTER TABLE public.crm_sequence_steps ADD COLUMN IF NOT EXISTS sender_key text;  -- overrides the sequence
ALTER TABLE public.crm_messages       ADD COLUMN IF NOT EXISTS sender_key text;  -- resolved at enqueue, used at send
