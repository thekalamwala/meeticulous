-- v3.160 — Sequence audience axis (Growth vs Marketing/Sales split).
--
-- Sequences serve two different audiences and must live behind different admin
-- surfaces (and, in the RBAC follow-up, different teams):
--
--   customer  post-signup host lifecycle — onboarding, activation, win-back,
--             celebration. Owned by product/you. Shows under Growth › Sequences.
--   lead      pre-signup cold nurture (automated acquisition). Owned by
--             Marketing. Shows under Marketing › Sequences.
--
-- Derivable from who a sequence enrols, so it is a fact about the row, not a
-- label someone picks. Default 'customer' (the restricted/owner bucket) so any
-- future untagged row is never mistaken for cold outreach.
--
-- Backfill by the seeded names the lifecycle engine uses: only "New Lead nurture"
-- targets leads today; everything else is host lifecycle.
--
-- Additive + schema-fallback safe: listSequences/createSequence drop the column
-- on "column not found", so it is safe to deploy before this lands. Apply on BOTH
-- DBs (staging Tokyo → prod Mumbai).

ALTER TABLE crm_sequences
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'customer'
    CHECK (audience IN ('lead', 'customer'));

UPDATE crm_sequences SET audience = 'lead'
  WHERE name IN ('New Lead nurture');
