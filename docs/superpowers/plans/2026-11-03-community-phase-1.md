# Community Phase 1 (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 1 core of `/community`: a public, SEO-indexed feed of posts and forum threads where logged-in users post, reply and like, with moderation, early-access seeding and notifications. Everything stays behind fail-closed feature flags.

**Architecture:** One migration (v3.185) creates every table for all phases. The server adds a `server/services/community/` module (pure helpers + DB service) behind `/api/community` (public reads via `optionalProtect`, writes via `protect`). An access gate does early access while the `community` flag is off. Bots get server HTML from new `/prerender/community/*` resolvers. The client adds lazy `/community/*` pages in Loop & Slot.

**Tech Stack:** Express 4 + `supabaseAdmin` (service role), Postgres triggers, Jest; React 18 + Vite + Tailwind + react-router v6, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-community-design.md` (sections cited as §N). Phase 1 scope = the §22 Phase 1 row. Phases 2–3 get their own plans later.

**Worktree:** `.claude/worktrees/community`, branch `feat/community` (from `origin/release/2026-11`). PR base: `release/2026-11`. Do not merge.

## Global Constraints

- Migration file `server/migrations/v3.185_community.sql`, idempotent (`IF NOT EXISTS`, `ON CONFLICT`). New tables: RLS on, **no policies**, service role only. Header comment: "APPLY TO the Meeticulous DB (spquowzrefozmrzoszkf)".
- Applying the migration to the live DB is an outward action. The executor stops and asks the founder before running it. Until it is applied, every community query must fail soft: catch `relation .* does not exist` and return an empty list or 404 (schema-fallback rule).
- Enum-like columns use DB `CHECK` constraints. Values come verbatim from spec §8.
- Limits (§7.1, §7.3): thread title ≤ 150; thread body ≤ 10,000; post body ≤ 1,000; comment ≤ 2,000; photos 0–4 per post.
- Rate limits (§10.5), per account: posts/threads 10/hour, comments 60/hour, reactions 300/hour, reports 20/hour.
- No phone number, email, guest last name or guest `username` ever leaves the server in a community response. Author data only passes through `serializeAuthor`.
- User text renders as React text. Never `dangerouslySetInnerHTML`. Links get `rel="ugc nofollow noopener"` and `target="_blank"`.
- Flags `community`, `community_writes`, `community_tithi`, `community_ads` ship `enabled:false` and go in `FAIL_CLOSED_KEYS`. *(Refines §21: `community` is fail-closed as well, so a flag-read error can't publish unlaunched content.)*
- UI follows `design-system/BRAND_RULES.md`: tokens only, `.mt-*` classes, marigold only for open slots, radius scale from CLAUDE.md. Load the `meeticulous-design` skill before any UI task.
- Analytics names are registered in `client/src/services/analytics/events.js` (snake_case `object_action`).
- Never refactor unrelated code. Existing tests must stay green: `cd server && npm test`, `cd client && npm run build && npm test`.
- Commit after each task with a conventional message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Ordinary words that trip the WAF.** A post saying "insert into my calendar" or "drop table bookings at 5" must be accepted, not cause a 24h IP ban. A body containing `<script` must still be rejected. → Task 4 test.
2. **Indian phone numbers in spaced or prefixed forms** ("+91 98765 43210", "098765-43210", "9876543210") must be rejected. Short numbers ("call at 5", "₹1499", "2026") must pass. → Task 2 test.
3. **Seeded content leaking before launch.** With the `community` flag off, an anonymous request, a crawler, the sitemap and prerender must all see 404/absent. An early-access member must see everything. → Tasks 4 and 9 tests.
4. **Guest identity leakage.** A guest author's serialized object has exactly `{id, display_name, avatar_url, role:'guest', badge, profile_url:null}`. No phone, email, last name or username. A guest with an empty `first_name` shows as "Member". → Task 3 test.
5. **Deleted and removed content.** A deleted account's post renders "Deleted account" and still loads. A removed post returns 410 from both the API and prerender, and leaves the sitemap. → Tasks 3, 6 and 9 tests.

---

## File Map

**Server, create**
- `server/migrations/v3.185_community.sql`: all tables, triggers, seeds (spaces, notification events).
- `server/services/community/text.js`: pure validation, slug, mention and link helpers.
- `server/services/community/visibility.js`: `canView`, `filterVisible`.
- `server/services/community/serialize.js`: `serializeAuthor`, `serializeItem`, `serializeComment`.
- `server/services/community/indexable.js`: `computeIndexable`.
- `server/services/community/cursor.js`: `encodeCursor`, `decodeCursor`.
- `server/services/community/store.js`: all community DB reads and writes (the only file that calls `supabaseAdmin` for community tables).
- `server/services/community/notify.js`: reply, mention and removal notifications.
- `server/middleware/communityGate.js`: flag + early-access gate, terms gate, limiters.
- `server/controllers/communityController.js`: public and member endpoints.
- `server/controllers/communityAdminController.js`: moderation endpoints.
- `server/routes/communityRoutes.js`
- `server/controllers/prerenderCommunity.js`: community resolvers + renderers (keeps `prerenderController.js` from growing).
- Tests: `server/tests/unit/community/*.test.js`.

**Server, modify**
- `server/server.js`: mount `/api/community`.
- `server/middleware/security.js`: SQL-keyword exemption.
- `server/controllers/uploadController.js`: `community` folder for any logged-in user.
- `server/config/featureRegistry.js`, `server/services/featureFlags.js`.
- `server/lib/adminPermissions.js`, `server/routes/adminRoutes.js`, `server/controllers/opsAdminController.js`.
- `server/config/emailTemplates.js`.
- `server/routes/prerenderRoutes.js`.
- `server/services/sitemapService.js`, `server/controllers/sitemapController.js`, `server/routes/sitemapRoutes.js`.

**Client, create** (`client/src/...`)
- `services/communityApi.js`
- `utils/communitySeo.js`: JSON-LD builders.
- `pages/community/CommunityLayout.jsx`, `CommunityFeed.jsx`, `CommunitySpace.jsx`, `CommunityItem.jsx`, `CommunityGuidelines.jsx`
- `components/community/ItemCard.jsx`, `AuthorChip.jsx`, `CommentList.jsx`, `CommentForm.jsx`, `Composer.jsx`, `TermsDialog.jsx`, `ReportDialog.jsx`, `LinkifiedText.jsx`
- `pages/admin/AdminCommunity.jsx`: tabs Reports, Content, Members, Spaces.
- Tests under `client/src/**/__tests__/`.

**Client, modify**
- `client/src/App.jsx`, `client/src/config/reservedSegments.js`, `client/middleware.js`, `client/public/robots.txt`, `client/public/llms.txt`, `client/src/components/admin/adminNav.js`, `client/src/services/analytics/events.js`, Navbar (community link behind the flag).

---

### Task 1: Migration v3.185

**Files:**
- Create: `server/migrations/v3.185_community.sql`
- Test: `server/tests/unit/community/migration.test.js`

**Interfaces:**
- Produces: every table, column and CHECK value in spec §8, verbatim, plus `community_members.early_access`. Also produces the triggers and seeds below, which all later tasks rely on.

- [ ] **Step 1: Write the failing static test.** It reads the SQL file and asserts:
  - each table name is present (`community_members`, `community_spaces`, `community_posts`, `community_comments`, `community_media`, `community_embeds`, `community_polls`, `community_poll_options`, `community_poll_votes`, `community_reactions`, `community_follows`, `community_blocks`, `community_saves`, `community_mentions`, `community_hashtags`, `community_post_hashtags`, `community_reports`, `community_ads`);
  - `ENABLE ROW LEVEL SECURITY` appears 18 times;
  - `CREATE POLICY` does not appear;
  - `ON DELETE SET NULL` appears for `community_posts.author_id`, `community_comments.author_id` and `community_reports.reporter_id`;
  - the space keys `updates`, `help`, `ideas`, `host-corner`, `general` are seeded;
  - the event keys `COMMUNITY_REPLY`, `COMMUNITY_MENTION`, `COMMUNITY_CONTENT_REMOVED` are seeded.
- [ ] **Step 2: Run** `cd server && npx jest tests/unit/community/migration.test.js`. Expected: FAIL (file missing).
- [ ] **Step 3: Write the migration.**
  - **Tables:** exactly as in §8. Add a `kind='thread'` CHECK: `(kind <> 'thread') OR (title IS NOT NULL AND space_id IS NOT NULL)`. Add `community_media` "exactly one of post_id/comment_id". FK delete rules as in §8 "Account deletion".
  - **Indexes:** as listed in §8.
  - **Trigger functions:**
    1. `community_reactions` insert/delete → `like_count` ±1 on the target post or comment. A BEFORE INSERT check raises if the target row doesn't exist.
    2. `community_comments` insert/update of status → `comment_count` counts visible comments only. A new visible comment sets the post's `last_activity_at = now()`.
    3. `community_comments` / `community_posts` insert → `community_members.post_count` / `comment_count` +1 (upsert the member row if missing).
    4. `community_follows` → follower/following counts.
    5. `community_saves` → `save_count`.
    6. Repost insert/delete → `repost_count`.
    7. `community_poll_votes` → option `vote_count` and poll `total_votes`.
  - **Seeds:** spaces with positions 1–5 and policies from §6 (`updates`: post `official`, reply `everyone`; `host-corner`: post `hosts`, reply `hosts`; others `everyone`/`everyone`). Also three `notification_events` rows (`COMMUNITY_REPLY` and `COMMUNITY_MENTION` have email+in_app; `COMMUNITY_CONTENT_REMOVED` has email+in_app), using the `v3.130` INSERT … ON CONFLICT pattern.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Dry-run on a Supabase branch or locally.** If no branch is available, paste the SQL into a `BEGIN; … ROLLBACK;` through the Supabase MCP `execute_sql` **only after the founder approves touching the DB**. Expected: no errors. Do not apply for real yet. That happens in Task 14.
- [ ] **Step 6: Commit** `feat(community): v3.185 schema for all community phases`.

### Task 2: Text rules (pure)

**Files:**
- Create: `server/services/community/text.js`
- Test: `server/tests/unit/community/text.test.js`

**Interfaces:**
- Produces:
  - `validateDraft({kind, format, title, body}) → {ok:true, title, body} | {ok:false, code, message}`. Trims, and enforces the limits and required title for threads. `code` is one of `TITLE_REQUIRED|TITLE_TOO_LONG|BODY_REQUIRED|BODY_TOO_LONG|CONTACT_NOT_ALLOWED|LINK_NOT_ALLOWED|BLOCKED_LINK|BLOCKED_TERM`.
  - `checkSafety(text, {linksAllowed}) → null | {code, message}`.
  - `makeSlug(source) → string`: lower-case, ASCII words, at most 8 words or 60 chars, `-` joined, plus `-` and a 6-char base36 random suffix. Empty source becomes `post-xxxxxx`.
  - `extractMentions(text) → string[]`: unique lower-cased usernames from `@username` (`[a-z0-9_.]{3,30}`).
  - `extractUrls(text) → string[]`.
  - `BLOCKED_LINK_HOSTS`: an array.
- Consumes: `redactPii` from `server/services/botService.js` and `isBlocked` from `server/utils/adultContentFilter.js`. Contact detection = `redactPii(text) !== text` for the email or phone patterns. Card and id hits also count as contact.

- [ ] **Step 1: Write failing tests:**
  - `validateDraft({kind:'thread', format:'text', title:'', body:'x'}).code === 'TITLE_REQUIRED'`
  - a 151-char title gives `TITLE_TOO_LONG`
  - a post body of 1,001 chars gives `BODY_TOO_LONG`, while a thread body of 10,000 is ok
  - `checkSafety('call +91 98765 43210')`, `checkSafety('098765-43210')`, `checkSafety('9876543210')` and `checkSafety('mail me a@b.co')` all give `CONTACT_NOT_ALLOWED`
  - `checkSafety('session at 5pm for ₹1499 in 2026')` gives `null`
  - `checkSafety('book https://wa.me/919876543210', {linksAllowed:true})` gives `BLOCKED_LINK`
  - `checkSafety('see https://example.com', {linksAllowed:false})` gives `LINK_NOT_ALLOWED`
  - `checkSafety('see https://example.com', {linksAllowed:true})` gives `null`
  - `makeSlug('How do I price my FIRST session?!')` matches `/^how-do-i-price-my-first-session-[a-z0-9]{6}$/`
  - `extractMentions('hi @Priya_K and @priya_k')` equals `['priya_k']`
- [ ] **Step 2: Run** `npx jest tests/unit/community/text.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** `BLOCKED_LINK_HOSTS = ['wa.me','api.whatsapp.com','chat.whatsapp.com','t.me','telegram.me','calendly.com','cal.com','topmate.io','bit.ly','tinyurl.com','linktr.ee']`. Match by hostname suffix. `meeticulous.com` links are always allowed, even without `linksAllowed`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(community): text validation, contact/link guard, slugs`.

### Task 3: Visibility, serializers, indexability, cursor (pure)

**Files:**
- Create: `server/services/community/visibility.js`, `serialize.js`, `indexable.js`, `cursor.js`
- Test: `server/tests/unit/community/visibility.test.js`, `serialize.test.js`, `indexable.test.js`, `cursor.test.js`

**Interfaces:**
- Produces:
  - `canView(item, {viewerId=null, bannedAuthorIds=Set, blockedPairs=Set}) → boolean`. Returns true when `status==='visible'`, or when the viewer is the author and status is `hidden`. False when the author is in `bannedAuthorIds`, or when `blockedPairs` has `${viewerId}:${authorId}` or `${authorId}:${viewerId}`. Phase 1 passes an empty `blockedPairs`; the parameter exists for Phase 2.
  - `filterVisible(items, ctx) → items.filter(i => canView(i, ctx))`.
  - `serializeAuthor(profile|null, member|null) → {id, display_name, avatar_url, role:'host'|'guest'|'deleted', badge:null|'official'|'ai'|'staff', profile_url}`:
    - null profile: `{id:null, display_name:'Deleted account', avatar_url:null, role:'deleted', badge:null, profile_url:null}`
    - host (`is_host`): `display_name = name`, `profile_url = '/' + username`
    - guest: `display_name = first_name?.trim() || 'Member'`, `profile_url: null`
  - `serializeItem(row, {author, member, viewer:{liked:boolean}, media:[]}) → {id, kind, format, slug, url, title, body, space, author, like_count, comment_count, created_at, edited_at, last_activity_at, is_pinned, status, is_indexable, accepted_comment_id, media, viewer}`. `url` = `/community/t/:slug` for threads and `/community/p/:slug` for posts. Body becomes `''` and title becomes `null` when status is `deleted`/`removed`.
  - `serializeComment(row, {author, member, viewer}) → {id, post_id, parent_id, body, author, like_count, created_at, edited_at, status, viewer}`. Body is `''` when deleted or removed.
  - `computeIndexable({status, kind, format, body, accepted_comment_id, authorBanned, otherVisibleReplies, visibleReplies}) → boolean`, exactly per §7.5.
  - `encodeCursor(ts, id) → base64url string`; `decodeCursor(str) → {ts, id} | null` (null on garbage).

- [ ] **Step 1: Write failing tests:**
  - a guest profile `{first_name:'', last_name:'K', phone:'9…', email:'x', username:'g1', is_host:false}` serializes to exactly the keys listed above, with `display_name:'Member'`. Assert via `Object.keys(...).sort()` and assert `JSON.stringify` contains no `9…` and no `x`.
  - `serializeAuthor(null)` gives `'Deleted account'`
  - a hidden item is visible to its author and not to others; a removed item is visible to nobody; an item by an author in `bannedAuthorIds` is visible to nobody
  - a removed item's serialized `body === ''`
  - indexable truth table: a thread with a 200-char body is true; a thread with a 50-char body and 0 other replies is false; a thread with a 50-char body and 1 other reply is true; a 139-char post with 1 reply is false; a 139-char post with 2 replies is true; an announcement is true; a removed item is always false; an item whose author is banned is false
  - cursor round-trips, and `decodeCursor('%%%')` gives null
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the four modules.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(community): visibility, serializers, indexability, cursor`.

