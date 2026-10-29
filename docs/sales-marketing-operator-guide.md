---
title: "Book A Sloth — Sales & Marketing Operating Guide"
subtitle: "How to run the growth engine, one person, without living in the CRM"
author: "Book A Sloth"
date: "August 2026"
---

# Welcome

This guide is for the **one person** who runs Sales **and** Marketing at Book A Sloth. It explains the system we built to do the repetitive work for you, so your day is spent on real conversations — not hunting through a lead list or copy‑pasting messages.

**The one idea to remember:**

> **Software handles the repetitive work. Marketing creates demand. Sales handles the meaningful conversations. You step in only when human judgement actually matters.**

Everything below flows from that.

---

# 1. What the system does for you

Before, a lead who signed up was invisible until someone ran a script, and 197 of 203 leads sat untouched. Now:

- **Leads create themselves** — every signup, booking, enterprise enquiry and newsletter sign‑up becomes a lead automatically, the moment it happens.
- **The system scores and sorts them** — a deterministic score (0–100) and an intent level (low / medium / high / activated) are set automatically from what the lead actually did.
- **It moves them along** — a background engine advances each lead's stage, decides the next best action, and enrols the right nurture sequence.
- **It surfaces only what needs you** — the **Sales Desk** shows five short queues of leads that need a human. You work top to bottom.
- **It sends the routine messages** — nurture sequences and reminders go out on a schedule, safely rate‑limited, so you never send the same intro by hand.

You focus on: replies, high‑intent leads, demos, pricing, objections, closing.

---

# 2. Your daily workflow

### Morning (10–15 minutes)
1. Open **`/admin/sales`** — this is your **Sales Desk**.
2. Work the queues **top to bottom**:
   - 🔥 **Needs Attention** first, then 🔵 **Replies**, 🟠 **Follow‑ups**, 🟢 **High Intent**, 🟣 **Activation**.
3. For each card: open it, read the timeline, do the human thing (reply, call, book a demo), then dispose of it (Won / Lost / Snooze / To nurture).

### During the day
- The system keeps working on its own: scoring, staging, nurturing, capturing engagement.
- New replies and new high‑intent leads appear in your queues automatically. Check back a couple of times.

### Evening (5 minutes)
- Clear any remaining 🔵 **Replies** so nobody is left waiting overnight.
- Glance at 🟢 **High Intent** — anything hot you want to catch tomorrow morning?

**You should not be searching the full lead list day‑to‑day.** If a queue is empty, that part of your job is done.

---

# 3. The Sales Desk — your home screen

Open **`/admin/sales`**. Five queues, each auto‑filled by rules. Every card shows **why** it's there (reason chips), the **score/intent** badge, the **recommended next action**, and when it was last touched. Click any card to open the lead.

| Queue | What's in it | What you do |
|---|---|---|
| 🔥 **Needs Attention** | The most urgent: someone replied and hasn't been answered, a follow‑up is overdue, or a high‑value lead has gone quiet 7+ days | Start here every day |
| 🔵 **Replies** | Leads who replied to a message and haven't heard back | Reply — same day |
| 🟠 **Follow‑ups due** | Tasks you (or the system) scheduled, due today or overdue | Do the task, then mark it done |
| 🟢 **High Intent** | Strong buying signals, not yet claimed by anyone | Reach out personally |
| 🟣 **Activation** | Signed‑up hosts who haven't gone live or haven't got their first booking | Help them over the line |

> A lead can appear in **Needs Attention** and its category queue at the same time — that's intentional. Needs Attention is the "do these first" list.

---

# 4. Working a single lead

Click a card to open the **lead panel** (a slide‑over). From here you can:

- **See the full timeline** — every message sent, every reply, every status change, every intent signal, in one place. *You never have to ask "what has already been sent to this person?"*
- **WhatsApp / Email** — send an approved WhatsApp template or a personal email.
- **Log Call** — record the outcome of a phone conversation.
- **Note** — an internal note only your team sees.
- **Follow‑up** — schedule a reminder ("chase on Tuesday").
- **Enrol** — put this lead into a nurture sequence.
- **Stage buttons** — move the lead through the funnel by hand if you need to.
- **DNC** — mark Do Not Contact (stops all marketing to them).

