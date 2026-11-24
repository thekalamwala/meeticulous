# Community Collaborators + Composer Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a community post credit up to 2 collaborators (search-select, instant credit + in-app notify), surface them on the post and on each collaborator's profile feed, behind a flag, with a LinkedIn-style composer refresh.

**Architecture:** New join table `community_post_collaborators`. Server validates/inserts in `createItem`, hydrates collaborators onto serialized items, widens the profile feed, and notifies via `inAppNotify`. Client adds a settings bottom-sheet (visibility + collaborators) and a search-select picker to `ComposerForm`, and renders collaborators in `ItemCard`. Everything gated by `community_collaborators`; all reads schema-fallback to empty.

**Tech Stack:** Node/Express + Supabase (knex-style query builder in `store.js`), React 18 + Vite, Jest (server), Vitest (client).

**Spec:** `docs/superpowers/specs/2026-11-21-community-collaborators-composer-design.md`

## Global Constraints
- Feature flag `community_collaborators` ships `enabled:false`, fail-closed (match `community_v2`).
- Max **2** collaborators, enforced server-side. Self excluded. Each must be a real community member (`store.searchMentionable` / profile lookup).
- Additive migration; every new read schema-fallbacks to `[]` on missing table (match sibling community tables).
- Reuse `/community/mention-suggest` (`searchMentions`) for the picker — no new search endpoint.
- In-app notify only (email + WhatsApp off), like other community events. `dedupeKey = collab:<postId>:<profileId>`.
- No stubs for cut options (poll/schedule/event/job/document/brand-partnership/comment-control/proofread).

## Review Focus
- **>2 collaborator ids** → server rejects `400 COLLAB_LIMIT` (covered Task 3).
- **A collaborator id that isn't a community member** → `400 COLLAB_INVALID`, nothing inserted (Task 3).
- **Self in the list / duplicate ids** → silently de-duped and self-dropped, post still succeeds (Task 3).
- **Missing `community_post_collaborators` table** (flag on before migration) → hydrate + profile feed return no collaborators, post still renders (Task 2, Task 4).
- **Deleting a collaborator's profile or the post** → collaborator rows cascade away, no orphan reads (Task 1).

---

## Task 1: Collaborators table + data layer

**Files:**
- Create: `server/migrations/v3.226_community_post_collaborators.sql`
- Modify: `server/services/community/store.js` (add two functions near `loadMediaByPost`, export them)
- Test: `server/tests/unit/community/collaborators.test.js`

**Interfaces:**
- Produces: `insertCollaborators(postId, profileIds: string[]): Promise<void>`; `loadCollaboratorsByPost(postIds: string[]): Promise<Map<postId, Array<{id, display_name, avatar_url, profile_url}>>>` (empty map on missing table).

- [ ] **Step 1: Migration SQL.** Create the file: table `community_post_collaborators` (`id uuid pk default gen_random_uuid()`, `post_id uuid not null references community_posts(id) on delete cascade`, `profile_id uuid not null references profiles(id) on delete cascade`, `position smallint not null default 0`, `created_at timestamptz default now()`), partial unique index `(post_id, profile_id)`, index on `profile_id`, `alter table ... enable row level security` with no policies (service-role only). Mirror a sibling file (e.g. the `v3.139`/community table migrations) for exact house style.

- [ ] **Step 2: Write failing test** `collaborators.test.js`: `loadCollaboratorsByPost` returns a map keyed by post id with `{id, display_name, avatar_url, profile_url}`; and returns an empty map when the table query errors ("table missing"). Mock `supabaseAdmin`/`run` as the other store tests do.

- [ ] **Step 3: Run test → FAIL** (`cd server && npm test -- collaborators`).

- [ ] **Step 4: Implement** `insertCollaborators` (insert `{post_id, profile_id, position:i}` rows) and `loadCollaboratorsByPost` (one query joining profiles → shape above; `try/catch` → empty map) in `store.js`, mirroring `loadMediaByPost`. Export both.

- [ ] **Step 5: Run test → PASS.**

- [ ] **Step 6: Commit** (`feat(community): collaborators table + store data layer`).

## Task 2: Hydrate collaborators onto serialized items

**Files:**
- Modify: `server/services/community/store.js` (`hydrateItems` — the `Promise.all` batch around line 391, and the per-item map around line 400)
- Modify: `server/services/community/serialize.js` (add `collaborators` to the item shape)
- Test: `server/tests/unit/community/serialize.test.js` (extend)

**Interfaces:**
- Consumes: `loadCollaboratorsByPost` (Task 1).
- Produces: serialized item carries `collaborators: Array<{id, display_name, avatar_url, profile_url}>` (default `[]`).

- [ ] **Step 1: Failing test:** a hydrated item for a post with two collaborator rows exposes `item.collaborators` with both, in `position` order; a post with none has `collaborators: []`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement:** add `loadCollaboratorsByPost(postIds)` to the `hydrateItems` `Promise.all`, attach `collaborators: collabMap.get(r.id) || []` on each item; ensure `serialize.js` passes it through.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** (`feat(community): hydrate collaborators onto items`).

## Task 3: createItem accepts + validates + notifies collaborators