### Task 4: Gate, flags, limiters, WAF exemption, upload folder

**Files:**
- Create: `server/middleware/communityGate.js`
- Modify:
  - `server/config/featureRegistry.js`: 4 entries, category `Community`, `enabled:false`
  - `server/services/featureFlags.js`: add the 4 keys to `FAIL_CLOSED_KEYS`
  - `server/middleware/security.js` (`blockSuspiciousRequests`, ~L450)
  - `server/controllers/uploadController.js` (`ALLOWED_FOLDERS`, host check ~L72)
- Test: `server/tests/unit/community/gate.test.js`, `server/tests/unit/community/securityExemption.test.js`, add a case to the existing upload controller test (or a new `uploadCommunity.test.js`)

**Interfaces:**
- Produces:
  - `communityGate`: middleware. If `isFeatureEnabled('community')` is true, call `next()`. Otherwise, if `req.user` has a `community_members` row with `early_access` or a badge in (`official`,`staff`), call `next()`. Otherwise respond `404 {message:'Not found'}`. The member row is cached on `req.communityMember`.
  - `requireWrites`: if `community_writes` is off and the caller is not early-access/badged, respond `503` in the `requireFeature` shape.
  - `requireTerms`: loads the member row. Responds `403 {code:'COMMUNITY_TERMS_REQUIRED', terms_version}` if `terms_version !== CURRENT_TERMS_VERSION`. Responds `403 {code:'COMMUNITY_BANNED'}` if `banned_until > now()`.
  - `CURRENT_TERMS_VERSION = '2026-11-v1'`.
  - Limiters `postLimiter` (10/h), `commentLimiter` (60/h), `reactionLimiter` (300/h), `reportLimiter` (20/h). These copy the `uploadLimiter` shape (`makeRateLimitStore('community_post')`, etc.) and use `keyGenerator: req => req.user?.id || req.ip`.
  - `isEarlyAccess(userId) → Promise<boolean>`, which Task 9 uses.