### Card quick‑actions (on the Desk, without opening)
- **Snooze 2d** — schedule a follow‑up two days out.
- **To nurture** — hand the lead back to automated nurturing.
- **Won** / **Lost** — close the lead (asks you to confirm).

---

# 5. Sending messages — three ways

| Way | Use it for | Where |
|---|---|---|
| **Single send** | One personal message to one lead | Lead panel → WhatsApp / Email |
| **Bulk send** | The same template/email to many selected leads at once | Leads list → tick leads → WhatsApp / Email / Enrol |
| **Sequence** | An automated multi‑step drip over days | Sequences page + Enrol on a lead |

### Bulk send (many leads at once)
1. Go to the **Leads** list (`/admin/sales/leads`).
2. Tick the leads you want (or the header checkbox for all on the page).
3. On the selection bar: **WhatsApp**, **Email**, or **Enrol**.
4. Pick the template / write the email / pick the sequence → **Queue send**.

Bulk sends are **queued and rate‑limited** (see §9) — a blast can never spam. WhatsApp bulk messages are personalised per lead automatically (each person sees their own name).

---

# 6. Templates and Sequences

### Templates (`/admin/sales/templates`)
Reusable messages the team sends from.
- **WhatsApp templates**: the **name must be the exact approved AiSensy campaign name**. WhatsApp only allows pre‑approved templates for first contact — you cannot free‑type a WhatsApp message to a cold lead.
- **Email templates**: a subject + body you can reuse. Supports personal tokens like `{{first_name}}`, `{{business_name}}`, `{{booking_link}}`.

### Sequences (`/admin/sales/sequences`)
Automated journeys — a series of steps, each with a channel and a delay.
- Build one with **+ New sequence**: name it, add steps (email = subject + body; WhatsApp = pick an approved template), set delays.
- **Stop on reply / Stop on convert** are on by default: the moment a lead replies or converts, the sequence stops and hands them to you.
- Enrol a lead from the **Enrol** button on their panel, or in **bulk** from the leads list.

**The four built‑in nurture journeys** (already loaded, currently switched off until go‑live):
1. **New Lead nurture** — cold leads. *(Off; becomes a WhatsApp journey once its templates are approved.)*
2. **Signed‑up‑not‑activated** — welcome → complete profile → add service → share link → offer help.
3. **Activated‑no‑booking** — "your page is ready" → 3 ways to get the first booking → offer help.
4. **Win‑back** — "still thinking?" → what's new.

