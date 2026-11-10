# Community — Email Plan

Modelled on LinkedIn's email mix (studied 50 threads, 2026-11-02 → 2026-11-10).
LinkedIn ships ~5–7 mails/week per active user across 7 sender roles. Each mail
does ONE job, carries the user's first name + one specific number, and routes to
exactly one deep link. We copy the mix, not the volume.

Sits inside the existing stack: NotificationEngine (double-gated: feature flag +
per-event `is_active`/`email_enabled`), touchGovernor (1/48h cap), sendGate
(09–20 IST), `community_members.email_replies` as the blanket opt-out, Loop &
Slot design, Shubham/Tithi voices.

---

## 0. State today (after PR #213)

**Live user mails (in `server/services/community/notify.js`):**
- `COMMUNITY_REPLY` — in-app + email, 1 per hour per recipient
- `COMMUNITY_MENTION` — in-app + email, 1 per hour per recipient
- `COMMUNITY_CONTENT_REMOVED` — in-app + email, always sends

**Live admin mails (in `server/services/community/tithiWorker.js`):**
- **Tithi release-note draft** → `team@meeticulous.com` when AUTOPOST=false
- **Tithi escalation** (sensitive / abuse / budget cap) → team@ holding-line mail
- **Nightly founder digest** — new posts, Tithi posts, still-unanswered → founder

Everything else below is pending.

---

## 1. LinkedIn pattern → Meeticulous community mapping

| LinkedIn mail | Role | Our equivalent |
|---|---|---|
| "You have 1 new invitation" | **Transactional, 1:1** | `COMMUNITY_REPLY` ✓ seeded · `COMMUNITY_MENTION` ✓ seeded · `COMMUNITY_FOLLOW_NEW` · `COMMUNITY_ANSWER_ACCEPTED` · `COMMUNITY_POST_MILESTONE` (10/50/100 likes) |
| "your posts got 32 impressions last week" | **Weekly recap, personal** | `COMMUNITY_WEEKLY_YOU` — Mon 09:00 IST |
| Newsletter: "The Trust Premium" | **Editorial, bi-weekly** | `COMMUNITY_FOUNDER_NOTE` — 1st & 15th, Shubham voice |
| "Don't miss conversations in AI Innovators Network" | **Space nudge** on silence | `COMMUNITY_SPACE_NUDGE` — fires only after 3-day opener gap AND fresh activity in a space the user follows |
| "Devaiah Bopanna and Harshil Karia are hiring" | **Social proof, network** | `COMMUNITY_NETWORK_ACTIVITY` — Wed, when ≥2 followed hosts posted this week |
| "You may be a fit for X role" | **Match / opportunity** | `COMMUNITY_QUESTION_MATCH` — unanswered questions tagged with your profession, max 2×/week |
| Thought-leadership digest | **Best-of digest** | `COMMUNITY_DIGEST` — Thu 10:00 IST, top 5 posts + 3 unanswered in your spaces |

**Dropped on purpose:** no job-alert-style daily bulk, no login PIN clones. We
have one lifecycle track, not seven senders — the mix is enough with less noise.

---

## 2. The 11 events — spec

Every event doubles up the existing notification pattern (event_key in
`notification_events`, template row in `email_templates`, flag in
`feature_flags`). All default `whatsapp_enabled=false` (community mail is NOT a
WA channel — spec §10 confirms in-app + email only). All sit behind one master
flag `community_email` so the whole track can be killed in 60s.

### Transactional (instant, no cap, no quiet hours gate)