- [ ] **Step 1: Write failing tests.**
  - **Gate:** mock `isFeatureEnabled` and `supabaseAdmin`. Check four cases: flag on with no user → `next`; flag off with no user → 404; flag off with a user whose member is `{early_access:true}` → `next`; flag off with a user whose member is `{badge:'official'}` → `next`.
  - **`requireTerms`:** an old version → 403 `COMMUNITY_TERMS_REQUIRED`; `banned_until` in the future → 403 `COMMUNITY_BANNED`.
  - **Security** (Review Focus 1): `POST /api/community/items` with body `{body:'insert into my calendar, then drop table talk'}` → `next` called with no ban. `POST /api/community/items` with `{body:'<script>x</script>'}` → 400. `POST /api/bookings` with `{note:'insert into'}` → 400, so behaviour outside community is unchanged.
  - **Upload:** a guest user with `?folder=community` → not 403; a guest with `?folder=services` → 403.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The security exemption: when `req.originalUrl.startsWith('/api/community')` and `req.method !== 'GET'`, test only the XSS regex against the body. Path traversal and the URL checks stay as they are. Add a comment explaining why. In upload, add `'community'` to `ALLOWED_FOLDERS` and skip the host check when `req.query.folder === 'community'` and `req.user` is set.
- [ ] **Step 4: Run** the new tests plus `npx jest tests/unit/security` (existing). Expected: PASS.
- [ ] **Step 5: Commit** `feat(community): access gate, flags, limiters, WAF + upload exemptions`.

