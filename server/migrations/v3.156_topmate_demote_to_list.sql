-- v3.156 — one-time: demote the wrongly-warm Topmate prospects to a cold list.
-- RUN MANUALLY, and ONLY AFTER the exclusion code (Tasks 2,3,11) is deployed —
-- otherwise status='list' rows still surface on an un-gated board.
DO $$
DECLARE lid uuid;
BEGIN
  INSERT INTO lead_lists (name, source, consent_basis, created_by)
    VALUES ('Topmate — cold', 'topmate', 'b2b_legitimate_interest', 'backfill')
    RETURNING id INTO lid;

  UPDATE leads
     SET status = 'list', list_id = lid, updated_at = now()
   WHERE attributes->>'source_dataset' = 'topmate'
     AND status NOT IN ('paid','activated','won','sloth','retained','ambassador','enterprised','champion');
END $$;
