-- v3.180 — remove the old brand from live data (owner request 2026-11-01).
--
-- 1. Lead status: the "Customer" stage gets the value 'customer'. TRANSITIONAL:
--    the check constraint and merge_lead_rows accept BOTH the old value and
--    'customer' so whichever code version is live keeps working. v3.181 drops
--    the old value once the release that writes 'customer' is deployed.
-- 2. Column defaults that still carried the old name, domain or logo.
-- 3. Published content: blogs (title/excerpt/body/author), CRM template bodies
--    and the internal team-member badge slug. Generic brand replacements plus a
--    few hand-written rewrites of mascot passages.
-- Idempotent: re-running changes nothing once applied.

BEGIN;

-- ── 1. Lead status ───────────────────────────────────────────────────────────
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status = ANY (ARRAY[
  'list','new','contacted','replied','qualified','demo','paid','activated','won',
  'customer','sloth','retained','ambassador','enterprised','champion','not_reachable',
  'not_interested','disqualified','lost','churned','do_not_contact','demo_scheduled','trial'
]::text[]));

UPDATE leads SET status = 'customer', updated_at = now() WHERE status = 'sloth';

CREATE OR REPLACE FUNCTION public.merge_lead_rows(p_survivor uuid, p_loser uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_surv leads%ROWTYPE; v_lose leads%ROWTYPE;
  adv text[] := array['new','contacted','replied','qualified','demo','paid','activated','won','sloth','customer','retained','ambassador','enterprised','champion'];
  money text[] := array['paid','activated','won','sloth','customer','retained','ambassador','enterprised','champion'];
  best text;
BEGIN
  IF p_survivor IS NULL OR p_loser IS NULL OR p_survivor = p_loser THEN RETURN p_survivor; END IF;
  SELECT * INTO v_surv FROM leads WHERE id = p_survivor;
  SELECT * INTO v_lose FROM leads WHERE id = p_loser;
  IF v_surv.id IS NULL OR v_lose.id IS NULL THEN RETURN COALESCE(v_surv.id, v_lose.id, p_survivor); END IF;
  best := CASE WHEN COALESCE(array_position(adv, v_lose.status),0) > COALESCE(array_position(adv, v_surv.status),0) THEN v_lose.status ELSE v_surv.status END;
  IF best = 'sloth' THEN best := 'customer'; END IF;
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

-- ── 2. Column defaults ───────────────────────────────────────────────────────
ALTER TABLE appearance_settings ALTER COLUMN icon_url     SET DEFAULT 'https://meeticulous.com/brand/meeticulous-icon.svg';
ALTER TABLE blogs               ALTER COLUMN author       SET DEFAULT 'Meeticulous Team';
ALTER TABLE email_settings      ALTER COLUMN from_name    SET DEFAULT 'Meeticulous';
ALTER TABLE email_settings      ALTER COLUMN support_email SET DEFAULT 'team@meeticulous.com';
ALTER TABLE email_settings      ALTER COLUMN website_url  SET DEFAULT 'https://meeticulous.com';

-- ── 3. Content ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.rebrand(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(regexp_replace(
    t,
    -- hand-written rewrites of mascot passages (must run before the generic rules)
    'Why “Sloth”\?', 'Why “Meeticulous”?', 'g'),
    'The sloth is not slow because it is lazy\. It is deliberate\. It wastes almost no energy, and every movement has a purpose\.',
      'The name is the promise: meticulous about the small things — the reminder, the receipt, the calendar invite — so you never have to be.', 'g'),
    ', it fit the sloth,', ', it fit the brand,', 'g'),
    'the sloth still writes the small print', 'the warmth is still in the small print', 'g'),
    'the sloth that refuses to be in a hurry', 'the refusal to be in a hurry', 'g'),
    'Same product, same sloth, sharper promise', 'Same product, same voice, sharper promise', 'g'),
    'a booking tool made by a sloth', 'a brand-new booking tool', 'g'),
    -- dead demo-service links → contact page
    'https?://[^\s"\)\]]*book-a-sloth-app-online-demo[a-z0-9-]*', 'https://meeticulous.com/contact', 'g'),
    -- routes / domains / handles
    '/lp/topmate-vs-bookasloth', '/compare/topmate-alternative', 'g'),
    '/be-a-sloth', '/become-a-host', 'g'),
    '(Become|Be) a Sloth', 'Become a host', 'g'),
    'bookasloth\.(in|com)', 'meeticulous.com', 'gi'),
    -- brand + plan names
    '[Bb]ook[ -]?[Aa][ -]?[Ss]loth', 'Meeticulous', 'g'),
    'bookasloth', 'meeticulous', 'gi'),
    'Sloth Active', 'Pro', 'g'),
    '\mSloth\M', 'Starter', 'g'),   -- remaining capitalised use = the free plan
    ' ?🦥', '', 'g')
$$;

UPDATE blogs SET
  title   = pg_temp.rebrand(title),
  excerpt = pg_temp.rebrand(excerpt),
  body    = pg_temp.rebrand(body::text)::jsonb,
  author  = pg_temp.rebrand(author)
WHERE concat_ws(' ', title, excerpt, body::text, author) ~* 'sloth';

UPDATE crm_templates SET body = pg_temp.rebrand(body) WHERE body ~* 'sloth';

UPDATE badges SET slug = 'team-member-of-meeticulous' WHERE slug = 'team-member-of-book-a-sloth';

COMMIT;