### Task 5: Store + write endpoints

**Files:**
- Create: `server/services/community/store.js`, `server/controllers/communityController.js` (write handlers), `server/routes/communityRoutes.js`
- Modify: `server/server.js` (mount after `/api/blogs`: `app.use('/api/community', require('./routes/communityRoutes'));`)
- Test: `server/tests/unit/community/writes.test.js` (mock `config/supabase` with the fluent mock from `tests/unit/serviceController.test.js`; mock `community/notify`)

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces these routes. Every write uses `communityGate, protect, requireWrites, requireTerms`; `POST /terms` skips `requireTerms`.

  | Method | Path | Notes |
  |---|---|---|
  | POST | `/terms` | Upserts the member with `terms_version`/`terms_accepted_at`. Returns `{member}`. |
  | POST | `/items` | `postLimiter`. Body `{kind, format, title?, body, space_key?, media:[{url, width?, height?, alt?}] ≤ 4}`. Returns 201 `{item}`. |
  | PATCH | `/items/:id` | Author only. Edits `title`/`body` and sets `edited_at`. |
  | DELETE | `/items/:id` | Author only. Sets `status='deleted'`, `deleted_at`. |
  | POST | `/items/:id/comments` | `commentLimiter`. Body `{body, parent_id?}`. Returns 201 `{comment}`. |
  | PATCH/DELETE | `/comments/:id` | Author only. |
  | POST | `/items/:id/accept` | Body `{comment_id}`. Item author only, and only on `format='question'`. |
  | POST/DELETE | `/reactions` | `reactionLimiter`. Body `{target_type, target_id}`. Idempotent. |
  | POST | `/reports` | `reportLimiter`. Body `{target_type, target_id, reason, details?}`. On the third distinct open report it sets the target's `status='hidden'`. |

- Rules for creating an item:
  - **Space policy:** `official` needs member badge `official`|`staff`; `hosts` needs `profiles.is_host`.
  - **Format:** `announcement` only for `official`/`staff`. Phase 1 allows the formats `text|question|announcement`; anything else is rejected with 400 `FORMAT_NOT_AVAILABLE`.
  - **Safety:** `checkSafety` runs with `linksAllowed = store.linksAllowed(profile, member)`. That is true when any of these holds: `member.links_allowed`; `profile.is_host && profile.is_verified`; or `profile.created_at` is at least 7 days ago **and** `post_count + comment_count ≥ 3` (§10.3).
  - **Sitemap:** after creating an item, call `bustSitemapCache()`.
  - **Slug:** retry once on a unique violation.
  - **Mentions:** after insert, write `community_mentions`.
  - **Indexability:** recompute `is_indexable` via `store.refreshIndexable(postId)` after every create, edit, delete, comment and moderation.
- Comment reply policy: when `space.reply_policy='hosts'`, only hosts can comment.
- `store.refreshIndexable(postId) → Promise<boolean>`. It loads the post, author ban state and reply counts, then writes `computeIndexable`.

