-- v3.59 — Rebook Nudge config: Studio-only entitlement + notification event.
-- Host+ (creator) followup_flows 1 -> 0 so only Studio (professional, =2) is
-- entitled for now. Enabling other plans later = bump this number (no code).
update public.subscription_plans
   set limits = jsonb_set(limits, '{followup_flows}', '0'::jsonb)
 where slug = 'creator';

-- New notification event (email on, whatsapp off until AiSensy template approved).
insert into public.notification_events
  (event_key, display_name, whatsapp_enabled, email_enabled, campaign_name, email_subject)
values
  ('REBOOK_NUDGE_CUSTOMER', 'Rebook Nudge — Customer', false, true, '',
   'Ready for another session with {{vendor_name}}?')
on conflict (event_key) do nothing;
