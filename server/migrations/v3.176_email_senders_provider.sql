-- v3.176 — email_senders.provider (per-stream ESP routing)
-- ---------------------------------------------------------------------------
-- Lets each sender pick its ESP (e.g. transactional → Resend, marketing → Brevo)
-- so a campaign burst can never starve login/booking mail on a shared quota.
-- Additive + nullable: a null provider falls back to the override, then
-- email_settings.provider (today's behaviour). Code is schema-safe — senderRegistry
-- reads `provider || null`, so this is safe to apply before OR after the deploy.
-- Apply on every live DB.

alter table email_senders add column if not exists provider text;