- [ ] **Step 1: Write failing tests:**
  - creating a thread without `space_key` → 400 `TITLE_REQUIRED` or `SPACE_REQUIRED`
  - a guest creating a thread in `host-corner` → 403
  - a guest creating `announcement` → 403
  - a body with a phone number → 400 `CONTACT_NOT_ALLOWED`
  - a valid post → 201, and the insert payload has `slug` matching the slug regex and `author_id === req.user.id`
  - editing someone else's item → 403
  - deleting your own item → update called with `status:'deleted'`
  - a comment on a `host-corner` thread by a guest → 403
  - the third report → update `status:'hidden'` called
  - a second like is a no-op (upsert/ignore)
  - `notify.onComment` is called once per created comment
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `store.js` (one function per DB action, each wrapping the "relation does not exist" fallback), the controller handlers, and the routes.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(community): write API (items, comments, likes, reports, terms)`.

### Task 6: Read endpoints

**Files:**
- Modify: `server/controllers/communityController.js`, `server/routes/communityRoutes.js`, `server/services/community/store.js`
- Test: `server/tests/unit/community/reads.test.js`

**Interfaces:**
- Produces these routes. All use `communityGate, optionalProtect`.

  | Method | Path | Returns |
  |---|---|---|
  | GET | `/spaces` | `{spaces:[{key, name, description, post_policy, reply_policy}]}` (active, by position) |
  | GET | `/feed?tab=everyone\|updates&cursor=` | `{items, next_cursor}`, 20 per page |
  | GET | `/spaces/:key/threads?cursor=` | `{space, items, next_cursor}` |
  | GET | `/items/:slug` | `{item, space, comments, next_comment_cursor}`; `410 {code:'GONE'}` when removed/deleted; 404 when missing or invisible |
  | GET | `/items/:slug/comments?cursor=` | `{comments, next_cursor}`, 50 per page, oldest first |
  | GET | `/me` | `{member, terms_version_required}` (login) |

- Feed details:
  - `everyone` = all visible items, `created_at desc, id desc`.
  - `updates` = `space.key='updates' OR format='announcement'`.
  - Page 1 is prefixed with pinned items where `pinned_until` is null or in the future.
  - Fetch `limit + 5` and apply `filterVisible`, because SQL filters status but the author-ban check is in JS. Banned author IDs = `community_members.banned_until > now()` ∪ `profiles.is_banned`, cached 60s.
- Viewer state: one query on `community_reactions` for the page's item IDs and the viewer's ID.
- Authors: one `profiles` query and one `community_members` query per page.
- Anonymous responses call `setPublicCache(res, 60)`.

- [ ] **Step 1: Write failing tests:**
  - `/feed` with 3 rows (one by a banned author) → 2 items
  - `next_cursor` decodes to the last item's `created_at|id`
  - an anonymous viewer gets `viewer.liked === false` for every item, and the reactions table is not queried
  - a logged-in viewer → the reactions table is queried exactly once
  - `/items/:slug` for a removed row → 410
  - for a hidden row viewed by a non-author → 404
  - for a post by a deleted account (`author_id: null`) → 200 with author `'Deleted account'`
  - `/items/:slug` with `kind='thread'` → `item.url` starts with `/community/t/`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(community): read API (feed, spaces, detail, comments)`.

### Task 7: Notifications

**Files:**
- Create: `server/services/community/notify.js`
- Modify: `server/config/emailTemplates.js` (templates for the three event keys, in the existing template shape)
- Test: `server/tests/unit/community/notify.test.js`

**Interfaces:**
- Consumes:
  - `inAppNotify({userId, role, type, title, body, link, dedupeKey})`
  - `notificationEngine.send({event, data})`, called like `server/services/activationNudges.js:83`
- Produces:
  - `onComment({item, comment, actorId}) → Promise<void>`. Notifies the item author, and the parent comment's author if different. Skips self-notification and authors with `badge='ai'`.
  - `onMentions({item, comment|null, usernames, actorId}) → Promise<void>`. Resolves usernames to profiles, skips the actor, and caps at 10.
  - `onRemoved({targetType, item, comment|null}) → Promise<void>`
  - All of these are fire-and-forget: they never throw and never block a request.
- Dedupe keys: `community_reply:${recipientId}:${postId}:${YYYYMMDDHH}`, `community_mention:${recipientId}:${commentId||postId}`, `community_removed:${targetId}`. *(Deliberate simplification of §14 coalescing: the first event per hour notifies, the rest are skipped. "Priya and 3 others" text updates come later, if needed.)*
- Email is sent only when `community_members.email_replies !== false` for reply and mention. Removal always emails.
- `role` passed to `inAppNotify` is `'host'` when `profiles.is_host`, else `'guest'`.
- Link: `item.url` plus `#c-${comment.id}` when a comment is involved.

- [ ] **Step 1: Write failing tests:**
  - A comments on B's post → `inAppNotify` called once for B with a dedupeKey matching `/^community_reply:B:/`, and `send` called with `event:'COMMUNITY_REPLY'`
  - B comments on B's own post → no calls
  - B has `email_replies:false` → in-app only
  - mentions of `['a','b','actor']` → 2 in-app calls
  - `inAppNotify` throwing does not reject `onComment`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Wire `onComment` and `onMentions` into the Task 5 create handlers (mentions on item create and comment create). Add the email templates.
