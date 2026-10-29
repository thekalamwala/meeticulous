# Community Forum — Product Spec

**Status:** Draft (pre-build)
**Route:** `meeticulous.com/community`
**Owner:** _TBD_
**Last updated:** 2026-07-11

---

## 1. One-line summary

A login-gated, native, lightweight discussion forum where verified guests and hosts
post threads and reply to each other — built in-house, shipped light, iterated over time.

## 2. Goals

| # | Goal | How this serves it |
|---|------|--------------------|
| 1 | **Retention** | Peers solve each other's problems; hosts get a shop-talk room |
| 2 | **Support** | Public Q&A deflects tickets off `bolt@meeticulous.in`; answers self-serve |
| 3 | **Brand** | A visibly alive community; hosts share wins → free distribution |
| 4 | **Ambassador fuel** | Hosts who get value here tell other hosts to join |

## 3. Non-goals (explicitly dropped)

- ❌ **SEO / guest lead generation.** No public, Google-indexed content. This is **not** a
  Practo/Quora acquisition play. Community is for existing customers and hosts only.
- ❌ **Buying a forum tool** (Discourse/Circle/Bettermode). Cost-prohibitive at this stage.
  Build native, keep it light, iterate.
- ❌ Full social network — no feeds, follows, DMs.
- ❌ Public/anonymous access. **Login-gated to verified accounts only.**

## 4. Audience & access

- **Guests** — verified via WhatsApp/email OTP (phone is identity).
- **Hosts** — verified via Google.
- **Staff/Admin** — existing admin panel.

Every participant is already a **verified real account** — this is the primary spam gate.
No anonymous access. Reputation attached to a real, reachable identity does most of the
moderation work; tooling is the backstop.

## 5. Spaces (v1)

| Space | Who can post | Purpose |
|-------|--------------|---------|
| **Discussions** | everyone | General community talk |
| **Support & Bugs** | everyone | Help + bug reports; staff-monitored; deflects tickets |
| **Ideas / Feature Requests** | everyone | Wired to existing `feedback` table (v3.20) |
| **Host Corner** | **hosts only** | Peer business talk, away from customers — the retention magnet |

- Host Corner is gated **not for spam** (verified accounts solved that) but because hosts
  want a room to talk shop without customers watching.
- **Read access:** all spaces readable by any authenticated account **except Host Corner**,
  which is readable + writable by `is_host` only.
- **v1.1 add:** *Wins / Show & Tell* space — hosts brag, screenshot, share to their own
  socials (ambassador fuel).

## 6. Identity & privacy

**Guests do not have usernames — only a first name.** That is sufficient.

- **Public label** = `first_name` + auto-generated avatar + role badge (Guest / Host).
- **Real identity** lives in `author_id` (the verified account). All moderation, banning,
  and tracing key off `author_id` — **never** off the display name.
- **Collisions are cosmetic only.** Five "Rahul"s are fine; admin bans the *account*.
- **Disambiguation:** deterministic colored avatar derived from `author_id`
  (initial on a hashed background color). No extra data stored.
- **Fallback:** guest with blank/missing first name → display "Member".

> ⚠️ **PHONE NUMBERS MUST NEVER BE SHOWN.** Guest identity is a phone number internally.
> The forum surfaces first name + avatar only. No phone, ever, anywhere in the UI or API
> response payloads.

**Skipped:** `display_name` column, username-creation flow, uniqueness checks.
Reuse the `first_name` already on the profile. Hosts already have public `@handle` profiles.

## 7. Data model

Next available migration version (e.g. `v3.69`) — **apply to BOTH DBs** (prod Mumbai +
staging Tokyo) per project workflow, keep code-side schema fallback until confirmed.

```
community_posts
  id           uuid pk
  author_id    uuid  -> profiles.id
  space        text  (discussions | support | ideas | host_corner)
  title        text
  body         text
  status       text  (active | hidden | deleted)   default 'active'
  is_pinned    boolean default false
  reply_count  int   default 0
  created_at   timestamptz
  updated_at   timestamptz

community_replies
  id           uuid pk
  post_id      uuid  -> community_posts.id
  author_id    uuid  -> profiles.id
  body         text
  status       text  (active | hidden | deleted)   default 'active'
  created_at   timestamptz
  updated_at   timestamptz

community_flags            -- the one justified extra table: legal audit trail (IT Rules)
  id            uuid pk
  target_type   text  (post | reply)
  target_id     uuid
  reporter_id   uuid  -> profiles.id
  reason        text
  status        text  (open | resolved | dismissed)  default 'open'
  resolved_by   uuid  -> profiles.id  (nullable)
  resolved_at   timestamptz          (nullable)
  created_at    timestamptz
```

- **Flat replies** — no nested/threaded replies in v1 (nested ≈ 3× the work).
- `status = deleted` renders as "[deleted]" — never hard-delete (moderation + audit).
- **RLS:** authenticated-only reads; Host Corner reads gated on `is_host`; writes limited
  to `author_id = auth.uid()`; admin via service role. (Project has prior anon-exposure
  incidents — RLS is mandatory, verify with introspection before launch.)