> Personalised nurturing runs on **email** today (each lead's name/details filled in). WhatsApp sequence steps are template‑only (no per‑lead fill‑in yet).

---

# 7. Understanding a lead

### Statuses (the funnel)
`new → contacted → replied → qualified → demo_scheduled → trial → activated → paid`
plus `lost` and `do_not_contact`.
The engine moves most of these for you; you can override with the stage buttons.

### Score (0–100) and Intent
Set automatically from real signals: stage, whether they have phone/email, revenue, source, how recently they engaged, and intent events (see below).
- **High intent (≈70+)** → send to Sales (you). Appears in 🟢 High Intent.
- **Medium** → keep nurturing, review occasionally.
- **Low** → nurturing handles it.
- **Activated** → they've converted; out of acquisition, into onboarding/retention.

### Next action
Each lead carries a recommended next action (e.g. "Human contact", "Enrol: Activated‑no‑booking"). It's a suggestion from the rules — you decide.

---

# 8. Where leads come from (automatic)

You don't add these by hand — they appear on their own:

| Source | Created when |
|---|---|
| `host_signup` | Someone signs up as a host |
| `guest_booking` | A guest completes a paid booking |
| `enterprise_page` | Someone submits the Enterprise enquiry form |
| `newsletter` | Someone subscribes to the newsletter |

**Intent events** (pricing viewed, demo requested, enterprise enquiry, newsletter sign‑up) that carry an email or phone are captured too, and make the matching lead rank hotter automatically.

You still add leads manually (or import a CSV) for cold outreach — but the warm ones arrive by themselves.

---

# 9. Safety rails — how the system protects your leads (and your name)

These run automatically. Know them so nothing surprises you.

- **Master send switch (`crm_admin_sends`)** — the on/off for **all** automated Sales/Marketing sending. When **off**, messages are *recorded but not sent*. This is your emergency brake.
- **Frequency cap** — at most **one automated message per lead every 48 hours**, across all sources. No one gets buried.
- **Quiet hours** — automated sends only go out **9am–8pm IST**. Outside that, they wait.
- **Do Not Contact** — a DNC lead receives nothing.
- **Opt‑out** — anyone who unsubscribes (email) or replies STOP (WhatsApp) is suppressed automatically, forever.
- **One conversation** — because everything shares one timeline and one gate, a lead never gets the same thing from three different tools at once.

Transactional messages (booking confirmations, OTPs, reminders) are separate and always send — the rails above apply only to Sales/Marketing outreach.

---

# 10. Marketing ↔ Sales handoffs

- **Marketing → Sales**: when a lead becomes high‑intent or replies, the system creates a **sales task** and surfaces them in your queues. You'll see *why* they qualified and *what was already sent*.
- **Sales → Marketing**: when you dispose of a lead —
  - **Not ready** → "To nurture" puts them back in an automated journey.
  - **Not now** → snooze / schedule a follow‑up.
  - **Lost** → mark Lost (they can enter a win‑back journey later).
  - **Won** → mark Won; they leave acquisition and move to retention.

This keeps you from carrying dead leads forever, and keeps warm leads from going cold.

---

# 11. Going live (one‑time)

The engine is deployed and leads are already being scored and staged. **Sending is currently OFF and the nurture sequences are switched off** — deliberately, so you control the exact moment real messages start.

When you're ready to turn the engine on:

1. **Look around** `/admin/sales` for a day — confirm the queues and lead stages look right with sends still off.
2. **Turn the nurture sequences on** — in Sequences, activate *Signed‑up‑not‑activated*, *Activated‑no‑booking*, and *Win‑back*.
3. **Flip the master send switch on** — Admin → Settings → Feature Flags → `crm_admin_sends`.
4. **Watch the first hour** — check that messages are sending, capped, and within quiet hours.

**To stop everything instantly at any time:** turn the master send switch **off**. Messages are recorded, not sent, until you turn it back on.

---

# 12. Weekly rhythm

- **Every day:** clear 🔵 Replies; work 🔥 Needs Attention and 🟢 High Intent.
- **Weekly:** skim 🟣 Activation — who signed up but hasn't gone live? Nudge or call.
- **Weekly:** glance at Lost leads worth a win‑back.
- **Monthly:** review which templates/sequences convert; retire the dead ones.

---

# 13. Quick reference

| I want to… | Go to |
|---|---|
| See who needs me today | `/admin/sales` (Sales Desk) |
| Work one lead | Click any card → lead panel |
| Message many at once | `/admin/sales/leads` → tick → WhatsApp/Email/Enrol |
| Build an automated journey | `/admin/sales/sequences` |
| Manage message templates | `/admin/sales/templates` |
| Stop all sending now | Turn `crm_admin_sends` **off** |

### Glossary
- **Lead** — a prospect or customer record; the source of truth for Sales.
- **Contact** — the marketing‑audience version of a person (leads sync to contacts so campaigns can reach them).
- **Sequence** — an automated multi‑step drip.
- **Score / Intent** — automatic ranking of how hot a lead is.
- **Kill‑switch** — the master on/off for automated sending.

---

# 14. Troubleshooting

**"I queued a send but nothing arrived."**
- Is the master switch on? If `crm_admin_sends` is off, sends are recorded, not sent.
- Is it outside 9am–8pm IST? It will wait for the window.
- Did this lead get a message in the last 48h? The frequency cap deferred it.
- Is the lead DNC or opted‑out? Then it's correctly blocked.

**"A lead won't move stages."**
- The engine runs every 15 minutes; give it a tick. You can always move it by hand.

**"I can't type a WhatsApp message."**
- WhatsApp first‑contact must use an **approved template**. Add it in Templates (name = exact AiSensy campaign name), or use email.

**"Where did this lead come from / what was sent?"**
- Open the lead → the timeline shows everything: source, every message, every reply, every intent signal.

---

*You don't need to run the machine. You need to have the conversations the machine surfaces. Open the Sales Desk, work top to bottom, and let the rest run itself.*