**COMMUNITY_REPLY** ✓ seeded in v3.185
- Trigger: a comment lands on a post/comment you authored (and you're not the commenter)
- Subject: `{{replier_first}} replied to your {{post|comment}}`
- Body: 2-line snippet + "Open thread" CTA · Tithi voice
- Dedupe: per `comment_id` (notification_logs.metadata)
- Template param order (WA-ready, even though WA stays off): `[your_first, replier_first, snippet_120, thread_url]`

**COMMUNITY_MENTION** ✓ seeded in v3.185
- Trigger: `@your_handle` in a post or comment (from `community_mentions` row insert)
- Subject: `{{mentioner_first}} mentioned you`
- Dedupe: per `mention_id`
- Params: `[your_first, mentioner_first, snippet_120, thread_url]`

**COMMUNITY_FOLLOW_NEW** — new event
- Trigger: `community_follows` INSERT where followee = you
- Subject: `{{follower_first}} is now following you`
- Body: follower's bio line + "See their profile" · neutral voice
- Cap: batch within 24h — if ≥3 new followers in a day, send one "3 new followers" mail instead (LinkedIn's "1 new invitation" idea, batched)
- Params: `[your_first, follower_first_or_count, profile_url]`

**COMMUNITY_ANSWER_ACCEPTED** — new event
- Trigger: `community_posts.accepted_comment_id` set to one of your comments
- Subject: `Your answer was accepted — {{asker_first}}'s question`
- Body: the question + your answer snippet + CTA to the thread · warm, Tithi
- Params: `[your_first, asker_first, question_120, thread_url]`

**COMMUNITY_POST_MILESTONE** — new event
- Trigger: a post of yours crossed 10 / 50 / 100 likes (checked daily by a cron reading `community_posts.like_count`)
- Subject: `{{count}} people liked your post`
- Dedupe: per `(post_id, tier)` — fires at most 3× per post
- Params: `[your_first, count, post_title_40, post_url]`

### Scheduled / editorial (quiet hours, governor applies)

**COMMUNITY_WEEKLY_YOU** — Mon 09:00 IST
- A personal stat card: impressions on your posts, new followers, your best-performing post, one unanswered question tagged with your profession
- Skip if the user had zero activity last week AND follows no spaces (would be empty)
- Tithi voice, five short lines. One primary CTA: "Open your profile". Secondary: "Answer this question".
- Params: `[your_first, impressions, followers_delta, best_post_title_40, best_post_url, open_q_title_40, open_q_url]`

**COMMUNITY_DIGEST** — Thu 10:00 IST
- Top 5 posts this week from spaces the user follows (if the user follows nothing, top 5 across the platform), plus 3 unanswered questions matching the user's profession
- Loop & Slot card list; one headline + author + likes per item
- Skip if the user opened the community in the last 24h
- Params: `[your_first, pick1_title_40, pick1_url, …, pick5_title_40, pick5_url]`

**COMMUNITY_SPACE_NUDGE** — daily scan
- Fires only when: last_opened_community (from `community_members`-side column we'll add, or deduce from `notification_logs` opens) is ≥3 days old AND ≥3 new threads in a space the user follows
- Max 1×/user/7d across all spaces
- Params: `[your_first, space_name, new_count, space_url]`

**COMMUNITY_NETWORK_ACTIVITY** — Wed 10:00 IST
- Fires when ≥2 people the user follows posted this week
- Lists up to 3 with 1-line snippets
- Params: `[your_first, author1_first, snippet1_60, url1, … x3]`

**COMMUNITY_QUESTION_MATCH** — 2×/week, Tue + Fri 11:00 IST
- Scans `community_posts` where `format='question'`, `accepted_comment_id IS NULL`, and the asker's listed tags/space match the recipient's `profiles.profession` (and reciprocally the recipient isn't banned/unfollowed/muted)
- Only fires if ≥3 strong matches; up to 5 listed
- This is the single highest-leverage mail: it pulls hosts back to answer, which seeds the next digest
- Params: `[your_first, count, q1_title_40, q1_url, q2_title_40, q2_url, q3_title_40, q3_url]`

**COMMUNITY_FOUNDER_NOTE** — 1st + 15th, 09:00 IST
- Shubham voice (via `anthropic-skills:shubham-voice`). One idea per note, under 180 words, plus ONE link (to a thread, a new space, or a product change). Think LinkedIn's "The Trust Premium" — not a newsletter, a signed letter. No roundup, no bullets.
- Skip if the user set `community_members.email_replies = false` (same opt-out)
- Audience: all opted-in hosts + guests who've engaged with community in last 90d
- Params: `[your_first]` (the body is the whole value, no interpolation beyond the name)

---

## 3. Cadence budget per user

Worst-case, fully-engaged user in a quiet week:
- Transactional: unbounded, but naturally rare (and batched for follows)
- Mon 09:00 → Weekly You
- Tue 11:00 → Question Match
- Wed 10:00 → Network Activity
- Thu 10:00 → Digest
- Fri 11:00 → Question Match
- Space Nudge: at most 1 anywhere in the week
- Founder Note: 1st and 15th, at most 1 in a given week

→ **≤6 scheduled community mails/week + transactional.** LinkedIn hits 5–7
baseline; we match it for an active user and taper fast for quiet ones.

Hard rails (enforce in a new `communityGovernor.js`, same shape as touchGovernor):
- 1 non-transactional community mail per 24h max (if two cron jobs match the same user same day, Weekly You wins > Digest > Question Match > Network > Space Nudge)
- Blanket skip if `community_members.email_replies = false`
- Blanket skip if `community_members.banned_until > now()`
- Per-event opt-out via `notification_preferences` (existing table)
- Quiet hours 09–20 IST on all scheduled mails

---

## 4. Senders, deliverability, domain

| Event group | From | Domain | Path |
|---|---|---|---|
| Transactional (Reply/Mention/Follow/Accepted/Milestone) | `team@meeticulous.com` | news.meeticulous.com (already Brevo-authenticated, v3.182) | Resend + Brevo fallback |
| Weekly/Digest/Network/Match/Space | `Tithi at Meeticulous <tithi@news.meeticulous.com>` | news.meeticulous.com | Brevo (via `crm_tithi` sender row, v3.182) |
| Founder Note | `Shubham | Meeticulous <shubham@mail.meeticulous.in>` | mail.meeticulous.in (cold root, v3.182 `crm_shubham`) | Brevo |

Reply-to: team@meeticulous.com for everything except Founder Note (replies →
shubham@meeticulous.com, intentional — he reads them).

No new senders needed. Two existing rows + the default notification path cover
every event in this plan.

---

## 5. Schema additions needed

Small. One migration.

**v3.200_community_email_track.sql** (v3.199 already used by Tithi title PR #213)
```sql
-- 1. Insert 8 new notification_events (REPLY + MENTION already exist in v3.185):
-- COMMUNITY_FOLLOW_NEW, COMMUNITY_ANSWER_ACCEPTED, COMMUNITY_POST_MILESTONE,
-- COMMUNITY_WEEKLY_YOU, COMMUNITY_DIGEST, COMMUNITY_SPACE_NUDGE,
-- COMMUNITY_NETWORK_ACTIVITY, COMMUNITY_QUESTION_MATCH, COMMUNITY_FOUNDER_NOTE
-- All: email_enabled=true, in_app_enabled=true, whatsapp_enabled=false, is_active=true

-- 2. Insert master flag:
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('community_email', false, 'Master kill switch for the community email track')
  ON CONFLICT (key) DO NOTHING;

-- 3. community_members.last_opened_at (used by SPACE_NUDGE's "3-day silence" gate)
ALTER TABLE community_members
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_community_members_last_opened
  ON community_members (last_opened_at) WHERE last_opened_at IS NOT NULL;
```

Email templates seeded on boot via existing `templateSync.js` + `seed_hash`
mechanism (v3.187) — same flow we used for the 6 non-community tracks.

---

## 6. Services (one file per lane, mirrors existing shape)

- `server/services/community/weeklyYou.js` — cron 24h, Mon 09 IST
- `server/services/community/communityDigest.js` — cron 24h, Thu 10 IST
- `server/services/community/questionMatch.js` — cron 24h, Tue+Fri 11 IST
- `server/services/community/networkActivity.js` — cron 24h, Wed 10 IST
- `server/services/community/spaceNudge.js` — cron 24h, any day, with 7d-per-user cap
- `server/services/community/founderNote.js` — cron 24h, fires only on 1st + 15th
- `server/services/community/postMilestone.js` — cron 1h, scans `community_posts` crossing 10/50/100

Transactional events (REPLY, MENTION, FOLLOW_NEW, ANSWER_ACCEPTED) fire inline
from the controllers that already write to those tables — no cron.

All services double-gated (master flag + per-event flag), governed by
`communityGovernor.js` (new, same shape as `touchGovernor`), honouring
`sendGate` for quiet hours.

---

## 6b. Admin + founder emails

Separate from member emails. All to `team@meeticulous.com` unless noted, all
behind one flag `community_admin_email` (OFF). Same NotificationEngine path,
`audience: 'admin'`.

| Event | Trigger | Cadence | Status |
|---|---|---|---|
| `COMMUNITY_ADMIN_FLAG` | A row lands in `community_reports` with `status='pending'` | Instant, 1 per report | **NEW** |
| `COMMUNITY_ADMIN_FLAG_SURGE` | ≥5 pending reports in a 1h window | Instant (coalesced) | **NEW** |
| `COMMUNITY_ADMIN_NEW_MEMBER_FIRST_POST` | Member's first post lands AND member age <24h | Instant | **NEW** — the spam/sock-puppet canary |
| `COMMUNITY_ADMIN_BAN_APPLIED` | `community_members.banned_until` set/extended | Instant audit trail (mod only) | **NEW** |
| `COMMUNITY_ADMIN_TITHI_ESCALATION` | `escalationService.escalate()` called from community | Instant | **LIVE** (PR #213) |
| `COMMUNITY_ADMIN_TITHI_RELEASE_DRAFT` | PR merged to release branch when `AUTOPOST=false` | Instant | **LIVE** (PR #213) |
| `COMMUNITY_ADMIN_NIGHTLY_DIGEST` | Nightly 22:00 IST — posts today, Tithi posts, unanswered ≥24h | Daily | **LIVE** (PR #213) — founder only |
| `COMMUNITY_ADMIN_WEEKLY_KPI` | Mon 08:00 IST | Weekly | **NEW** — founder only; active members, new posts, new follows, Q answered %, median first-reply time, Tithi reply/escalation count, flag queue size, unsubscribe delta |
| `COMMUNITY_ADMIN_UNANSWERED_SLA` | Question thread open ≥72h with zero replies | Instant (1 per thread) | **NEW** — prompts Tithi/founder to triage |

Admin opt-out is per-admin via `admin_users.email_prefs` (existing). No user-side
opt-out applies (admin mail is ops).

---

## 7. Metrics worth watching

- **Reply-to-first-answer time** — how long a question sits unanswered
- **Click-through on Question Match** — the whole track lives or dies on this
- **Weekly You open rate** — proxy for "is the number we show meaningful"
- **Founder Note reply rate** — Shubham reads these; it's the brand feedback loop
- **Unsubscribe rate on community_members.email_replies** — hard ceiling signal; if this climbs past 2%/month we're overshooting

---

## 9. Content strategy per email

Every mail: one hero line, one piece of concrete proof (a name, a number, a
snippet), one CTA. Loop & Slot card layout. First name in subject when possible.
Voices per sender_key below.

### USER — transactional (instant)

| Event | Subject formula | Hero / card content | CTA | Voice |
|---|---|---|---|---|
| `COMMUNITY_REPLY` ✓ | `{{actor}} replied to your {{post\|comment}}` | infoCard with 120-char excerpt | View the reply | tithi |
| `COMMUNITY_MENTION` ✓ | `{{actor}} mentioned you` | infoCard with 120-char excerpt | See the mention | tithi |
| `COMMUNITY_CONTENT_REMOVED` ✓ | `Your {{post\|comment}} was removed` | 2-line explanation; reply-to-this-email offer | Read the guidelines | tithi |
| `COMMUNITY_FOLLOW_NEW` | `{{follower}} is now following you` (or `{{count}} new followers this week`) | Follower name + one-line bio OR a list | See their profile | account |
| `COMMUNITY_ANSWER_ACCEPTED` | `Your answer was accepted — {{asker}}'s question` | Q snippet + accepted-answer snippet | Open the thread | tithi |
| `COMMUNITY_POST_MILESTONE` | `{{count}} people liked your post` | Post title + like count + top liker list (3) | Open the post | news |

### USER — scheduled (quiet-hours + governor)

| Event | Subject formula | Body sections | CTA | Voice |
|---|---|---|---|---|
| `COMMUNITY_WEEKLY_YOU` | `{{first}}, your week in the community` | 1. **Impressions** card (hero: total, delta vs prev). 2. **Followers gained** chip. 3. **Your best post** card (title, likes, comments). 4. **One open question** matched to your profession | Open your profile | tithi |
| `COMMUNITY_DIGEST` | `This week in Meeticulous — {{top_title_40}} + 4 more` | 1. "Here's what caught our eye" lead. 2. **5 post cards** (title · author · like count). 3. **3 unanswered questions** list. 4. Footer: "Reply to a thread to earn your Helper badge" | Open the community | tithi |
| `COMMUNITY_SPACE_NUDGE` | `{{count}} new threads in {{space}} you haven't seen` | Lead line · 3 thread titles + author · "muted this space?" footer | Open {{space}} | tithi |
| `COMMUNITY_NETWORK_ACTIVITY` | `{{person1}} and {{n}} others you follow posted this week` | 3 cards: author · 60-char snippet · timestamp | See all | tithi |
| `COMMUNITY_QUESTION_MATCH` ★ | `{{count}} unanswered questions in your space` | Lead ("You know this one"). 3-5 question cards: title · space · asker · time open. Footer: "You earn a Helper badge the first time your answer is accepted" | Answer one | tithi |
| `COMMUNITY_FOUNDER_NOTE` | Varies — one idea per note, ≤8 words | Prose only, no cards. One signed letter under 180 words, ONE link in the body | (inline link only, no button) | shubham |

### ADMIN — instant

| Event | Subject | What's in the card | CTA |
|---|---|---|---|
| `COMMUNITY_ADMIN_FLAG` | `[Flag] {{reason}} — {{target_type}} by {{author}}` | target preview (80 chars) · reporter name · reason · current open-reports count on this target | Open in admin |
| `COMMUNITY_ADMIN_FLAG_SURGE` | `[Surge] {{n}} flags in the last hour` | breakdown by reason · top 3 flagged targets | Open flag queue |
| `COMMUNITY_ADMIN_NEW_MEMBER_FIRST_POST` | `[Review] First post from a new member ({{age_hours}}h)` | member name · signup time · post preview (120 chars) · space · links_allowed? | Open the post |
| `COMMUNITY_ADMIN_BAN_APPLIED` | `[Audit] Ban applied: {{member}} until {{until}}` | member · ban_reason · duration · acting admin | Open member |
| `COMMUNITY_ADMIN_TITHI_ESCALATION` ✓ | `[Tithi] Escalation — {{category}}` | thread link · reason · last message | Open thread |
| `COMMUNITY_ADMIN_TITHI_RELEASE_DRAFT` ✓ | `[Tithi] Draft release note for PR #{{n}}` | drafted markdown preview | Post to community |

### ADMIN — scheduled

| Event | Subject | Sections | CTA |
|---|---|---|---|
| `COMMUNITY_ADMIN_NIGHTLY_DIGEST` ✓ | `Community — {{date}}` | today's posts count · Tithi posts count · still-unanswered list | Open admin |
| `COMMUNITY_ADMIN_WEEKLY_KPI` | `Meeticulous community — week of {{date}}` | KPI table: active members · new posts · new follows · Q answered % · median first-reply · Tithi reply/escalation count · flag queue size · unsub delta. Plus a 2-line "what changed" summary generated from the deltas | Open admin |
| `COMMUNITY_ADMIN_UNANSWERED_SLA` | `[Triage] {{count}} questions open > 72h` | list: title · space · asker · hours open. Grouped by space | Triage queue |

Governor rules: user governor caps 1 non-transactional mail / 24h and skips
anything whose master flag is OFF or whose `email_replies=false` was set. Admin
side skips its own queue when `ADMIN_ALERT_COOLDOWN_MS` (default 15m) has
suppressed a sibling alert.

---

## 8. Ship order

1. **v3.200 migration + templateSync entries** — all 9 event rows live, flag OFF
2. **Transactional inline wires** — REPLY/MENTION/FOLLOW/ACCEPTED fire from controllers (also keeps in-app working if email stays off)
3. **Question Match** — the highest-leverage cron, ship first among scheduled
4. **Weekly You + Digest** — the twin recap cadence
5. **Network Activity + Space Nudge** — depend on `last_opened_at` column + follow graph being populated
6. **Post Milestone** — small, safe, ship last
7. **Founder Note** — only after the track has run 2 weeks and we know the audience count

Each ships as its own PR to `release/YYYY-MM`. Master flag flips to `true` only
after (1)–(3) are in prod and a founder-sent dry-run to `team@` looks right.

---

Related: [`docs/email-journey-map.md`](email-journey-map.md),
[`docs/email-playbook.md`](email-playbook.md),
[`docs/community-forum-spec.md`](community-forum-spec.md),
[`docs/aisensy-template-spec.md`](aisensy-template-spec.md).
