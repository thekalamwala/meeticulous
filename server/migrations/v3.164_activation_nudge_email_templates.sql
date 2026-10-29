-- v3.164 — Email templates for the 4 host activation nudges (Tithi / onboarding)
-- ---------------------------------------------------------------------------
-- Branded email_templates rows for the same 4 events as v3.163. Sender = Tithi
-- (the onboarding persona). Vars: {{first_name}}, {{link}}. CTA via
-- cta_label/cta_url ({{link}}). status='active' = template usable, BUT the
-- notification_events.email_enabled flag (OFF in v3.163) still gates every send,
-- so nothing goes out until the founder flips it on. Idempotent (delete+insert).

delete from email_templates where event_key in
  ('HOST_ADD_SERVICE_NUDGE','HOST_SHARE_LINK_NUDGE','HOST_FIRST_BOOKING_NUDGE','HOST_PAYOUT_WAITING_NUDGE');

insert into email_templates
  (event_key, audience, name, category, email_category, email_reason, sender_key, status, subject, preview_text, cta_label, cta_url, html_content)
values
  ('HOST_ADD_SERVICE_NUDGE', 'vendor', 'Host — Add First Service', 'Onboarding', 'Getting Started',
   'You are receiving this because you signed up as a host on Book A Sloth.', 'tithi', 'active',
   'Your Book A Sloth page is empty, {{first_name}}',
   'Add one service with a price and you''re live.',
   'Add my service', '{{link}}',
   '<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#b8410f;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">Get set up</p><h1 style="margin:0 0 18px;font-size:24px;font-weight:800;line-height:1.25;color:#111827;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">Add your first service, {{first_name}}</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#374151;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">Your account is ready — but there is nothing on your page to book yet. Add one service with a price and you are live. Takes about two minutes.</p>'),

  ('HOST_SHARE_LINK_NUDGE', 'vendor', 'Host — Share Booking Link', 'Onboarding', 'Getting Started',
   'You are receiving this because you have a live booking page on Book A Sloth.', 'tithi', 'active',
   'Your page is live — now share it, {{first_name}}',
   'A page nobody sees gets no bookings.',
   'Copy my link', '{{link}}',
   '<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#b8410f;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">You are live</p><h1 style="margin:0 0 18px;font-size:24px;font-weight:800;line-height:1.25;color:#111827;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">Your booking page is live, {{first_name}} 🎉</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#374151;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">The only thing between you and your first booking is people seeing your link. Share it with 5 people today — WhatsApp, your Instagram bio, anywhere your clients already are.</p>'),

  ('HOST_FIRST_BOOKING_NUDGE', 'vendor', 'Host — Get First Booking', 'Onboarding', 'Getting Started',
   'You are receiving this because you have a live booking page on Book A Sloth.', 'tithi', 'active',
   'Still no bookings? Here''s the fastest fix',
   'The first booking usually comes from your own circle.',
   'Share my link', '{{link}}',
   '<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#b8410f;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">First booking</p><h1 style="margin:0 0 18px;font-size:24px;font-weight:800;line-height:1.25;color:#111827;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">No bookings yet is normal, {{first_name}}</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#374151;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">The first one is the hardest. Fastest path: send your link to 3 people who have paid you before, or share it once in a group you are in. First bookings almost always come from your own circle, not strangers.</p>'),

  ('HOST_PAYOUT_WAITING_NUDGE', 'vendor', 'Host — Payout Waiting (KYC)', 'Payments', 'Payment Receipt',
   'You are receiving this because you have earnings waiting on Book A Sloth.', 'tithi', 'active',
   'You have a payout waiting, {{first_name}}',
   'Finish KYC and we''ll send it to your bank.',
   'Finish KYC', '{{link}}',
   '<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#056800;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">Payout ready</p><h1 style="margin:0 0 18px;font-size:24px;font-weight:800;line-height:1.25;color:#111827;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">Your money is waiting, {{first_name}} 💰</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#374151;font-family:''Poppins'',''Plus Jakarta Sans'',Arial,sans-serif;">You have earned on Book A Sloth. To send it to your bank we need a quick KYC (PAN + bank details) — a regulatory requirement, about three minutes.</p>');
