-- v3.130 — merge_lead_rows(survivor, loser): fold one duplicate lead row into another,
-- atomically, reparenting all child records. This is the runtime primitive that stops the
-- fragmentation v3.129 cleaned up from RECURRING: upsertLead calls it the moment it sees a
-- phone-row and an email-row that are the same person (see leadService.upsertLead).
--
-- Same semantics as the v3.129 batch, for a single pair:
--   • drop loser enrollments that collide with the survivor on (sequence_id, lead_id)
--   • reparent all 7 lead_id children → survivor
--   • delete the loser row (frees its phone/email from the partial unique indexes)
--   • fold the loser's non-blank phone/email/name/owner onto the survivor, keep the
--     most-advanced status, keep the earliest converted_at when that status is a money state
-- No-op (returns survivor) if either id is missing or they are the same row.

CREATE OR REPLACE FUNCTION merge_lead_rows(p_survivor uuid, p_loser uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_surv   leads%ROWTYPE;
  v_lose   leads%ROWTYPE;
  adv      text[] := array['new','contacted','replied','qualified','demo',
                           'paid','activated','won','sloth',
                           'retained','ambassador','enterprised','champion'];
  money    text[] := array['paid','activated','won','sloth','retained','ambassador','enterprised','champion'];
  best     text;
BEGIN
  IF p_survivor IS NULL OR p_loser IS NULL OR p_survivor = p_loser THEN
    RETURN p_survivor;
  END IF;

  SELECT * INTO v_surv FROM leads WHERE id = p_survivor;
  SELECT * INTO v_lose FROM leads WHERE id = p_loser;
  IF v_surv.id IS NULL OR v_lose.id IS NULL THEN
    RETURN COALESCE(v_surv.id, v_lose.id, p_survivor);
  END IF;

  -- most-advanced status of the pair (0 = terminal/unknown, keeps whichever ranks higher)
  best := CASE
            WHEN COALESCE(array_position(adv, v_lose.status), 0) > COALESCE(array_position(adv, v_surv.status), 0)
            THEN v_lose.status ELSE v_surv.status
          END;

  -- 1. drop colliding loser enrollments (survivor already in that sequence)
  DELETE FROM crm_sequence_enrollments e
  WHERE e.lead_id = p_loser
    AND EXISTS (SELECT 1 FROM crm_sequence_enrollments e2
                WHERE e2.lead_id = p_survivor AND e2.sequence_id = e.sequence_id);

  -- 2. reparent children
  UPDATE crm_messages             SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE crm_sequence_enrollments SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_activities          SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_events              SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_follow_ups          SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_imports             SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_notes               SET lead_id = p_survivor WHERE lead_id = p_loser;

  -- 3. delete loser (frees phone/email from uq_leads_phone / uq_leads_email_only)
  DELETE FROM leads WHERE id = p_loser;

  -- 4. fold loser's non-blank identity onto survivor
  UPDATE leads t SET
    status         = best,
    phone          = COALESCE(NULLIF(t.phone,''), NULLIF(v_lose.phone,'')),
    email          = COALESCE(NULLIF(t.email,''), NULLIF(v_lose.email,'')),
    name           = COALESCE(NULLIF(t.name,''),  NULLIF(v_lose.name,'')),
    owner_admin_id = COALESCE(t.owner_admin_id, v_lose.owner_admin_id),
    converted_at   = CASE WHEN best = ANY(money)
                          THEN LEAST(COALESCE(t.converted_at, v_lose.converted_at),
                                     COALESCE(v_lose.converted_at, t.converted_at))
                          ELSE NULL END,
    updated_at     = now()
  WHERE t.id = p_survivor;

  RETURN p_survivor;
END;
$$;