## 8. Features — v1 scope

- Post a thread (title + body, plain text + line breaks)
- Reply (flat list)
- **Edit / delete own post & reply** (soft delete → "[deleted]")
- Author card: avatar + first name/@handle + role badge
- Sort: **Recent** | **Most replies**
- **Flag button** on every post/reply → writes to `community_flags`
- **Admin moderation:** hide, delete, ban-from-community, resolve flags (in existing admin panel)
- **Pin / announcement** (staff only) — `is_pinned`
- **Reply notifications** (see §10)
- **Basic keyword search** — scoped to Support space at minimum (prevents 50× duplicate Qs)
- **Mobile-first responsive** — reuse host mobile foundation primitives; India is mobile-first
- **Link handling** — strip or `rel="nofollow"` all user-posted links (phishing/spam vector)
- **Rate-limit posting** — reuse existing security middleware (verified ≠ unlimited)
- **Metrics instrumented from day 1** (see §11)

## 9. Trust, Safety & Legal

This is the part that is **not code** — operational + legal commitments. Sort before launch.

### 9.1 India IT Rules 2021 (intermediary compliance) — **mandatory**
Hosting user-generated content makes Meeticulous an "intermediary." Required:
- Published **community guidelines + user agreement**, visible before posting.
- A **named Grievance Officer** with published contact details.
- Complaint acknowledgment within **24h**, resolution within **15 days**.
- Unlawful-content takedown within **36h** of a valid order/complaint.
- `community_flags` provides the complaint audit trail.

### 9.2 Defamation / naming-and-shaming policy — **mandatory**
- **No naming specific hosts negatively.** Guest grievances about a specific host
  ("Host X scammed me") are **routed to support, not posted publicly.**
- Reviews are the sanctioned, structured, booking-tied channel — the forum is not.
- Host-vs-host sniping in Host Corner (competitors in one room) is moderated the same way.
- Rationale: a public dispute you *host* = your liability + reputational damage.

### 9.3 Community guidelines page
Rules users see and accept before first post. Legal cover + tone-setting. Ties to §9.1.

### 9.4 Daily moderation ownership — **name the owner**
Moderation is an ongoing human cost, not a shipped feature. Assign an owner and a daily
time budget, or the flag queue rots. Define escalation SLA aligned to §9.1 timelines.

## 10. Notifications

- **Reply notification is the core retention loop.** Without it, engagement dies.
- **Channels:** in-app (existing notification engine) **+ email** (working SMTP).
  **Do NOT rely on WhatsApp** — Twilio is disabled (stubs only).
- **Classification:** community notifications are **transactional** (reply-to-your-post),
  not marketing — but confirm against the existing HMAC email-unsubscribe system so
  preferences and CAN-SPAM-style handling are correct.
- **v1.1:** per-thread mute / notification preferences.

## 11. Distribution & cold-start

An empty forum is the #1 killer. Two commitments, both operational:

- **Seed 20–30 real threads** (staff + a few friendly hosts) **before** opening.
- **Staff commits to answering every early thread** for the first few months. Cold-start is
  sustained effort, not a one-time seed.
- **Funnel — how users find `/community`:**
  - Nav link
  - Post-booking nudge
  - Host & guest dashboard widget
  - Email invite / announcement

## 12. Metrics (wire PostHog from day 1)

- Posts/day, replies/day
- **Time-to-first-reply** (health of the answer culture)
- **% of threads answered**
- DAU/WAU in `/community`
- Funnel: entry-point → first post
- Flag volume + resolution time (also feeds §9.1 compliance)

## 13. Reuse map (build less)

| Need | Existing asset |
|------|----------------|
| Identity (guest OTP + host Google) | AuthContext |
| DB + row security | Supabase + RLS |
| Moderation UI | admin panel + `admin/ui` primitives + `--adm-*` tokens |
| Reply notifications | notification engine + event keys |
| Feature-request storage | `feedback` table (v3.20) |
| Spam / abuse defense | IP blocking, rate limits, security middleware |
| Analytics | PostHog (full-stack) |
| Mobile UI | host mobile foundation (`dashboard/ui`) |
| Backend pattern | `server/controllers/` + `server/routes/` Express + Supabase |

Net new code ≈ 3 tables + a controller + routes + a handful of pages. Small.

## 14. Roadmap after v1

- **v1.1:** Wins / Show & Tell space, reactions/upvotes, "was this helpful" on Support,
  per-thread mute.