- [ ] **Step 4: Run** the notify and writes tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(community): reply/mention/removal notifications`.

### Task 8: Moderation admin API

**Files:**
- Create: `server/controllers/communityAdminController.js`
- Modify:
  - `server/lib/adminPermissions.js`: add `community.view` and `community.moderate`. `operations` gets both, `support` gets `community.view`. (`community.ads` is added in Phase 2.)
  - `server/routes/adminRoutes.js`
  - `server/controllers/opsAdminController.js`: `open_community_reports` count beside `pending_reviews`
- Test: `server/tests/unit/community/admin.test.js`; the existing `adminPermissions` tests must still pass

**Interfaces:**
- Produces these routes (under `/api/admin`, `requireAdmin(perm)`):

  | Method | Path | Perm | Does |
  |---|---|---|---|
  | GET | `/community/reports?status=open` | view | Reports grouped by target, `defamation` first, then by count desc. Each group has a target preview and author. |
  | POST | `/community/reports/:id/resolve` | moderate | `{status:'resolved'\|'dismissed', note}` resolves all open reports on that target |
  | GET | `/community/content?q=&status=&cursor=` | view | Search items and comments by text (`ilike`) |
  | POST | `/community/content/:type/:id/moderate` | moderate | `{action:'hide'\|'restore'\|'remove', note}`. Sets status, `moderated_by`, `moderated_at`, `admin_note`. `remove` calls `notify.onRemoved`, `bustSitemapCache()` and `store.refreshIndexable`. |
  | POST | `/community/content/posts/:id/pin` | moderate | `{pinned:boolean, pinned_until?}` |
  | GET | `/community/members?q=` | view | |
  | PATCH | `/community/members/:userId` | moderate | `{badge?, early_access?, links_allowed?, banned_until?, ban_reason?}` (upserts the row) |
  | PATCH | `/community/spaces/:key` | moderate | `{name?, description?, position?, post_policy?, reply_policy?, is_active?}` |

- Every mutating route calls `audit(req, {action:'community.<verb>', resource_type, resource_id, before, after})`.

- [ ] **Step 1: Write failing tests:**
  - `remove` on a post → update with `status:'removed'`, `moderated_by: req.admin.id`, plus `audit` and `onRemoved` called
  - an invalid action → 400
  - PATCH member `{badge:'official'}` → upsert payload contains it
  - an invalid badge `'king'` → 400
  - reports grouping orders `defamation` first
  - `ROLES.support.permissions` includes `community.view` and not `community.moderate`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the admin tests and `npx jest tests/unit/adminPermissions`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(community): admin moderation API`.

### Task 9: Server SEO: prerender, sitemap, edge routing, robots

**Files:**
- Create: `server/controllers/prerenderCommunity.js`
- Modify:
  - `server/routes/prerenderRoutes.js`: register **before** `/:username`
  - `server/services/sitemapService.js`
  - `server/controllers/sitemapController.js`
  - `server/routes/sitemapRoutes.js`
  - `client/middleware.js`
  - `client/public/robots.txt`, `client/public/llms.txt`
  - `client/src/config/reservedSegments.js`: add `'community'`
- Test: `server/tests/unit/community/prerender.test.js`, `server/tests/unit/community/sitemap.test.js`; existing route-sync tests

**Interfaces:**
- Consumes: `buildHtml` and `esc` from `prerenderController.js` (export them if they are not exported already); `store` read functions; `isEarlyAccess`/flag.
- Produces:
  - Resolvers (pure-ish, same shape as `resolveProfileMeta`: they return `{status, redirectTo?, buildHtmlArgs?, payload?}`):
    - `resolveCommunityHome()`
    - `resolveCommunitySpace(key)`
    - `resolveCommunityItem(prefix:'t'|'p', slug)`: 301 on a wrong prefix, 410 when removed or deleted
    - `resolveCommunityGuidelines()`
    - All return 404 while the `community` flag is off (crawlers never have early access).
  - Routes: `GET /prerender/community`, `/prerender/community/s/:key`, `/prerender/community/t/:slug`, `/prerender/community/p/:slug`, `/prerender/community/guidelines`.
  - Item HTML body: `<article>` with an h1 title (or the first 60 chars), the escaped body with `\n` turned into `<br>`, the author, the date, and the first 20 visible replies. `robots` = `index,follow` if `is_indexable`, else `noindex,follow`.
  - JSON-LD: `DiscussionForumPosting` (§15 fields). `QAPage` when `format='question'` and `accepted_comment_id` is set. `BreadcrumbList` (Community › Space › Item).
  - Sitemap:
    - `communityEntries(rows, site) → [{loc, lastmod}]`
    - `fetchCommunity() → Promise<rows>` (indexable items + active spaces; empty when the flag is off or the table is missing)
    - `GET /sitemap-community.xml`, added to the index children
  - Edge (`client/middleware.js`): before the existing bot branch, if `segments[0]==='community'` and the UA matches `BOT_UA_RE` **or** `/Googlebot|bingbot/i`, call `fetchPrerender(url.pathname)`. On success return it, else fall through. Keep the comment explaining why Googlebot is included here only.
  - `robots.txt`: `Allow: /community/`, plus `Disallow: /community/search` and `Disallow: /community/saved` for `*`, and the same in each AI-crawler group added by PR #108. `llms.txt`: one line describing `/community`.

- [ ] **Step 1: Write failing tests:**
  - flag off → every resolver returns `{status:404}`
  - an item with `kind='thread'` requested as `p` → `{status:301, redirectTo:'…/community/t/<slug>'}`
  - a removed item → 410
  - a non-indexable item → `buildHtmlArgs.robots === 'noindex,follow'`
  - a question with an accepted answer → the JSON-LD `@type` includes `QAPage`
  - a body containing `<b>x</b>` is escaped in the HTML
  - a guest author's JSON-LD `author.name` is the first name and has no `url`
  - a deleted author → `author.name === 'Deleted account'`
  - `communityEntries` builds `https://meeticulous.com/community/t/<slug>` with lastmod from `last_activity_at`
  - sitemap is empty when the flag is off
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the community tests and `npx jest reservedSegments routeManifest` (both the server and client sync tests). Expected: PASS.
- [ ] **Step 5: Commit** `feat(community): prerender, JSON-LD, sitemap, edge routing, robots`.

