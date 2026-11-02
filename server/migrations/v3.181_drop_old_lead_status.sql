-- v3.181 — finish the lead-status rename started in v3.180.
-- APPLY ONLY AFTER the release that writes 'customer' (lifecycleRules ROI) is
-- live on Render; before that, the old server build still writes the old value.

BEGIN;

UPDATE leads SET status = 'customer', updated_at = now() WHERE status = 'sloth';

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status = ANY (ARRAY[
  'list','new','contacted','replied','qualified','demo','paid','activated','won',
  'customer','retained','ambassador','enterprised','champion','not_reachable',
  'not_interested','disqualified','lost','churned','do_not_contact','demo_scheduled','trial'
]::text[]));

CREATE OR REPLACE FUNCTION public.merge_lead_rows(p_survivor uuid, p_loser uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_surv leads%ROWTYPE; v_lose leads%ROWTYPE;
  adv text[] := array['new','contacted','replied','qualified','demo','paid','activated','won','customer','retained','ambassador','enterprised','champion'];
  money text[] := array['paid','activated','won','customer','retained','ambassador','enterprised','champion'];
  best text;
BEGIN
  IF p_survivor IS NULL OR p_loser IS NULL OR p_survivor = p_loser THEN RETURN p_survivor; END IF;
  SELECT * INTO v_surv FROM leads WHERE id = p_survivor;
  SELECT * INTO v_lose FROM leads WHERE id = p_loser;
  IF v_surv.id IS NULL OR v_lose.id IS NULL THEN RETURN COALESCE(v_surv.id, v_lose.id, p_survivor); END IF;
  best := CASE WHEN COALESCE(array_position(adv, v_lose.status),0) > COALESCE(array_position(adv, v_surv.status),0) THEN v_lose.status ELSE v_surv.status END;
  DELETE FROM crm_sequence_enrollments e WHERE e.lead_id = p_loser AND EXISTS (SELECT 1 FROM crm_sequence_enrollments e2 WHERE e2.lead_id = p_survivor AND e2.sequence_id = e.sequence_id);
  UPDATE crm_messages SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE crm_sequence_enrollments SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_activities SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_events SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_follow_ups SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_imports SET lead_id = p_survivor WHERE lead_id = p_loser;
  UPDATE lead_notes SET lead_id = p_survivor WHERE lead_id = p_loser;
  DELETE FROM leads WHERE id = p_loser;
  UPDATE leads t SET status = best,
    phone = COALESCE(NULLIF(t.phone,''), NULLIF(v_lose.phone,'')),
    email = COALESCE(NULLIF(t.email,''), NULLIF(v_lose.email,'')),
    name = COALESCE(NULLIF(t.name,''), NULLIF(v_lose.name,'')),
    owner_admin_id = COALESCE(t.owner_admin_id, v_lose.owner_admin_id),
    converted_at = CASE WHEN best = ANY(money) THEN LEAST(COALESCE(t.converted_at, v_lose.converted_at), COALESCE(v_lose.converted_at, t.converted_at)) ELSE NULL END,
    updated_at = now()
  WHERE t.id = p_survivor;
  RETURN p_survivor;
END; $function$;

COMMIT;
