-- v3.179 — Marketing mail onto Brevo via news.meeticulous.com
--
-- Transactional + lifecycle stay on Resend (notify./team.meeticulous.com). The
-- true bulk/promotional set moves to a dedicated 'news' sender on Brevo, whose
-- domain news.meeticulous.com is authenticated in Brevo (brevo-code TXT + brevo1/
-- brevo2 DKIM CNAMEs + DMARC). deliver() prefers sender.provider, so these
-- templates route to Brevo automatically once this row exists — no code deploy
-- needed to flip providers, and reverting is a one-row UPDATE.
--
-- Prereqs (must be true BEFORE this takes effect in prod):
--   * news.meeticulous.com shows Authenticated in Brevo (DNS is already live).
--   * BREVO_API_KEY is set on Render (Brevo sends fail closed without it).
-- Additive + idempotent. Safe to re-run.

insert into email_senders (sender_key, from_name, from_email, reply_to, provider, active)
values ('news', 'Meeticulous', 'hello@news.meeticulous.com', 'team@meeticulous.com', 'brevo', true)
on conflict (sender_key) do update
  set from_name  = excluded.from_name,
      from_email = excluded.from_email,
      reply_to   = excluded.reply_to,
      provider   = excluded.provider,
      active     = true;

-- Repoint the bulk/promotional templates to the news sender. Lifecycle "from a
-- person" mail (MILESTONE_FIRST_BOOKING, BIRTHDAY, ACCOUNT_ANNIVERSARY → shubham;
-- VENDOR_WELCOME, PROFILE_COMPLETION_REMINDER, KYC_EARN_NUDGE,
-- BOOKING_ABANDONED_CUSTOMER → tithi) deliberately stays on team.meeticulous.com.
update email_templates
   set sender_key = 'news'
 where event_key in (
   'NEWSLETTER_WELCOME',
   'REBOOK_NUDGE_CUSTOMER',
   'UPGRADE_COMMISSION_NUDGE',
   'GUEST_TO_HOST_INVITE',
   'BADGE_UNLOCKED',
   'MILESTONE_10_BOOKINGS',
   'MILESTONE_50_BOOKINGS',
   'MILESTONE_100_BOOKINGS'
 );
