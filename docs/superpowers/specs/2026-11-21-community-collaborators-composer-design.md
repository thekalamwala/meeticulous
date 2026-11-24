# Community post collaborators + LinkedIn-style composer refresh

Date: 2026-11-21
Status: approved (approach), building

## Intent / why
Community post creation should feel like LinkedIn's composer, and let a creator
**credit up to 2 collaborators** on a post. Collaboration is the one genuinely
new capability; the rest of the reference UI is adopted only where it maps to
features we already have. Goal: richer, more social posts that surface on every
collaborator's profile, driving cross-promotion between hosts.

## Goals
- Add up to **2 collaborators** to a community post via a **search-select** picker
  (reuses the existing member search).
- Collaborators are credited **instantly** (no accept step) and **notified** in-app.
- A post shows **"Author with A & B"** on its card and detail.
- A collaborator's posts appear on **their** community profile feed too.
- Refresh the composer toward the LinkedIn pattern: clean header (author ·
  visibility pill · Post), clean body, and a **settings bottom-sheet** holding
  *Who can see* (existing audience) + *Add collaborators*.

## Non-goals (explicitly cut by the founder)
Poll, Schedule, Event, Job, Celebration, Document, Brand Partnership,
comment-control, Proofread, invite/accept flow. No new content *types*.

## Anti-goals
- No half-built stubs for the cut options (no dead "coming soon" rows).
- No second member-search endpoint — reuse `/community/mention-suggest`.
- Don't break existing posts/threads/media/audience behavior.

## Constraints
- Additive migration + schema-fallback in code (project rule): collaborators
  degrade to "none" if the table is missing, like every other community table.
- Max 2 collaborators, enforced **server-side** (client caps too, but server is
  truth). Self cannot be a collaborator. Each must be a real community member.
- Feature flag `community_collaborators` (ships OFF, fail-closed), consistent
  with other community features.

## Approaches (considered)
1. **Join table `community_post_collaborators`** (CHOSEN) — (post_id, profile_id,
   position, created_at). Ordering, clean notify, trivial "on their profile"
   query, easy to extend. RLS on / service-role only, like sibling tables.
2. Array column `collaborator_ids uuid[]` on `community_posts` — rejected: no
   ordering guarantees, awkward joins for hydrate + profile feed, harder to add
   per-collaborator state later.

## How (decided)
### Backend
- **Migration** `v3.2xx_community_post_collaborators.sql`: join table + partial
  unique `(post_id, profile_id)`, index on `profile_id` (profile-feed read),
  FK → `community_posts`/`profiles` ON DELETE CASCADE. RLS on, no policies.
- **`notification_events`** seed `COMMUNITY_COLLABORATOR_ADDED` (in-app on, email
  off, WhatsApp off) — matches existing community event rows.
- **`createItem`** (`communityController.js`): read `collaborator_ids` (array,
  ≤2, dedupe, drop self), validate each is mentionable via `store`, insert rows
  after `insertPost`/media (same no-half-post rollback guard). Fire-and-forget
  in-app notify each collaborator via `inAppNotify` with the new event +
  `dedupe_key` `collab:<postId>:<profileId>`.
- **`hydrateItems`** (`store.js`): one batched query loads collaborators for the
  page's post ids → `collaborators[]` `{id, display_name, avatar_url,
  profile_url}` on each serialized item. Schema-fallback: on missing table,
  return `[]`.
- **`authorActivity`** (profile feed): widen the post selection so a profile's
  feed includes posts where the member is author **OR** a collaborator.
- **`serialize.js`**: include `collaborators` on the item shape.

### Client
- **`ComposerForm.jsx`** fullscreen variant refreshed to the reference:
  header (X · author avatar · visibility pill · Post), clean body, Photo kept.
  A **settings sheet** (new small component or inline) with two rows: *Who can
  see* (existing audience/space control) and *Add collaborators*.
- **Collaborators sheet**: search input → `searchMentions(q)`; tap to add; chips
  with remove; hard cap 2; excludes self + dupes. Writes `collaborator_ids` into
  the `createItem` payload.
- **`ItemCard.jsx`**: author line renders "**Author** with **A** & **B**" (links
  to each profile) when `collaborators.length`.
- Gated by `community_collaborators` (useFeature): off → composer unchanged, no
  collaborator UI, server ignores the field.

### Notifications
Reuse `utils/inAppNotify.js` + the new event row. In-app only (email/WA off),
schema-fallback safe. Deep-links to the post.

## Left to the builder
- Exact migration number (next free v3.2xx), SQL mirrors sibling community tables.
- Whether the settings sheet is a new component vs. inline in ComposerForm —
  builder's call; keep it one file if small.
- Copy for the notification ("X added you as a collaborator on a post").
- Test coverage: server unit (create validation: cap 2, self-exclude, non-member
  reject, hydrate shape, profile-feed inclusion) + a client test for the picker
  cap. TDD per repo norm.

## Rollout
Flag OFF at merge. Migration applied to the live DB before/at flip. Flip after
device QA. No prod behavior change until flipped.
