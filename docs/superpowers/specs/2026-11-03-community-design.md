# Meeticulous Community — Design

**Status:** Draft for founder approval
**Date:** 2026-11-03
**Route:** `meeticulous.com/community`
**Supersedes:** `docs/community-forum-spec.md` (July 2026). That spec ruled out feeds and
public/SEO content; both decisions are reversed here. Its trust & safety, IT Rules and
cold-start sections still apply and are folded in below.
**Reference build:** The Parliament (`../The Parliament`, Next.js + Prisma) — a working
alumni social network whose feed, post and comment patterns we copy, and whose audit
findings we design around. Inspiration only; no code is copied verbatim.

---

## 1. Intent — why a SaaS company runs a community

One public place where four things happen:

| Who | Does what | Meeticulous gets |
|---|---|---|
| Guests | Browse host posts, slot drops, wins; ask questions | **Bookings** — discovery channel, every booking pays a fee |
| Hosts → hosts | Shop talk, tips, find peers in their category | **Retention** — a host with peers here does not churn |
| Meeticulous | Product updates, changelog, tips, events | **Announcements that land** where users already are |
| Everyone | Questions, ideas, bug reports | **Support deflection + product research** (Tithi answers first) |

Plus **house ads** for the founder's other businesses in small slots.

**Success:** hosts post weekly because posts bring bookings; guests return to browse;
community pages rank and get cited by AI search; support inbox shrinks.

**Failure (anti-goals), even if it technically works:**
- An empty feed.
- A feed of hosts' phone numbers / WhatsApp links taking bookings off-platform.
- Public posts naming and shaming a specific host (defamation on Google).
- Google indexing thousands of thin "nice 🔥" pages and downgrading the whole domain.
- Bot or ad noise that makes hosts feel sold to.

## 2. Decisions locked with the founder

1. **Public read, logged-in interaction.** Every post, thread, reply and space page is
   readable by anyone and by search engines. Posting, replying, liking, following,
   saving, reporting need a login (guest OTP or host Google — existing auth).
2. **Everything is public, including Host Corner.** No private spaces in v1.
3. **Two content kinds:** quick **posts** (social feed, Parliament-style) and
   **threads** (forum-style: title + long body, live in a space, sort by latest reply).
4. **Post formats carried from The Parliament:** text, photos, link with preview, poll,
   question, quote, repost. **Meeticulous-only:** bookable service card, slot drop.
5. **Every post and thread is SEO-friendly:** stable slug URL, server-rendered HTML,
   structured data, sitemap, canonical, OG image.