### Task 10: Mockups (gate before any screen)

**Files:**
- Create: `docs/design/community-mockups.html` (static, uses `design-system/styles.css`)

- [ ] **Step 1:** Load the `meeticulous-design` skill. Build one static HTML file showing:
  - the desktop feed (three columns, §19)
  - the mobile feed
  - a thread detail with replies
  - the composer (Post/Thread toggle, space picker, photos)
  - the terms dialog
  - the report dialog
  - empty states
  - the admin reports queue
- [ ] **Step 2:** Run the `BRAND_RULES.md` checklist on it.
- [ ] **Step 3:** **Stop and show the founder** (artifact or browser preview). Apply their changes. Tasks 11–13 build to the approved mockup.
- [ ] **Step 4: Commit** `docs(community): approved UI mockups`.

### Task 11: Client foundation, feed, space and detail pages

**Files:**
- Create:
  - `client/src/services/communityApi.js`
  - `client/src/utils/communitySeo.js`
  - `client/src/pages/community/CommunityLayout.jsx`, `CommunityFeed.jsx`, `CommunitySpace.jsx`, `CommunityItem.jsx`
  - `client/src/components/community/ItemCard.jsx`, `AuthorChip.jsx`, `CommentList.jsx`, `LinkifiedText.jsx`
- Modify: `client/src/App.jsx` (lazy routes `/community`, `/community/s/:key`, `/community/t/:slug`, `/community/p/:slug`, `/community/guidelines`), `client/src/services/analytics/events.js`
- Test: `client/src/utils/__tests__/communitySeo.test.js`, `client/src/components/community/__tests__/LinkifiedText.test.jsx`, `client/src/pages/community/__tests__/CommunityFeed.test.jsx`

