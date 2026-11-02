# Prompt: Plan the Meeticulous email setup (domains, inboxes, senders)

> Paste everything below the line into Claude Code, run from the repo root.
> Or just say: "Follow docs/email-setup-prompt.md".

---

You are planning the move of Meeticulous's email system to a new domain and sender structure. **This first pass is PLANNING ONLY. Do not write code, run migrations, or open a PR until I approve the plan.** Follow CLAUDE.md as usual: read the 4 Quick Start docs first, then ask me your clarifying questions before you finalise the plan.

## Goal

Every email the platform sends (login codes, bookings, payments, onboarding, marketing, CRM) should:

1. come from the right address on the right sending subdomain,
2. pass SPF, DKIM and DMARC,
3. send replies to a real, monitored inbox,
4. **keep working during the switch.** No moment where login codes or booking confirmations fail because a domain isn't verified yet or a setting points to something that doesn't exist.

I need two things from you:

- **A. The engineering plan:** what changes in code, the database and environment variables, in which order.
- **B. My task list:** what I have to do by hand outside the code (buying things, DNS, dashboards), in the right order, with clear "do this BEFORE step X" dependencies, and how I check that each step worked.

## Decisions already made (don't re-litigate them; flag real problems though)

### 1. Separate subdomains by type of email, NOT by host vs guest

| Subdomain | Purpose | Sending addresses |
|---|---|---|
| `notify.meeticulous.com` | Transactional mail that must always arrive | `verify@`, `bookings@`, `payments@`, `account@` |
| `team.meeticulous.com` | Mail from people (lifecycle) | `tithi@`, `shubham@` |
| `news.meeticulous.com` | Marketing, always with an unsubscribe link | `hello@` |
| separate root domain, e.g. `trymeeticulous.com` (**pending decision, see open questions**) | CRM outreach to leads | `shubham@`, `tithi@` |

Host vs guest is shown in the **display name** ("Meeticulous for Hosts" vs "Meeticulous"), not by using a different address.

### 2. Template → sender mapping (46 templates in `server/config/emailTemplates.js`)

- **verify@notify**: BOOKING_OTP, AUTH_EMAIL_VERIFICATION, PASSWORD_RESET, SECURITY_PASSWORD_CHANGED, SECURITY_LOGIN_ALERT
- **bookings@notify**: BOOKING_CONFIRMED/REMINDER/CANCELLED/RESCHEDULED/COMPLETED, both _CUSTOMER and _VENDOR
- **payments@notify**: PAYOUT_SENT, PAYOUT_FAILED, PAYOUT_VERIFICATION_NEEDED, PAYOUT_DELAY_HOLIDAY, EARNING_REVERSED, REFERRAL_REWARD_RELEASED, SUBSCRIPTION_PURCHASED/RENEWED/HALTED/EXPIRING, invoices
- **account@notify**: KYC_APPROVED, KYC_REJECTED, PROFILE_VERIFIED, PROFILE_REJECTED, FEEDBACK_STATUS_CHANGED
- **tithi@team**: VENDOR_WELCOME, PROFILE_COMPLETION_REMINDER, KYC_EARN_NUDGE, BOOKING_ABANDONED_CUSTOMER
- **shubham@team**: GUEST_WELCOME, MILESTONE_FIRST_BOOKING, BIRTHDAY, ACCOUNT_ANNIVERSARY
- **hello@news**: NEWSLETTER_WELCOME, REBOOK_NUDGE_CUSTOMER, UPGRADE_COMMISSION_NUDGE, GUEST_TO_HOST_INVITE, BADGE_UNLOCKED, MILESTONE_10/50/100_BOOKINGS, admin campaigns (`campaignService` / `campaignWorker`)
- **CRM outreach domain**: CRM sales automation / sequences (`services/crm`, `crm_admin_sends` flag)

Check this against the real template list and tell me about any template or send path I've missed, including ad-hoc `utils/sendEmail.js` callers (contact form, enterprise lead, Bolt escalation, payout emails, admin alerts, digests).

### 3. Inboxes: Google Workspace on `meeticulous.com` (there are NO inboxes today)