6. **Ads are house ads only** (founder's own businesses) for now. Selling slots later
   must be an upgrade, not a rebuild.
7. **Build once:** the first migration creates the full data model for every phase;
   later phases add screens and code only.

## 3. Non-goals

- **DMs.** Hosts would move bookings off-platform; harassment risk.
- **Karma, points economy, awards, leaderboards.**
- **Downvotes.** Hosts are businesses; likes only.
- **Anonymous posts** (IT Rules liability).
- **Paid feed caps / premium feed.**
- **Selling ads, self-serve promotion, ad billing** (later upgrade path only).
- **Video upload** (schema allows it; not built — storage cost).
- **Algorithmic "For You" ranking, realtime feed updates, groups, events** (later, if earned).
- **Rich text / markdown** in v1 (plain text + line breaks + auto-linked URLs).

## 4. Constraints (from the existing platform)

- Stack: Vite React SPA (`client/`), Express + `supabaseAdmin` service-role (`server/`),
  Supabase Postgres + Storage. No Prisma, no Next.js.
- New tables follow the house RLS convention: **RLS on, no policy, service_role only**;
  all reads/writes go through Express. Migrations idempotent, `vX.Y_name.sql`, next is
  **v3.185**, applied to the live DB (`spquowzrefozmrzoszkf`), with code-side schema
  fallback until applied.
- Product rules: phone numbers are never shown; guest identity = phone internally.
- UI: Loop & Slot design system (`design-system/BRAND_RULES.md`), tokens only,
  `.mt-*` classes, marigold reserved for open slots (which slot drops are).
- Never refactor unrelated code; never break backward compatibility.

## 5. Reuse map

| Need | Existing piece |
|---|---|
| Required login | `protect` (`server/middleware/authMiddleware.js:49`) |
| Public route that knows the viewer | `optionalProtect` (same file L88) |
| Host check | `requireHost` / `profiles.is_host` |
| Banned accounts | `accountGate` already 403s `profiles.is_banned` |
| Display identity | `profiles.first_name`, `name`, `username`, `profile_image`, `is_verified` |
| Image upload | `POST /api/upload/image?folder=` (`uploadController.js`) — add folder `community` |
| In-app bell | `inAppNotify({userId, role, type, title, body, link, dedupeKey})` |
| Email | `notificationEngine.send` + `notification_events` row + `emailTemplates.js` |
| Kill switches | `featureRegistry.js` → `feature_flags`, `requireFeature(key)`, `useFeature(key)` |
| PII / phone detection | `redactPii` (`server/services/botService.js:595`) |
| Off-site link detection | `_EXT_LINK_RE` (`botService.js:218`) |
| Profanity | `server/utils/adultContentFilter.js` |
| Rate limiting | `express-rate-limit` per-account keyGenerator pattern (`uploadLimiter`, `security.js:368`) |
| Moderation precedent | reviews moderation (v3.64, `reviewAdminController.js`) + `auditService.audit` |
| Admin pages | `adminPermissions.js`, `requireAdmin(perm)`, `admin/ui` primitives, `adminNav.js` |
| AI answers + escalation | `askBot` / `matchFaq` / `botBudget.tryConsume` / `escalationService.recordAndNotify` |
| Services & slots | `GET /api/host/:username`, `GET /api/bookings/available-slots`, `availabilityService.computeSlots` |
| Bot HTML | `prerenderController` resolver pattern + `client/middleware.js` |
| Sitemaps | `sitemapService.js` / `sitemapController.js` / `sitemapRoutes.js`, `bustSitemapCache()` |
| Meta + JSON-LD | `Seo.jsx`, `client/src/utils/seo.js` helpers |
| Infinite scroll | `client/src/components/dashboard/ui/useInfiniteScroll.js` |
| Response caching | `responseCache.getOrSet/bust`, `setPublicCache` |
| Analytics | `analytics.track` + `events.js` registry; `trackServer` |

## 6. Information architecture (URLs)

| URL | Page | Indexed |
|---|---|---|
| `/community` | Feed — tabs **Everyone** (default), **Following**, **Updates** | yes |
| `/community/s/:space` | Space — threads sorted by latest activity | yes |
| `/community/t/:slug` | Thread detail + replies | if `is_indexable` |
| `/community/p/:slug` | Post detail + replies | if `is_indexable` |
| `/community/tag/:tag` | Hashtag listing | only if ≥ 5 indexable items |
| `/community/search` | Search posts, threads, people | no |
| `/community/saved` | My saved items (login) | no |
| `/community/guidelines` | Community guidelines + grievance officer | yes |
| `/:username` → new **Posts** tab | Author's posts & threads | (profile page already indexed) |
| `/admin/community/*` | Reports, content, members, ads, spaces | no |

A slug is unique across posts and threads. Hitting `/community/p/:slug` for a thread (or
vice versa) 301s to the right prefix.

**Spaces (v1, seeded rows, admin-editable):**

| key | Name | Who can start a thread |
|---|---|---|
| `updates` | Meeticulous Updates | Official accounts only (everyone can reply) |
| `help` | Help & Questions | Everyone |
| `ideas` | Ideas & Feedback | Everyone |
| `host-corner` | Host Corner | Hosts only (everyone can read; replies hosts only) |
| `general` | General | Everyone |

## 7. Content model

### 7.1 Posts and threads share one table

`community_posts` holds both, distinguished by `kind`. One table means one feed query,
one visibility check, one reactions/reports/replies path, one sitemap. (The Parliament
lesson: duplicate concepts — their repost-as-post plus separate share rows — drift.)

| | Post | Thread |
|---|---|---|
| `title` | null | required, ≤ 150 chars |
| `body` | ≤ 1,000 chars | ≤ 10,000 chars |
| `space_id` | optional (most posts have none) | required |
| Shown in | Feed | Feed (as a title card) **and** its space |
| Sort in space | — | `last_activity_at desc` |
| Formats | all (see 7.2) | `text`, `question`, `poll` |

### 7.2 Formats (`format` column, DB CHECK constraint — never a free string)

| format | Extra data | Phase |
|---|---|---|
| `text` | photos optional (0–4, in `community_media`) | 1 |
| `question` | `accepted_comment_id` set by author (→ QAPage schema) | 1 |
| `link` | `community_embeds` row kind `link` with fetched OG preview | 3 |
| `poll` | `community_polls` + options, 2–6 options, optional close time | 3 |
| `quote` | `quoted_post_id` + author's own text | 3 |
| `repost` | `quoted_post_id`, no text; one repost per user per original; reposting a repost points at the original | 3 |
| `service` | `community_embeds` kind `service` → `services.id`; host can only embed own services | 2 |
| `slot_drop` | `community_embeds` kind `slot` rows (1–10 slots: service + start time); each shows live availability and disappears when booked/past | 2 |
| `announcement` | official accounts only; can be pinned | 1 |

### 7.3 Replies

`community_comments` stores the **true parent** (`parent_id`, any depth) but the UI shows
**one visual level** with "replying to @name" — the Parliament approach. Real nested
threads can be turned on later with no data change. Replies are plain text ≤ 2,000 chars,
one optional photo (phase 3).

### 7.4 Status and deletion

`status`: `visible` | `hidden` (admin, pending review; author still sees it) |
`removed` (admin) | `deleted` (author). Never hard-deleted. Deleted/removed comments
render as "[deleted]" / "[removed]" so the thread stays readable. Removed and deleted
posts return **HTTP 410** to crawlers and render a "no longer available" page.

### 7.5 Indexability

`is_indexable boolean` is recomputed on every write that can change it (create, edit,
reply count change, moderation). Rule:

- `status = 'visible'` **and** author not banned, **and**
- thread: body ≥ 200 chars **or** ≥ 1 visible reply from someone other than the author;
- post: body ≥ 140 chars **or** ≥ 2 visible replies **or** format in (`question` with an
  accepted answer, `slot_drop`, `service`, `announcement`).

Non-indexable pages still render for people, with `<meta name="robots" content="noindex,follow">`
and are left out of the sitemap.

## 8. Data model (migration v3.185 — all phases)

All tables RLS on, no policy. `uuid` PKs default `gen_random_uuid()`, `created_at
timestamptz default now()`. Enum-like columns use CHECK constraints.

**Account deletion:** admin `deleteUser` hard-deletes `profiles` and relies on cascades,
so every `author_id` / `user_id` FK must be chosen deliberately:
- `community_posts.author_id`, `community_comments.author_id` → **nullable, `ON DELETE SET NULL`**.
  Content stays (other people's replies are not lost, URLs keep working); the author
  renders as "Deleted account", no link, no JSON-LD `Person` (use `author.name =
  "Deleted account"`).
- Personal rows (`community_members`, follows, blocks, saves, reactions, poll votes,
  mentions of that user) → `ON DELETE CASCADE`. Counters are corrected by the same
  triggers on delete.
- `community_reports.reporter_id` → `ON DELETE SET NULL` (keep the complaint trail).

```
community_members                -- one row per person who has joined the community
  user_id            uuid pk -> profiles.id on delete cascade
  terms_version      text            -- guidelines version accepted
  terms_accepted_at  timestamptz
  badge              text null  CHECK in ('official','ai','staff')   -- set by admin only
  banned_until       timestamptz null  -- community-only ban (not a platform ban)
  ban_reason         text null
  links_allowed      boolean default false  -- see §10.3; flipped by rule or admin
  early_access       boolean default false  -- may read/write while `community` flag is off (§21)
  email_replies      boolean default true   -- reply/mention emails opt-out
  post_count / comment_count  int default 0 (trigger-maintained)
  follower_count / following_count int default 0 (trigger-maintained)

community_spaces
  id uuid pk, key text unique, name, description, position int,
  post_policy text CHECK in ('everyone','hosts','official')
  reply_policy text CHECK in ('everyone','hosts')
  is_active boolean default true

community_posts
  id uuid pk
  kind            text CHECK in ('post','thread')
  format          text CHECK in ('text','question','link','poll','quote','repost',
                                 'service','slot_drop','announcement')
  author_id       uuid -> profiles.id
  space_id        uuid null -> community_spaces.id      (required when kind='thread')
  title           text null                             (required when kind='thread')
  body            text not null default ''
  slug            text unique not null                  -- immutable once set
  quoted_post_id  uuid null -> community_posts.id       (quote/repost)
  accepted_comment_id uuid null                         (question)
  mentions_host_id uuid null -> profiles.id             -- host this post is about (for verified badge)
  verified_booking boolean default false                -- author has a completed booking with mentions_host_id
  status          text CHECK in ('visible','hidden','removed','deleted') default 'visible'
  is_pinned       boolean default false
  pinned_until    timestamptz null
  is_indexable    boolean default false
  like_count, comment_count, repost_count, save_count int default 0 (trigger-maintained)
  last_activity_at timestamptz default now()            -- bumped by new visible reply
  edited_at, deleted_at timestamptz null
  moderated_by uuid null (admin_users.id), moderated_at, admin_note
  UNIQUE (author_id, quoted_post_id) WHERE format='repost'
  indexes: (status, created_at desc, id desc) WHERE status='visible';
           (space_id, last_activity_at desc, id desc) WHERE kind='thread' AND status='visible';
           (author_id, created_at desc); (is_indexable, last_activity_at desc) WHERE is_indexable

community_comments
  id uuid pk, post_id -> community_posts.id on delete cascade,
  parent_id uuid null -> community_comments.id,
  author_id -> profiles.id, body text, status (same CHECK), like_count int default 0,
  edited_at, deleted_at, moderated_by, moderated_at, admin_note
  index (post_id, created_at, id)

community_media                  -- photos now, video later
  id uuid pk, post_id null, comment_id null  (exactly one set — CHECK)
  kind text CHECK in ('image','video'), url text, width int, height int,
  alt text null, position smallint
  index (post_id, position)

community_embeds                 -- service cards, slot drops, link previews
  id uuid pk, post_id -> community_posts.id on delete cascade
  kind text CHECK in ('service','slot','link'), position smallint
  service_id uuid null -> services.id
  slot_start timestamptz null, slot_end timestamptz null
  url text null, preview_title, preview_description, preview_image text null

community_polls        (post_id pk -> community_posts.id, closes_at timestamptz null, total_votes int default 0)
community_poll_options (id pk, post_id, label text, position smallint, vote_count int default 0)
community_poll_votes   (post_id, user_id, option_id, created_at; pk (post_id, user_id))

community_reactions              -- polymorphic, likes only today
  user_id, target_type text CHECK in ('post','comment'), target_id uuid,
  kind text CHECK in ('like') default 'like', created_at
  pk (user_id, target_type, target_id)
  -- integrity: a BEFORE INSERT trigger checks target_id exists in the right table
  --            (Parliament's polymorphic tables had no integrity at all)

community_follows   (follower_id, followee_id, created_at; pk both; CHECK follower<>followee)
community_blocks    (blocker_id, blocked_id, created_at; pk both)
community_saves     (user_id, post_id, created_at; pk both)
community_mentions  (post_id null, comment_id null, mentioned_user_id, created_at)
community_hashtags      (tag text pk, use_count int default 0)   -- lower-case, no '#'
community_post_hashtags (post_id, tag; pk both)

community_reports                -- also the IT Rules complaint trail
  id pk, target_type CHECK in ('post','comment','member'), target_id uuid,
  reporter_id -> profiles.id, reason text CHECK in
    ('spam','harassment','hate','sexual','violence','off_platform','defamation','illegal','other'),
  details text null, status CHECK in ('open','resolved','dismissed') default 'open',
  resolved_by uuid null (admin_users.id), resolved_at, resolution_note
  UNIQUE (reporter_id, target_type, target_id)

community_ads
  id pk, advertiser text not null          -- 'house' today; a brand/customer later
  slot text CHECK in ('feed','rail','sidebar','space_banner')
  title text, body text null, image_url text null, link_url text not null,
  cta_label text null, starts_at, ends_at null, is_active boolean, priority int default 0,
  max_views_per_day smallint default 3
  space_id uuid null                        -- only for space_banner
```

**Counters** are maintained by Postgres triggers on reactions, comments, follows, saves,
reposts and poll votes (copied from The Parliament's post-counter triggers), so they
never drift and never need app code. Comment like counts use a trigger too (the
Parliament's app-maintained comment count is the one thing they got wrong).

**Not stored:** ad impressions/clicks (PostHog), feed impressions, ranking score.
Adding `rank_score` later is a one-column migration.

## 9. Visibility — one function, everywhere

The Parliament wrote "who can see this" four times and got four different answers;
followers-only posts leaked through profiles, URLs and OG images. Here:

- `server/services/community/visibility.js` exports **one** predicate used by feed,
  space, detail, profile tab, search, sitemap, prerender, notifications and OG.
- Rules: `status = 'visible'` (author sees own `hidden`), author not community-banned,
  author `profiles.is_banned = false`, and — for a logged-in viewer — neither side
  has blocked the other. Blocks also hide quoted/reposted content and comments.
- List queries use the same rule as a shared SQL builder, not hand-written filters.

## 10. Writing: validation, safety, limits

### 10.1 Joining
First write action → if no `community_members` row or old `terms_version`, the client
shows the guidelines and an **Accept** button; server rejects writes without
acceptance (`403 COMMUNITY_TERMS_REQUIRED`).

### 10.2 Text
Plain text, `\n` preserved, URLs auto-linked at render with
`rel="ugc nofollow noopener"` and `target="_blank"`. Rendered as React text (never
`dangerouslySetInnerHTML`). Limits in §7.1/§7.3.

### 10.3 Off-platform protection
- `redactPii` detects phone numbers, emails, card/Aadhaar → **reject** with a clear
  message ("Phone numbers and emails aren't allowed — guests book through your page").
  Rejection, not silent redaction, so authors aren't confused.
- Blocked link hosts: `wa.me`, `api.whatsapp.com`, `t.me`, `calendly.com`, `cal.com`,
  `topmate.io`, `instagram.com/direct`, `bit.ly`-style shorteners (list in config).
- Any other link is allowed only when `community_members.links_allowed`: auto-true for
  hosts with a verified profile and for accounts older than 7 days with ≥ 3 visible
  posts/comments; admin can flip it.
- `adultContentFilter.isBlocked` on title/body.

### 10.4 Security middleware
`blockSuspiciousRequests` (`security.js:450`) IP-bans for 24h on bodies containing words
like "insert into" or "drop table" — ordinary community text ("insert into my
calendar") will trip it. Community write routes need an exemption from the **SQL
keyword** patterns only (Supabase queries are parameterised); the `<script` /
`javascript:` checks stay. This edits a critical file — keep the exemption to the exact
`/api/community` write paths and cover it with a test.

### 10.5 Rate limits (per account, new `communityWriteLimiter` family)
Posts/threads 10/hour, comments 60/hour, reactions 300/hour, follows 100/hour,
reports 20/hour. Uploads keep the existing `uploadLimiter`.

### 10.6 Uploads
Add folder `community` to the upload allowlist **for any logged-in user** (today
uploads are host-only). Same 2MB, JPG/PNG/WEBP byte-sniffing. Up to 4 photos per
post. Alt text optional. Orphaned uploads (never attached) are left for a later GC job.

### 10.7 Defamation rule
Guidelines forbid naming a host negatively. Reports with reason `defamation` go to the
top of the admin queue. The composer shows a one-line nudge when a guest's text
mentions a host and contains complaint words: "Problem with a booking? Support can
help →".

## 11. Reading: feed and spaces

- **Everyone tab:** visible posts + threads, `created_at desc, id desc`, keyset cursor
  (opaque base64 of `created_at|id`), 20 per page, infinite scroll
  (`useInfiniteScroll`). Pinned items (not expired) on page 1 only.
- **Following tab:** same, `author_id IN (followees)` (login required; empty state
  suggests hosts to follow).
- **Updates tab:** `space = updates` or `format = announcement`.
- **Space page:** threads in the space, `last_activity_at desc`, keyset.
- **Viewer state** (liked? saved? voted? following author?) is fetched in **one batch
  query per page**, not per card (Parliament N+1 lesson).
- Anonymous responses are cacheable (`setPublicCache`, short TTL); logged-in responses
  are not.
- Polling: none in v1. A "new posts" pill can come later.

## 12. Meeticulous-only features

- **Service card:** host picks one of their own active services; card shows title,
  duration, price (from the service, never from the post), and **Book** → `/:username/booking/:slug?ref=community&post=<id>`.
- **Slot drop:** host picks 1–10 open slots for a service. Each renders as a marigold
  `.mt-slot` chip; availability is checked live via `available-slots` when the post
  is viewed; taken or past slots render struck through; when all are gone the card
  shows "All slots booked" (social proof). Clicking a slot deep-links to booking with
  that slot preselected (if the booking page supports it; otherwise the date).
- **Verified booking badge:** when a guest's post mentions a host (`@username`) and the
  guest has a **completed** booking with that host, `mentions_host_id` and
  `verified_booking = true` are stored at write time and the card shows
  "✓ Booked @host".
- **Host suggestions:** "Hosts in your category" / "Hosts to follow" on the right rail
  (same profession/category, most active community authors, excluding followed).
- **Profile Posts tab** on `/:username` lists that person's visible posts and threads.

## 13. Identity on the page

- "Host" means `profiles.is_host = true`, regardless of which door (guest OTP or host
  Google) the session came through — one identity (PR #900). The same rule gates
  Host Corner posting/replies.
- Author label: hosts → `name` + `@username` + Host badge, linking to their public
  profile. Guests → `first_name` (fallback "Member") + Guest badge, no profile link,
  avatar = `profile_image` or deterministic coloured initial.
- Badges from `community_members.badge`: **Meeticulous** (official), **AI** (Tithi),
  **Staff**.
- **Official content is posted by the founder's own account** (decided by the founder)
  with `badge = 'official'`, set once from admin → Members. No brand profile and no
  "post as Meeticulous" admin composer. Official accounts may post in `updates`, use
  the `announcement` format and pin. JSON-LD author stays the founder's `Person`.
- **Phone numbers, emails and last names of guests are never returned by any
  community API**. One serializer (`serializeAuthor`) is the only way author data
  leaves the server.

## 14. Notifications

| Event | In-app | Email | Dedupe |
|---|---|---|---|
| Reply to your post/thread | yes | yes (opt-out) | per post per hour, coalesced "Priya and 3 others replied" |
| Reply to your comment | yes | yes (opt-out) | per comment per hour |
| @mention | yes | yes (opt-out) | per item |
| Your answer accepted | yes | no | per item |
| Like on your post/comment | yes | no | per item per day, coalesced |
| New follower | yes | no | per day, coalesced |
| Content removed by moderator | yes | yes | per item |

Coalescing uses `inAppNotify`'s `dedupeKey` (update the existing row's title/body
instead of inserting). New `notification_events` rows: `COMMUNITY_REPLY`,
`COMMUNITY_MENTION`, `COMMUNITY_CONTENT_REMOVED`, with `email_templates` per
the existing seeding script. Emails are transactional; they honour the existing HMAC
unsubscribe plus `community_members.email_replies`. Never notify about blocked users.

## 15. SEO and AI visibility

- **Bot HTML:** community pages are created after deploy, so build-time prerender
  can't cover them. Add a `/community/...` branch to `client/middleware.js` that sends
  crawlers to `GET /prerender/community/...` (new resolvers in `prerenderController`:
  feed, space, thread, post, guidelines). **Unlike profiles, this branch includes
  Googlebot** — the server HTML has the same content a person sees (title, body,
  author, replies), so it is dynamic rendering, not cloaking, and it avoids Google
  first seeing a bare SPA shell. (Builder: confirm the bare `spa-shell.html` does not
  carry `noindex` for these paths — `vercel.json` sets `X-Robots-Tag: noindex` on
  `/spa-shell.html`.)
- **Structured data** (new helpers in `client/src/utils/seo.js`, mirrored in the
  server resolver):
  - thread / post → `DiscussionForumPosting` (headline, text, author `Person` with
    profile URL for hosts, `datePublished`, `dateModified`, `interactionStatistic`
    likes + comments, `comment[]` for the first 20 replies, `image`).
  - `question` with an accepted answer → `QAPage` + `Question` / `acceptedAnswer`.
  - space and feed → `CollectionPage` + `BreadcrumbList`.
- **Meta:** `<title>` = thread title or first 60 chars of post + " — Meeticulous
  Community"; description = first 155 chars; canonical = slug URL; OG image = first
  photo, else a generated default community card (static image in v1).
- **Sitemap:** `sitemap-community.xml` listing indexable threads/posts (lastmod =
  `last_activity_at`) and active spaces; added to the sitemap index; cache busted on
  create/moderation.
- **robots.txt / llms.txt:** allow `/community/` for all crawlers including AI
  crawlers; disallow `/community/search` and `/community/saved`. Add `community` to
  `client/src/config/reservedSegments.js` (server already reserves it).
- **Removed content** → 410 from prerender; removed from sitemap.

## 16. Ads (house only)

- Slots: **feed** (in-feed card after the 5th item, then every 8th), **rail** (desktop
  right column, sticky), **sidebar** (under left nav, desktop), **space_banner**
  (thin strip on top of a space page). Mobile shows only feed and space_banner.
- Never in: thread/post detail reply area, composer, Host Corner feed list, admin.
- Every ad labelled **Sponsored**, links `rel="sponsored noopener"`.
- Served by `GET /api/community/ads?slots=…` (cached), chosen by priority then random
  among active + in-date ads.
- **Frequency cap** per browser in `localStorage` (count per ad per day vs
  `max_views_per_day`). *Builder note: deliberate simplification — accurate enough for
  house ads; a server-side cap is needed only when slots are sold.*
- Views/clicks → PostHog `community_ad_viewed` / `community_ad_clicked` with ad id.
- Kill switch per slot: `community_ads` flag + per-slot `is_active`.
- **Upgrade path to selling slots:** `advertiser` becomes a FK to an advertisers table,
  add orders/invoices; no change to slot rendering.

## 17. Tithi (AI first responder)

- Watches `question`-format items and threads in `help`, never Host Corner, never
  items by a bot (loop guard: never replies to `badge = 'ai'` authors, including itself).
- Trigger: after a qualifying post is created, enqueue (cron every 5 min in v1, using
  existing Render cron infra) → run the existing `askBot` pipeline (PII redaction,
  FAQ match, retrieval, Claude) under `botBudget.tryConsume`.
- **Answers only when grounded** (FAQ hit or retrieval above threshold); posts a reply
  as the Tithi account with the **AI** badge and a "Was this helpful?" link. Otherwise,
  or for money / refunds / legal / complaints about a host, it calls
  `escalationService.recordAndNotify` and does **not** post.
- Kill switch `community_tithi` (fail-closed). Every action audit-logged.
- Tithi needs a `profiles` row (non-login) with `community_members.badge = 'ai'`.

## 18. Moderation and compliance

**Admin (new permissions `community.view`, `community.moderate`, `community.ads`;
`operations` role gets view + moderate; `support` gets view):**
- **Reports queue:** grouped by target, newest/most-reported first, defamation on top;
  actions: dismiss, hide, remove, warn, community-ban (days or permanent), resolve.
- **Content:** search posts/threads/comments, hide/restore/remove, pin/unpin.
- **Members:** list, set badge, allow/deny links, ban/unban.
- **Spaces:** edit name/description/order/policies.
- **Ads:** CRUD with preview per slot.
- Ops dashboard badge: open reports count (pattern: `pending_reviews`).
- Every admin action → `auditService.audit`.
- **Auto-hide:** content with ≥ 3 open reports from distinct accounts flips to
  `hidden` until reviewed.

**India IT Rules 2021 (intermediary) — must exist before public launch:**
`/community/guidelines` page with rules, user agreement, and **named Grievance Officer**
with contact; acknowledge complaints within 24h, resolve within 15 days, unlawful
content down within 36h of a valid order. `community_reports` is the audit trail.

## 19. Layout and design

Loop & Slot throughout (read `design-system/BRAND_RULES.md`).
- Desktop: three columns — left 240px (spaces nav, "New post"), centre feed ≤ 640px,
  right 320px (host suggestions, rail ad). Mobile: single column, spaces as a
  horizontal chip row, floating "New post" button.
- Cards: `.mt-card`; slot chips: `.mt-slot` (marigold = open slot, the brand rule);
  buttons `.mt-btn`; radius scale per CLAUDE.md.
- Composer: modal on desktop, full screen on mobile; Post / Thread toggle, space picker
  (required for threads), photo add, format menu (question, poll, service, slot drop).
- Optimistic UI for like, save, follow, hide, delete, report (restore on error).
- Empty states written as one warm line + action (one serif human phrase per layout).
- Exact visuals are produced as mockups at the start of build phase 1 and approved by
  the founder before screens are built.

## 20. Analytics (PostHog, registered in `events.js`)

`community_viewed` (tab/space), `community_post_created` (kind, format, space),
`community_reply_created`, `community_liked`, `community_followed`,
`community_saved`, `community_reported`, `community_service_card_clicked`,
`community_slot_clicked`, `community_ad_viewed`, `community_ad_clicked`,
`community_terms_accepted`. Bookings started from community carry `ref=community` +
`post` id in the URL for attribution.

Health metrics to watch: posts/day, replies/day, time to first reply, % threads
answered, weekly active posters (hosts vs guests), bookings attributed to community.

## 21. Feature flags

`community` (whole feature; fail-open off-switch for reads, writes fail-closed),
`community_writes`, `community_tithi`, `community_ads`. All ship **off**; turned on by
the founder.

**Seeding before launch (early access):** while `community` is off, the API serves
reads and writes **only** to logged-in users with `community_members.early_access =
true` or an `official`/`staff` badge (set from admin → Members). Everyone else, and
every crawler, gets 404: prerender returns 404, the sitemap omits community, and the
navbar link is hidden. This lets the founder and friendly hosts seed 20–30 items
unseen. Flipping `community` on publishes everything at once. Guidelines page and
grievance officer must exist before the flip (checklist in §23).

## 22. Phases

The v3.185 migration in Phase 1 creates **every** table in §8.

| Phase | Ships |
|---|---|
| **1 — Core** | Migration; members + guidelines acceptance; posts & threads (`text`, `question`, `announcement`) with photos; replies; likes; spaces; feed (Everyone, Updates) + space pages + detail pages; author identity + badges; @mentions (parsing + `community_mentions` + notifications;
mention autocomplete can wait for Phase 2); early-access seeding; off-platform/PII/rate-limit protections; reports + admin queue + bans + auto-hide; reply/mention notifications; SEO (prerender, JSON-LD, sitemap, robots, 410s); flags; analytics |
| **2 — Social + bookings** | Follows + Following tab; blocks; saves; mention autocomplete; #hashtags pages; service cards; slot drops; verified-booking badge; profile Posts tab; host suggestions; search; house ads (all 4 slots + admin) |
| **3 — Rich + Tithi** | Polls; quote; repost; link previews (SSRF-guarded fetch); reply photos; accepted answers → QAPage; Tithi first responder |
| **Later, only if earned** | For You ranking, new-posts pill/realtime, video, markdown, groups, events, ad sales |

Each phase is one or more PRs against the release train; the founder merges.

## 23. Launch operations (not code, owned by the founder)

- Name the Grievance Officer and the daily moderation owner.
- Write guidelines copy (draft provided in Phase 1, founder edits).
- Seed 20–30 real posts/threads (founder + friendly hosts) before switching
  `community` on; commit to answering every early thread for the first months.
- Funnel entries: navbar link, host dashboard widget, post-booking nudge, an email
  announcement — each a small follow-up once Phase 1 is live.

## 24. Left to the builder

- Exact slug algorithm (readable words + short unique suffix; immutable).
- Trigger function structure and naming; migration split into files if clearer
  (still all in Phase 1).
- API route shapes under `/api/community/*`, controller/service file split.
- Component breakdown, test cases, caching TTLs.
- Coalescing implementation details for notifications.
- Whether link previews are fetched at write time or lazily.

## 25. Calls made by Claude (founder please check)

1. One table for posts and threads (`kind`), rather than two.
2. Threads appear in the main feed as title cards as well as in their space.
3. Plain text only in v1 (no markdown), URLs auto-linked as UGC.
4. Phone/email in a post **rejects** the post rather than silently redacting it.
5. Links need `links_allowed` (verified host, or 7-day-old account with 3 posts).
6. Host Corner: everyone can read, only hosts can post or reply.
7. Googlebot gets server-rendered HTML for `/community` (unlike profile pages).
8. Ad frequency cap is per-browser (localStorage), fine for house ads.
9. Likes and follows notify in-app only; replies and mentions also email.
10. Auto-hide at 3 distinct reports.
11. Phase order: ads in Phase 2, Tithi in Phase 3.
12. Pre-launch seeding via a per-member `early_access` allowlist; everything 404s to
    the public and crawlers until `community` is switched on.
13. Deleted accounts: their posts and replies stay, shown as "Deleted account".
14. "Host" label and Host Corner rights follow `profiles.is_host`, not the session's
    guest/host mode.
15. The Ideas space is a normal space; it is **not** written through to the old
    `feedback` table (admins read Ideas in the community admin instead).
16. @mention parsing and notifications move into Phase 1; autocomplete stays Phase 2.
17. Tithi reuses the existing bot account if one exists in `profiles` (the old spec's
    `bolt958`), otherwise a new non-login profile is created; builder checks.