- **v1.2:** Full-text search across all spaces.
- **Later (only if earned):** image uploads (Cloudinary is wired, don't turn on yet),
  rich text/markdown, badges/leaderboards, following.

## 15. Open items to close before build

- [ ] Name the **Grievance Officer** (§9.1)
- [ ] Name the **daily moderation owner** (§9.4)
- [ ] Draft **community guidelines** copy (§9.3)
- [ ] Confirm `first_name` exists/populated on guest profiles; define "Member" fallback
- [ ] Confirm community emails classification vs HMAC unsubscribe system (§10)
- [ ] Assign the seed-content + early-answer staff commitment (§11)
- [ ] Build Bolt's RAG knowledge base from `docs/` / FAQ / policies (§16)
- [ ] Add Bolt kill-switch to feature-flag registry (§16)
- [ ] Set Bolt daily API cost cap (§16)

## 16. Bolt — AI first-responder

An AI agent account, **`bolt958`** (already exists on Meeticulous), acts as the first
responder to community questions, problems, and concerns. It answers what it can from a
grounded knowledge base and **escalates the rest to the human owner** (`sndatarkar`).

> **Clarification:** "trained" here means **system prompt + retrieval (RAG) + few-shot
> examples** — **not** model fine-tuning. Bolt is Claude (via `ANTHROPIC_API_KEY`) reading
> from a curated knowledge base at answer time.

### 16.1 Identity
- `bolt958` = existing account, flagged with a **`bot`/`system` role** so it is not treated
  as a guest or host.
- **"AI Assistant" badge** shown on every Bolt post — AI must be disclosed, never passed off
  as human.
- Posts via a **server-side path** (service identity keyed to `bolt958.author_id`), not
  interactive login.

### 16.2 Brain
- **Model:** Claude via `ANTHROPIC_API_KEY` (shared with Write-with-Bolt).
- **Persona system prompt** defining voice, scope, and refusals.
- **Knowledge base (RAG) — highest-priority dependency.** Bolt grounds every answer in
  `docs/`, FAQ, help pages, and policies. **No grounding = confident wrong answers =
  liability.** Build this first.
- **Guardrails — hard refuse + escalate:** medical / legal / financial advice, refund or
  pricing promises, naming any host negatively. These never get an answer — they escalate.

### 16.3 Trigger
- **v1 (lazy):** a **cron** (existing Render cron infra) polls for unanswered posts every
  few minutes → Bolt reads → drafts → posts.
- **Later:** real-time webhook on new-post insert.
- **Watches:** Support & Bugs, Discussions, Ideas. (Host Corner excluded by default.)

### 16.4 Escalation → human
- **Escalate when:** low confidence, feature suggestion, complaint/concern, or anything
  touching money / legal / host disputes.
- On escalate, Bolt posts "**@sndatarkar** will review this" **and** fires an **email to the
  owner** (reuse notification engine + SMTP) with a **deep link to the thread**.
- The post is flagged **`escalated / awaiting-human`** so it cannot be lost.
- Owner logs in → verifies → replies.

### 16.5 Human-in-loop controls (mandatory)
- **Kill switch** — register in the existing **feature-kill-switch system** so Bolt can be
  muted in one click. Non-negotiable.
- **Loop protection** — Bolt **never replies to a bot (including itself)**. One guard,
  prevents infinite reply loops (and runaway API spend).
- **API cost cap** — rate-limit Bolt's calls + a hard daily spend ceiling.
- **Audit log** — every Bolt action (question, answer, tokens, escalate y/n) for review +
  IT Rules trail (§9.1).

### 16.6 Legal boundary
- **Bolt is NOT the Grievance Officer.** A bot may intake, acknowledge, and route, but
  cannot be the legally accountable person under IT Rules 2021. **`sndatarkar` (a human)
  remains the named Grievance Officer** (§9.1). Bolt escalates; the human stays accountable.

### 16.7 The three that break it if wrong
1. **RAG grounding** — build the knowledge base before anything else.
2. **Kill switch** — one-click mute, always available.
3. **Loop protection** — bot-replies-to-bot = runaway loop + runaway bill.

### 16.8 What you need to have (checklist)
- [ ] `bot` role flag + "AI Assistant" badge on `bolt958`
- [ ] Server-side posting path for the bot identity
- [ ] Persona system prompt
- [ ] RAG knowledge base from `docs/` / FAQ / policies
- [ ] Guardrail + escalation rules
- [ ] Cron poller for unanswered posts (Render)
- [ ] Escalation email → owner via notification engine (deep link)
- [ ] `escalated / awaiting-human` post flag
- [ ] Kill switch in feature-flag registry
- [ ] Loop protection guard (never reply to a bot)
- [ ] API rate-limit + daily cost cap
- [ ] Bolt action audit log

---

### Decisions locked (from discovery)
1. Native, light build; iterate over time — **not** bought.
2. Login-gated to verified accounts; **no SEO, no leads, no public**.
3. Four spaces: Discussions, Support & Bugs, Ideas, Host Corner (host-only).
4. Flat replies; flag + admin-hide; soft-delete only.
5. Guests = first name + hashed-color avatar + badge; `author_id` is real identity;
   **phone never shown**; "Member" fallback.
6. Notifications via in-app + email (not WhatsApp).
7. Ideas space → existing `feedback` table.
8. Seed + sustained staff answers before/after launch.
9. All 14 gap items (§8–§12) are in scope for the product.
