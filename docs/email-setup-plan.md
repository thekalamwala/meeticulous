# Meeticulous email setup — plan (domains, senders, providers)

> Planning output for `docs/email-setup-prompt.md`.
>
> **Status 2026-11-01:** PR-1 → PR-4 shipped (#43, #46, #47, #49, #50, #53; migration v3.176).
> PR-6 mostly shipped (#56: old brand removed everywhere, `team@meeticulous.com` everywhere) —
> retiring the SES/SMTP providers is still open. **PR-5 (CRM on `mail.meeticulous.in`) not started.**
> Founder decision 2026-11-01: the public contact address is **`team@meeticulous.com`**;
> `hello@` survives only as the `news.` marketing *sender*.
> Decisions locked with founder: 2 Workspace seats (`team@` + `shubham@`), CRM =
> cold lists on a separate root, split transactional/marketing providers,
> `mail.meeticulous.in` repurposed for CRM cold outreach (not retired).

---

## Architecture (locked)

| Domain / subdomain | Root | Purpose | Provider | Addresses | Reply-to |
|---|---|---|---|---|---|
| `notify.meeticulous.com` | meeticulous.com | Transactional (must arrive) | **Resend** | `verify@ bookings@ payments@ account@` | `team@meeticulous.com` |
| `team.meeticulous.com` | meeticulous.com | Lifecycle (from a person) | **Resend** | `tithi@ shubham@` | `team@meeticulous.com` |
| `news.meeticulous.com` | meeticulous.com | Marketing (unsubscribe) | **Brevo** | `hello@` | `team@meeticulous.com` |
| `mail.meeticulous.in` | **meeticulous.in** (separate root) | CRM cold outreach | **Brevo** (or dedicated cold tool) | `shubham@ tithi@` | Hostinger inbox on `meeticulous.in` |

- **Inboxes (Google Workspace on meeticulous.com, 2 paid seats):** `team@` (support/ops), `shubham@` (comms). Free Google Groups: `support@`→team@, `hello@` (marketing sender on `news.`; the site's contact address is `team@`), `privacy@`, `dmarc@`.
- **Reputation isolation:** cold outreach stays on the `.in` root so a spam complaint never touches `meeticulous.com` transactional reputation.
- **App never sends via Gmail/Hostinger** — always the provider API (Resend/Brevo). Hostinger/Google only *receive*.

---

# Part A — Engineering plan

## A1. Current state (verified, file:line)

| Fact | Reality | Where |
|---|---|---|
| Sending domain | `mail.meeticulous.in` (live DB), NOT meeticulous.com | `email_settings.from_email`; migration `v3.175`; docs/current-work.md is **stale** |
| Reply-to | **Forced global** `SUPPORT_REPLY_TO \|\| support@meeticulous.com` on every provider send | `services/email/providers/index.js:41,60` |
| Reply-to (2nd path) | ad-hoc sends fall back to a dead old-brand `bolt@` address (fixed: now `team@`) | `utils/sendEmail.js:33` |
| ⚠️ Live bug | `support@meeticulous.com` has **no inbox** → replies bounce today | (no Workspace yet) |
| Provider | `resend` for everything; `MARKETING_PROVIDER='resend'` | `email_settings.provider`; `providers/index.js:35` |
| Shared budget | one Resend daily cap across transactional + marketing + CRM | `services/email/sendBudget.js` |
| List-Unsubscribe | **not implemented** anywhere (RFC 8058 missing) | grep: only a doc comment in emailLayout.js |
| Supabase Auth email | **does not send** — `admin.createUser({email_confirm:true})` + `generateLink` returns link without mailing | `authController.js:236,246` |
| Senders in DB | only `system`, `tithi`, `shubham` (all `@mail.meeticulous.in`); `durga`/`sujata` inactive | `email_senders` |
| Logos | already on `meeticulous.com/images/email/...` (PR #33/#40) | `emailLayout.js`, `emailThemes.js` |
| Prod DB | `spquowzrefozmrzoszkf` IS prod (only reachable; shipping target) | — |
| User-facing dead addr | client shows `bolt@meeticulous.in` ×30 + `ops@`,`superadmin@` (no inboxes) | `client/src` footer/contact/help/privacy/terms |
| Ad-hoc senders (bypass templates) | contact, enterprise lead, Bolt escalation, support actions, digests, weekly recap, admin alert, product email, CRM | `utils/sendEmail.js` callers list |

## A2. Target state

### `email_settings` (singleton, global fallback only)
```
from_name     = 'Meeticulous'
from_email    = 'verify@notify.meeticulous.com'   -- safe transactional default
support_email = 'team@meeticulous.com'
website_url   = 'https://meeticulous.com'
brand_color   = '#960D32'
provider      = 'resend'                          -- transactional default
```

### `email_senders` (per-sender from + reply-to + stream + provider)
Add a **`provider`** column (new) so each sender routes to the right ESP.

| sender_key | from_name | from_email | reply_to | stream | provider |
|---|---|---|---|---|---|
| verify | Meeticulous | verify@notify.meeticulous.com | team@meeticulous.com | transactional | resend |
| bookings | Meeticulous | bookings@notify.meeticulous.com | team@meeticulous.com | transactional | resend |
| payments | Meeticulous | payments@notify.meeticulous.com | team@meeticulous.com | transactional | resend |
| account | Meeticulous | account@notify.meeticulous.com | team@meeticulous.com | transactional | resend |
| tithi | Tithi \| Meeticulous | tithi@team.meeticulous.com | team@meeticulous.com | relationship | resend |
| shubham | Shubham \| Meeticulous | shubham@team.meeticulous.com | team@meeticulous.com | founder | resend |
| hello | Meeticulous | hello@news.meeticulous.com | team@meeticulous.com | marketing | brevo |
| crm_shubham | Shubham \| Meeticulous | shubham@mail.meeticulous.in | shubham@mail.meeticulous.in | crm | brevo |
| system | Meeticulous | verify@notify.meeticulous.com | team@meeticulous.com | system | resend |

### Template → sender_key (`emailTemplates.js` + seed)
Adopt the prompt's mapping (verified against the 46 templates):
- **verify:** BOOKING_OTP, AUTH_EMAIL_VERIFICATION, PASSWORD_RESET, SECURITY_PASSWORD_CHANGED, SECURITY_LOGIN_ALERT
- **bookings:** BOOKING_CONFIRMED/REMINDER/CANCELLED/RESCHEDULED/COMPLETED × _CUSTOMER/_VENDOR
- **payments:** PAYOUT_SENT/FAILED/VERIFICATION_NEEDED/DELAY_HOLIDAY, EARNING_REVERSED, REFERRAL_REWARD_RELEASED, SUBSCRIPTION_PURCHASED/RENEWED/HALTED/EXPIRING
- **account:** KYC_APPROVED/REJECTED, PROFILE_VERIFIED/REJECTED, FEEDBACK_STATUS_CHANGED
- **tithi:** VENDOR_WELCOME, PROFILE_COMPLETION_REMINDER, KYC_EARN_NUDGE, BOOKING_ABANDONED_CUSTOMER
- **shubham:** GUEST_WELCOME, MILESTONE_FIRST_BOOKING, BIRTHDAY, ACCOUNT_ANNIVERSARY
- **hello (news):** NEWSLETTER_WELCOME, REBOOK_NUDGE_CUSTOMER, UPGRADE_COMMISSION_NUDGE, GUEST_TO_HOST_INVITE, BADGE_UNLOCKED, MILESTONE_10/50/100_BOOKINGS + admin campaigns
- **crm_shubham (mail.meeticulous.in):** CRM sequences (`services/crm`)
- **Ad-hoc (`utils/sendEmail.js`) — assign explicitly:** contact form → `hello@news` (reply team@); enterprise lead → `hello@` or `team@`; Bolt escalation / support reply → `team@`; admin alerts/digests/recaps → from `notify` `account@`, to `team@`/`ADMIN_ALERT_EMAIL`; product download → `account@notify`.

### Env vars (Render + Vercel)
| Var | New value |
|---|---|
| `RESEND_FROM` | `verify@notify.meeticulous.com` |
| `RESEND_API_KEY` | (new Resend key scoped to meeticulous.com domains) |
| `BREVO_FROM` | `hello@news.meeticulous.com` |
| `BREVO_API_KEY` | (Brevo key) |
| `SUPPORT_EMAIL` | `team@meeticulous.com` |
| `SUPPORT_REPLY_TO` | `team@meeticulous.com` |
| `ADMIN_ALERT_EMAIL` | `team@meeticulous.com` (or shubham@) |
| `SUPER_ADMIN_EMAIL` | `shubham@meeticulous.com` |
| `SUPPORT_DIGEST_EMAIL` | `team@meeticulous.com` |
| `COLD_CALL_RECAP_EMAIL` | `shubham@meeticulous.com` |
| `RESEND_DAILY_CAP` | set to plan limit (transactional only now) |
| `SES_FROM`, `SMTP_*` | retire/unset unless still used |

## A3. PRs (merge order, each gated on an external precondition)

1. ✅ **PR-1 Sender infra (code, no behaviour change).** *(shipped: #49 + v3.176, #43/#50 reply-to)* Add `provider` column + per-stream provider routing in `deliver()`/`senderRegistry`; **remove the forced global reply-to** (`providers/index.js`) in favour of per-sender `reply_to` (default `team@`); add **`List-Unsubscribe` + `List-Unsubscribe-Post` headers** for `news.`/`team.`/CRM streams. Migration: `email_senders.provider` (both… one DB). Tests: provider-routing unit + header presence. **Precondition:** none (ships dark; DB still points at old domains).
2. ✅ **PR-2 Template sender_key remap + seed.** *(shipped: #46)* Update `emailTemplates.js` sender_key per A2; new `email_senders` rows (inactive until domains verified). **Precondition:** none (rows inactive).
3. ✅ **PR-3 Flip transactional to notify.** *(shipped: #46 via #49)* Activate verify/bookings/payments/account senders; update `email_settings` + env. **Precondition: `notify.meeticulous.com` VERIFIED in Resend; `team@` inbox exists.**
4. ✅ **PR-4 Flip lifecycle + marketing.** *(shipped: #47 lifecycle, #53 marketing)* Activate tithi/shubham (team.) and hello (news.) on Brevo. **Precondition: `team.` + `news.` verified; Brevo domain authenticated; one-click unsubscribe tested.**
5. ⏳ **PR-5 CRM onto mail.meeticulous.in.** *(not started)* Point `services/crm` sends at `crm_shubham`/Brevo-cold. **Precondition: Hostinger mailboxes + mail.meeticulous.in cold-stream verified.**
6. 🟡 **PR-6 Cleanup.** Replace user-facing `bolt@meeticulous.in` etc. in `client/src` with `team@meeticulous.com`; scrub old-brand server refs + supportAgents; retire SES/SMTP. *(shipped in #56 except retiring SES/SMTP)* **Precondition:** everything above live.

> All sender/domain switches are **DB/env flips** (instant rollback) wherever possible; code PRs only add capability, they don't hard-code a domain.

## A4. Cutover order & rollback
Verify domain in ESP → activate its `email_senders` rows (DB) → smoke one email → if bad, set rows `active=false` (reverts to global `email_settings` default). Transactional first, then lifecycle, then marketing, then CRM. **Never activate a sender whose domain isn't verified.**

## A5. Risks (ranked)
1. **Reply-to bounce (LIVE NOW)** — fix first: create `team@` + set `SUPPORT_REPLY_TO`.
2. **Shared provider budget** — a campaign starves OTP/booking. Fixed by split (PR-1/4).
3. **New-subdomain reputation** — warm-up required; marketing/CRM OFF until transactional is warm.
4. **Missing List-Unsubscribe** — Gmail/Yahoo may spam-folder marketing; add in PR-1.
5. **Ad-hoc senders** forgotten → wrong From/reply-to; PR-1/6 assign them explicitly.
6. **Cold outreach on .in** damaging if list quality poor — keep strictly separate root; monitor complaints.

---

# Part B — Your task list (hand work, in order)

> Legend: **Before** = which PR/step needs it · **Check** = how to confirm · **Cost/time**.

1. **Buy Google Workspace (meeticulous.com), 2 seats** `team@`, `shubham@`. Verify domain ownership (TXT). **Before:** PR-3. **Check:** can log into both mailboxes. **~₹136–770/user/mo; 30 min + DNS propagation.**
2. **Google MX + SPF + DKIM for meeticulous.com root** (Google's records; DKIM from Admin console). **Before:** receiving at team@/support@. **Check:** send from an outside Gmail to `team@meeticulous.com` → arrives. **15 min + up to 24h.**
3. **Create Google Groups** `support@`(→team@), `hello@`, `privacy@`, `dmarc@`; set "Who can post" = anyone on the web (so outside mail/DMARC reports arrive). **Before:** reply-to + DMARC reporting. **Check:** external email to each lands. **15 min.**
4. **DMARC record** `_dmarc.meeticulous.com` TXT = `v=DMARC1; p=none; rua=mailto:dmarc@meeticulous.com; adkim=s; aspf=s; fo=1`. (Already exists on meeticulous.in as `p=none` — add rua there too.) Move to `p=quarantine` after ~2 wks clean, `p=reject` after ~4–6 wks. **Before:** PR-3 (nice-to-have). **Check:** mxtoolbox DMARC lookup; aggregate reports arrive at dmarc@. **10 min.**
5. **Verify 3 subdomains in Resend** (`notify.`, `team.`, and keep `mail.meeticulous.in`): add Resend's SPF/DKIM/return-path CNAMEs per subdomain. **Before:** PR-3/4. **Check:** Resend dashboard = "Verified". **20 min + propagation.**
6. **Set up Brevo** (marketing): authenticate `news.meeticulous.com` (+ `mail.meeticulous.in` for CRM if cold via Brevo). Add Brevo SPF/DKIM. **Before:** PR-4/5. **Check:** Brevo "Authenticated". **20 min.**
7. **Hostinger mailboxes on meeticulous.in** for cold-outreach replies (e.g. `shubham@mail.meeticulous.in`). MX for meeticulous.in → Hostinger (NOT Google — different root, fine). **Before:** PR-5. **Check:** reply to a cold email reaches Hostinger inbox. **~₹60–100/mo; 20 min.**
8. **Cloudflare: every email DNS record = DNS-only (grey cloud).** **Before:** steps 2/5/6 verify. **Check:** orange cloud off on MX/TXT/CNAME email records.
9. **Google Postmaster Tools** — add meeticulous.com, verify. **Before:** warm-up monitoring. **Check:** data appears after volume. **10 min.**
10. **Render env vars** — set per A2 (`RESEND_FROM`, `BREVO_*`, `SUPPORT_EMAIL`, `SUPPORT_REPLY_TO`, `ADMIN_ALERT_EMAIL`, etc.). **Before:** PR-3. **Check:** a test send shows the new From/reply-to.
11. **Update contact email in outside dashboards:** Razorpay (settlement/support), Google OAuth consent screen (support + dev email → team@/shubham@), Supabase project email, Meta (lead-ads / business), AiSensy, domain registrar WHOIS. **Before:** go-live. **Check:** each dashboard shows the new address.
12. **Warm-up schedule:** week 1 transactional only (tens→hundreds/day); week 2 add lifecycle; week 3+ marketing; CRM cold last, lowest volume, separate ramp. Keep bounce <2%, complaints <0.1%. **Before:** turning marketing/CRM back on.

---

# Part C — Final verification ("everything works")

After each cutover step, trigger one email per active sender and confirm in Gmail:

| Sender | Trigger | Must be |
|---|---|---|
| verify@notify | request login OTP | **Primary**, SPF/DKIM/DMARC PASS |
| bookings@notify | make a test booking | **Primary** |
| payments@notify | subscription/payout | **Primary** |
| account@notify | KYC approve | **Primary** |
| tithi@team | host welcome | Primary (lifecycle) |
| shubham@team | guest welcome | Primary |
| hello@news | newsletter subscribe | Updates/Promotions OK + **working unsubscribe** |
| crm (mail.in) | CRM sequence | lands; reply reaches Hostinger |

For each: **Show original** → SPF=PASS, DKIM=PASS, DMARC=PASS; From name correct; **reply reaches `team@`** (or Hostinger for CRM); unsubscribe link resolves; no dead old-brand or `bolt@` address anywhere in header or body.

---

## Open items for you to confirm before PR-1
1. Marketing/CRM provider = **Brevo** (already wired in code/env) — confirm, or prefer a different ESP (e.g. second Resend account, or a dedicated cold tool like Instantly for CRM)?
2. Cold CRM via **Brevo on mail.meeticulous.in**, or a dedicated cold-email tool (better for cold deliverability + separate reputation)?
3. `support@meeticulous.com` as a Group → `team@`, or make `team@` the only support address and skip support@?