**Interfaces:**
- Consumes: the Task 5 and 6 routes.
- Produces:
  - `communityApi`: `getSpaces()`, `getFeed({tab, cursor})`, `getSpaceThreads({key, cursor})`, `getItem(slug)`, `getComments({slug, cursor})`, `getMe()`, `acceptTerms()`, `createItem(payload)`, `updateItem(id, patch)`, `deleteItem(id)`, `createComment(itemId, payload)`, `updateComment(id, patch)`, `deleteComment(id)`, `acceptAnswer(itemId, commentId)`, `like(targetType, id)`, `unlike(targetType, id)`, `report(payload)`. All use the shared axios instance exported from `services/api.js` (export it as `API` if it isn't exported).
  - `communitySeo`: `discussionForumPostingJsonLd(item, comments, siteUrl)`, `qaPageJsonLd(item, comments, siteUrl)`, `communityBreadcrumbJsonLd(item|null, space|null, siteUrl)`. Their output must match the server's JSON-LD for the same input; one shared fixture is used in both test suites.
  - `<LinkifiedText text>`: splits URLs into `<a rel="ugc nofollow noopener" target="_blank">`; everything else is text nodes with `<br/>` for `\n`.
  - Events: `COMMUNITY_VIEWED: 'community_viewed'`, `COMMUNITY_POST_CREATED: 'community_post_created'`, `COMMUNITY_REPLY_CREATED: 'community_reply_created'`, `COMMUNITY_LIKED: 'community_liked'`, `COMMUNITY_REPORTED: 'community_reported'`, `COMMUNITY_TERMS_ACCEPTED: 'community_terms_accepted'`.
- Behaviour:
  - Feed tabs: Everyone and Updates. Following is a disabled tab marked "soon", or hidden; follow the mockup.
  - Infinite scroll via `useInfiniteScroll(loadMore, {hasMore, loading})`.
  - Likes are optimistic, with rollback on error.
  - Logged-out "like" or "reply" opens the existing login route with `?next=` set to the current path.
  - Detail page: `Seo` gets title/description/canonical/robots (`noindex,follow` when `!item.is_indexable`) and `jsonLd`. A 410 renders a "This post was removed" page. Deleted comments render "[deleted]".
  - A 404 from `communityGate` renders the normal NotFound page.

- [ ] **Step 1: Write failing tests:**
  - `LinkifiedText` with `'see https://x.com\nok'` → one anchor with that `rel`, and one `<br>`
  - `LinkifiedText` with `'<img src=x onerror=alert(1)>'` renders as text with no `img` element
  - JSON-LD fixture parity with the server fixture (same object)
  - `CommunityFeed` with a mocked `getFeed` returning 2 items renders 2 `ItemCard`s
  - clicking like when logged out navigates to login
  - a like whose API call fails reverts the count
- [ ] **Step 2: Run** `cd client && npx vitest run src/utils/__tests__/communitySeo.test.js src/components/community src/pages/community`. Expected: FAIL.
- [ ] **Step 3: Implement** to the approved mockup.
- [ ] **Step 4: Run.** Expected: PASS. Then `npm run build`. Expected: success.
- [ ] **Step 5: Commit** `feat(community): feed, space and detail pages`.

### Task 12: Client writing: composer, comments, terms, report, photos

**Files:**
- Create: `client/src/components/community/Composer.jsx`, `CommentForm.jsx`, `TermsDialog.jsx`, `ReportDialog.jsx`
- Modify: `CommunityFeed.jsx`, `CommunitySpace.jsx`, `CommunityItem.jsx` (mount them)
- Test: `client/src/components/community/__tests__/Composer.test.jsx`, `TermsDialog.test.jsx`

**Interfaces:**
- Consumes: `communityApi`; `uploadImage(formData, 'community')` from `services/api.js`; `useAuth()`.
- Produces:
  - `<Composer open onClose onCreated defaultKind defaultSpaceKey>`
    - Post/Thread toggle; thread requires a title and a space.
    - Space picker hides spaces the user can't post in (`post_policy` vs `user.is_host` / member badge).
    - Format menu: Question, plus Announcement when badged.
    - Up to 4 photos, uploaded on pick, with a progress state.
    - Live character counter using the Global Constraints limits.
    - A server `code` maps to inline copy. `CONTACT_NOT_ALLOWED`: "Phone numbers and emails aren't allowed — guests book through your page." `LINK_NOT_ALLOWED`: "Links unlock once your account is a week old and has a few posts." `BLOCKED_LINK`: "That link isn't allowed here — share your Meeticulous page instead."
  - **Defamation nudge (§10.7):** when the text has an `@mention` **and** a complaint word (`scam|fraud|cheat|refund|worst|rude|no-show|didn't show`), show one line under the box: "Problem with a booking? Support can help →", linking to `/support`. It doesn't block posting.
  - `<TermsDialog onAccepted>` opens whenever any write returns `COMMUNITY_TERMS_REQUIRED`, links to `/community/guidelines`, calls `acceptTerms()`, then retries the write once.
  - `<ReportDialog target onClose>` offers the reason list from §8 `community_reports.reason`, verbatim, with human labels.
  - Comments: flat list, with "replying to @name" when `parent_id` is set. Authors can edit and delete their own; the item author can mark an answer accepted on question items.

- [ ] **Step 1: Write failing tests:**
  - a thread with no title → submit disabled
  - a post at 1,001 chars → counter red and submit disabled
  - the server returns `CONTACT_NOT_ALLOWED` → the exact copy above is shown
  - a write returning `COMMUNITY_TERMS_REQUIRED` opens `TermsDialog`; accepting it calls `acceptTerms` and then retries `createItem` once
  - a guest does not see Host Corner in the space picker
  - the text `'@priya total scam'` shows the support nudge; `'@priya great session'` does not
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS. Then `npm run build`.
- [ ] **Step 5: Commit** `feat(community): composer, replies, terms and report dialogs`.

### Task 13: Admin page, guidelines page, nav link

**Files:**
- Create: `client/src/pages/admin/AdminCommunity.jsx`, `client/src/pages/community/CommunityGuidelines.jsx`
- Modify:
  - `client/src/App.jsx`: lazy admin route in `<AdminWrapper>`, mirroring the reviews admin route
  - `client/src/components/admin/adminNav.js`: `{label:'Community', to:'/admin/community', perm:'community.view', badge:'open_community_reports'}`
  - Navbar: a "Community" link shown when `useFeature('community')` is on
- Test: `client/src/pages/admin/__tests__/AdminCommunity.test.jsx`

**Interfaces:**
- Consumes: the Task 8 routes; `admin/ui` primitives (`PageHeader`, `Badge`, `Btn`, `Card`, `Table`, `Skeleton`, `AdminFilters`); `AdminEmptyState`.
- Produces:
  - **AdminCommunity tabs:**
    - **Reports:** grouped list with Hide / Remove / Dismiss / Ban author (days input)
    - **Content:** search plus moderate and pin
    - **Members:** search; set badge, early access, links allowed, ban
    - **Spaces:** edit
  - **Guidelines page** sections:
    - What this is
    - Do / Don't (no contact details or off-platform booking, no naming hosts negatively — use support, no spam, no hate/harassment/sexual content, no illegal content)
    - Reporting
    - Consequences
    - **Grievance Officer** block with `{{GRIEVANCE_OFFICER_NAME}}`, `{{GRIEVANCE_OFFICER_EMAIL}}` placeholders in a clearly marked constant at the top of the file. The founder fills these before launch (§23).
    - Terms version `2026-11-v1`
  - Copy is a draft; the founder edits it.

- [ ] **Step 1: Write failing tests:**
  - the Reports tab renders a group with "defamation" first from mocked data
  - clicking Remove calls the moderate endpoint with `{action:'remove'}`
  - a user without `community.moderate` sees no action buttons
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS. Then `npm run build`.
- [ ] **Step 5: Commit** `feat(community): admin moderation page, guidelines, nav link`.

### Task 14: End-to-end verification, migration apply, PR

- [ ] **Step 1:** `cd server && npm test`. Expected: all pass. `cd client && npm test && npm run build`. Expected: all pass. Report any failure in pre-existing code separately; don't fix unrelated code.
- [ ] **Step 2: Ask the founder** before applying `v3.185_community.sql` to the live DB (`spquowzrefozmrzoszkf`) via the Supabase MCP `apply_migration`. After applying, verify with `list_tables` that the 18 tables exist, plus a query that all 5 spaces and all 3 notification events are present. Also run `get_advisors` (security) and confirm no new "RLS disabled" findings.
- [ ] **Step 3: Seed-mode smoke in the browser preview** (local server + client; flags still off):
  - logged out, `/community` shows NotFound
  - set your own member `early_access=true` via the admin Members tab
  - the feed loads
  - accept terms
  - create a thread in Help with a photo
  - reply
  - like
  - report from a second test account
  - the item appears in the admin Reports tab
  - a phone number in a post shows the inline error
  - `curl -A Googlebot localhost-edge/community/t/<slug>` is not possible locally, so instead `curl localhost:5000/prerender/community/t/<slug>` returns 404 while the flag is off
  
  Screenshot the feed and detail.
- [ ] **Step 4:** Add `docs/current-work.md` and `docs/feature-map.md` entries (community module files, flags, the launch checklist from spec §23).
- [ ] **Step 5:** Push `feat/community`, then `gh pr create --base release/2026-11` with a summary, the test evidence, the launch checklist (flags off; Grievance Officer; moderation owner; guidelines copy; seed 20–30 posts; then flip `community` + `community_writes`), and the PR footer. **Do not merge.**