- 1–2 paid seats only: `shubham@meeticulous.com` (admin) and maybe `aastha@meeticulous.com`.
- Free Google Groups: `support@` (shared inbox; every email's reply-to points here), `hello@` (website contact), `privacy@`, `dmarc@` (DMARC reports).
- Sending addresses on the subdomains need no inboxes. They only send.
- Hostinger mailboxes are used **only** on the separate outreach domain (if we have one), never on meeticulous.com, because the root domain's incoming mail (MX) goes to Google.
- App mail is **never** sent through Gmail or Hostinger. It stays on the email provider API (Resend / Brevo).

## What I already found (verify every point yourself; don't trust it blindly)

1. **Current sending domain is `mail.meeticulous.in`** (migration `server/migrations/v3.175_email_meeticulous_rebrand.sql`), while the website is `meeticulous.com`. `docs/current-work.md` says senders are on `meeticulous.com`. The docs and the migration disagree; work out which one is true.
2. **Reply-to is defined in 3 places with 3 different values:**
   - `server/services/email/providers/index.js` forces `SUPPORT_REPLY_TO` or `support@meeticulous.com` on every send (this one wins).
   - `email_settings.support_email` = `hello@mail.meeticulous.in`.
   - `server/utils/sendEmail.js` falls back to a dead `bolt@` address on the old-brand domain.
3. **Booking mail and marketing may share one free provider.** `MARKETING_PROVIDER = 'resend'` in `providers/index.js`. The code comment says transactional should be Brevo, but `email_settings.provider = 'resend'` in the DB I checked. On Resend's free plan (100 emails/day, 3,000/month, 3 domains), one campaign could block login codes and booking confirmations for the rest of the day. Check `services/email/sendBudget.js` and `RESEND_DAILY_CAP` too.
4. **Payout emails come from the `tithi` persona.** Money emails should come from `payments@notify`.
5. **`email_senders` has `stream` and `list_unsubscribe` columns**, but I couldn't find a `List-Unsubscribe` header being set anywhere. Gmail and Yahoo require one-click unsubscribe (RFC 8058) on marketing mail. Check whether it's implemented; if not, plan it for every news./team. sender.
6. **Old addresses are hardcoded all over the place** (`bolt@`, `noreply@` and `support@` on the old-brand domain, `hello@mail.meeticulous.in`, `bolt@meeticulous.in`, etc.) in the server, the client (`client/src`: footer, contact, help, privacy, terms, refund pages) and the docs. Grep for every one and list which are user-facing.
7. **Databases:** The only Supabase project my connector could see is "Meeticulous Dot Com" (`spquowzrefozmrzoszkf`, created 2026-10-29, about 1 profile). CLAUDE.md talks about prod (Mumbai) and staging (Tokyo). Work out which database is actually prod now, and plan any migration for **every** live DB, following the schema-fallback rule in CLAUDE.md.

## Things to check that I may not have thought of

- Is email also sent by **Supabase Auth** (its own SMTP settings), **Razorpay**, Google OAuth, or anything else outside our code? Those need sender or contact updates too.
- **Resend webhook** (`resendWebhookController.js`): does it still work once sends come from new domains or a second provider? Do `email_logs` delivery and engagement tracking still work?
- **Cloudflare** (`docs/cloudflare-edge-setup.md`): every email DNS record must be "DNS only" (grey cloud).
- Unsubscribe links and tokens (`unsubscribeToken.js`, `email_unsubscribes`): which domain do the links point to, and do they still work?
- The placeholder-recipient guard (`p<phone>@users...` synthetic addresses): still correct after the change?
- Email layouts and logos (`emailLayout.js`): are any URLs still pointing at dead old-brand hosts?
- Environment variables on Render and Vercel that hold email addresses or provider keys (`RESEND_FROM`, `BREVO_FROM`, `SES_FROM`, `SMTP_*`, `SUPPORT_EMAIL`, `SUPPORT_REPLY_TO`, `ADMIN_ALERT_EMAIL`, `SUPER_ADMIN_EMAIL`, `SUPPORT_DIGEST_EMAIL`, `COLD_CALL_RECAP_EMAIL`): list what each must become.
- New subdomains have no sending reputation yet. Plan a warm-up (small volumes at first, transactional before marketing) and say when marketing and CRM sends can be switched back on.

## What I want back (format)

### Part A: Engineering plan

1. **Current state**: a short table of what's true today (with file:line references), including anything from "What I found" that turned out to be wrong.
2. **Target state**: the final `email_settings` and `email_senders` rows, the env vars, and template `sender_key` values.
3. **Changes, split into small PRs** in merge order. For each PR: what changes, which files, whether it needs a migration (on which DBs), how it's tested, and **what must be true outside the code before it is merged** (e.g. "notify.meeticulous.com is verified in Resend").
4. **Safe cutover order.** The core rule: never point a sender at a domain that isn't verified yet. Prefer a design where switching domains is a DB/config change (instant to flip back) rather than a code deploy. Include the rollback for each step.
5. **Risks**, ranked.

### Part B: My task list (things only I can do)

A numbered checklist, in order. For each task:

- **What to do** (exact records/values where possible: MX, SPF, DKIM, DMARC, return-path; which dashboard, which setting)
- **Do this before:** which engineering step or PR depends on it
- **How to check it worked** (e.g. a test email to Gmail showing SPF/DKIM/DMARC = PASS under "Show original", or the Resend dashboard showing "Verified")
- **Rough time and cost**, if any

It must cover at least: buying Google Workspace and verifying the domain; Google's MX/SPF/DKIM records; DMARC (start at `p=none`, with dates to move to `quarantine` and later `reject`); creating the groups and setting "Who can post" to anyone on the web; checking that outside mail reaches `support@`; verifying the 3 subdomains in Resend (and the second provider if we split); env var changes on Render; updating contact emails in outside dashboards (Razorpay, Google OAuth consent screen, Supabase, Meta, AiSensy, domain registrar); registering in Google Postmaster Tools; the outreach domain + Hostinger (only if we go ahead with it); and the warm-up schedule.

### Part C: Final check ("everything works")

A test script or checklist to run after the cutover: trigger one email from each sender (verify, bookings, payments, account, tithi, shubham, hello/news), check that it lands in the Gmail **inbox** (not spam or Promotions for transactional), passes SPF/DKIM/DMARC, shows the right From name, replies reach `support@`, and the unsubscribe link works.

## Open questions (ask me these, plus any of your own)

1. Will one person or two handle `support@`? (Decides 1 vs 2 Workspace seats.)
2. Who do the CRM emails go to: people who filled in a form (Meta lead ads, the enterprise form) or cold/bought lists? (Decides whether we need the separate outreach domain + Hostinger, or can use `news.`.)
3. Do we stay on Resend free tier, upgrade to Resend Pro, or split transactional and marketing across two providers?
4. Is `mail.meeticulous.in` still needed for anything, or can it be retired after the move?

Stop after the plan and the questions. Don't start any PR until I say go.