**Files:**
- Modify: `server/controllers/communityController.js` (`createItem`, ~line 141–215; add an event constant + notify)
- Modify: the feature-flag registry (where `community_v2` is defined — ships `enabled:false`)
- Test: `server/tests/unit/community/writes.test.js` (extend)

**Interfaces:**
- Consumes: `store.insertCollaborators` (Task 1), `store.searchMentionable`/a profile check, `inAppNotify({userId, role, type, title, link, data, dedupeKey})`, `isFeatureEnabled`.
- Produces: event type string `COMMUNITY_COLLABORATOR_ADDED`.

- [ ] **Step 1: Failing tests** in `writes.test.js` (flag on):
  - `collaborator_ids` of length 3 → `400 COLLAB_LIMIT`, no post row.
  - a `collaborator_ids` entry that is not a member → `400 COLLAB_INVALID`.
  - valid 2 ids → post created, `insertCollaborators` called with those ids (self/dupes removed), `inAppNotify` called once per collaborator with type `COMMUNITY_COLLABORATOR_ADDED` and `dedupeKey` `collab:<postId>:<id>`.
  - flag off → `collaborator_ids` ignored, no collaborator rows, no notify.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement:** after the media insert + rollback guard, when `community_collaborators` is enabled: read `collaborator_ids` (array; coerce, dedupe, drop `uid`); if `>2` → `fail(res,400,'COLLAB_LIMIT')`; validate each is a real member (reject `COLLAB_INVALID`); `await store.insertCollaborators(item.id, ids)` inside the same try/rollback; then fire-and-forget `inAppNotify` per collaborator (role from their space, title "Added as a collaborator", `link: item.url`, `dedupeKey` above). Register `community_collaborators` in the flag registry (`enabled:false`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** (`feat(community): createItem collaborators validation + notify`).

## Task 4: Profile feed includes collaborator posts

**Files:**
- Modify: `server/services/community/store.js` (`authorActivity` / the member-posts query)
- Test: `server/tests/unit/community/reads.test.js` (extend)

- [ ] **Step 1: Failing test:** a member who is a collaborator (not author) on a visible post sees that post in their `authorActivity` feed; non-collaborators don't.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement:** widen the selection to posts where `author_id = member` OR `id IN (select post_id from community_post_collaborators where profile_id = member)`. Keep the existing visibility/status filters. Schema-fallback: on missing table, fall back to author-only (unchanged behavior).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** (`feat(community): profile feed includes collaborated posts`).

## Task 5: Composer — settings sheet + collaborators picker + refresh

**Files:**
- Modify: `client/src/components/community/ComposerForm.jsx` (fullscreen variant: header, settings sheet, payload)
- Create (if it keeps ComposerForm small): `client/src/components/community/CollaboratorPicker.jsx`
- Modify: `client/src/services/communityApi.js` if a thin helper is wanted (else reuse `searchMentions`)
- Test: `client/src/components/community/__tests__/CollaboratorPicker.test.jsx`

**Interfaces:**
- Consumes: `searchMentions(q)`, `useFeature('community_collaborators')`.
- Produces: `createItem` payload gains `collaborator_ids: string[]` (≤2) when the flag is on.

- [ ] **Step 1: Failing test:** the picker calls `searchMentions` on input, adds a tapped member as a chip, blocks adding a 3rd (cap 2) and blocks the current user/dupes, and exposes the selected ids.
- [ ] **Step 2: Run → FAIL** (`cd client && npm test -- CollaboratorPicker --maxWorkers=2`).
- [ ] **Step 3: Implement:** the picker (search input → results list → chips, cap 2, exclude self+dupes). In `ComposerForm` fullscreen variant: refresh header to `X · author avatar · visibility pill · Post`; add a settings bottom-sheet with two rows — *Who can see* (existing audience/space control, moved in) and *Add collaborators* (opens the picker); include `collaborator_ids` in the submit payload; gate all of it behind `useFeature('community_collaborators')` so flag-off keeps today's composer. Use design-system classes (`.mt-*`, 8px radii) per BRAND_RULES.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** (`feat(community): composer settings sheet + collaborator picker`).

## Task 6: ItemCard renders collaborators

**Files:**
- Modify: `client/src/components/community/ItemCard.jsx` (author line / `AuthorChip`)
- Test: `client/src/components/community/__tests__/ItemCard.test.jsx` (new or extend)

- [ ] **Step 1: Failing test:** an item with `collaborators: [A, B]` renders "with A & B" as profile links next to the author; `collaborators: []` renders the author alone (unchanged).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement:** in the author line, when `item.collaborators?.length`, append `with <Link A> & <Link B>` (handle 1 vs 2). Links use `profile_url`.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** (`feat(community): show collaborators on post card`).

## Task 7: Full suite + client build

- [ ] **Step 1:** `cd server && npm test` → green (only pre-existing failures, if any, called out).
- [ ] **Step 2:** `cd client && npm test -- --maxWorkers=2` → green.
- [ ] **Step 3:** `cd client && npm run build` → succeeds.
- [ ] **Step 4: Commit** any lockfile/snapshot updates; open PR to `release/2026-11`.
