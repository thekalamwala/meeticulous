# Exclusive membership content (host-gated community)

**Status:** planned — build in the **last week of November 2026 (Nov 24–30)**.
**Source:** profile-navbar work (Feed + Membership tabs shipped as a foundation).
**Owner:** Shubham.

---

## Why

Hosts want to post **members-only** content in the community — exclusive posts that only people
who **bought that host's membership** can **view, download, and comment on**. Free visitors see a
locked teaser and a prompt to join. This turns the Membership tab (currently an email waitlist) and
the Feed (currently public-only) into a paid, per-host exclusive surface.

## What already exists (the foundation — do NOT rebuild)

- **Feed endpoint** — `GET /api/community/users/:id/activity` → a host's posts + comments, gated by
  `communityGate`. (`server/controllers/communityController.js` `authorActivity`,
  `server/services/community/store.js` `listAuthorPosts`/`listAuthorComments`/`postContexts`.)
- **Membership tab** — early-access modal capturing email via `subscribeNewsletter(email,
  { interest: 'membership-early-access' })`. (`client/src/pages/HostProfile.jsx` `MembershipModal`.)
- **Community content model** — `community_posts`, `community_comments`, `community_media`,
  reactions/saves. Visibility + ban/block already enforced server-side (`visibility.js`,
  `communityGate.js`), fail-closed.
- **Payments** — Razorpay orders **and subscriptions** already run in prod
  (`server/controllers/paymentController.js`, plan middleware).
- **Media** — community images live in the **public** `images` Supabase bucket; a **private** `kyc`
  bucket already exists as a pattern for private storage + signed access.

**Everything below is additive. The shipped Feed/Membership code is forward-compatible and must not
be reworked.**

---

## The four moving parts

### 1. Per-host membership (the one new primitive)

New table — "who is a paying member of which host" (the platform `community_members` table is
**global**, so it cannot answer this):

```
host_memberships(
  id, host_id (FK profiles), member_id (FK profiles),
  status,            -- 'active' | 'past_due' | 'canceled' | 'expired'
  tier,              -- reserved for multiple tiers later; single tier for v1
  price_amount, currency,
  razorpay_subscription_id, razorpay_customer_id,
  started_at, current_period_end, canceled_at,
  created_at, updated_at
)
```
- Partial unique index: one **active** membership per (host_id, member_id).
- RLS on / no policies (service-role only), like every community table.
- Membership check helper in the store: `isActiveMember(hostId, memberId)` →
  `status='active' AND current_period_end > now()`.

### 2. Gate flag on content

- `community_posts.access_tier` — `'public' | 'members'`, default `'public'`. Additive column.
- Host picks "Members only" when composing (NewPost). Comments inherit the parent post's tier.

### 3. Enforcement (server-side, fail-closed — never trust the client)

For a `members` post, the viewer sees full body/media/comments **only when**
`isActiveMember(post.host_id, viewer.id)`. Otherwise a **locked teaser**: title + author + "Members
only", body stripped, media withheld, comment POST blocked (403). Touch points:
- `authorActivity` (Feed) — return members posts as teasers to non-members.
- `itemDetail` / `itemComments` — 403/teaser the body + comments for non-members.
- `createComment` — reject if the parent is `members` and viewer isn't a member.
- `serialize.js` — add a `locked: true` + `access_tier` field; strip `body`/`media` when locked.
- Keep the `members`-tier posts **out of the public sitemap** (`listIndexableRows` →
  `access_tier='public'` only) and out of prerender payloads.

### 4. Download exclusivity — the real technical requirement

Public bucket URLs are downloadable by anyone with the link, so **members-only media cannot live in
the public `images` bucket**. Plan:
- New **private** bucket `community-exclusive` (mirror the `kyc` bucket setup).
- Members-only post uploads land there; `community_media.url` stores the storage path, not a public URL.
- Serve via **short-lived signed URLs** minted server-side **only after** `isActiveMember` passes
  (new endpoint e.g. `GET /community/media/:id/signed-url`, gated). Non-members never receive a URL.
- `ponytail:` signed-URL TTL ~5 min; re-mint on demand rather than caching long-lived links.

### 5. Payment flow

- Membership tab → real **buy flow**. Host sets a monthly price (new field on `profiles` or a
  `host_membership_plans` row). Checkout = Razorpay **subscription** (recurring) → webhook writes/updates
  `host_memberships` (reuse the existing subscription webhook handler + signature verification).
- Cancel / past-due / expiry transitions driven by Razorpay webhooks → `host_memberships.status`.

---

## Feature flags

- `community_exclusive` (OFF, fail-closed) — gates the whole surface. Members-only posting, the buy
  flow, and teaser rendering all check it. Ships OFF; flip per the founder when ready.

## Open product decisions (resolve before building)

1. **Pricing model** — per-host price set by each host, or one platform-wide membership price? (Plan
   assumes per-host monthly.)
2. **Recurring vs one-time** — subscription (assumed) or a one-time unlock?
3. **Revenue split / commission** — does the platform take a cut of host membership revenue? (Ties
   into existing `bookings.commission_applied` logic.)
4. **Refunds / proration** on cancel — Razorpay default or custom?
5. **Comment rights** — can members comment on members-only posts only, or does buying a membership
   also unlock commenting on that host's public posts?
6. **GST / invoicing** for recurring host memberships (entity + tax — mirror the subscription GST work).

---

## Build order (last week of Nov)

1. **Migration + table** — `host_memberships` + `community_posts.access_tier` + `community_exclusive`
   flag seed. Apply on BOTH DBs; keep code-side schema fallback until confirmed.
2. **Membership store + check** — `isActiveMember`, membership CRUD in a new
   `server/services/community/membership.js`.
3. **Enforcement** — gating branches in `authorActivity` / `itemDetail` / `itemComments` /
   `createComment` + `serialize.js` `locked` field. Unit tests for member vs non-member.
4. **Private bucket + signed URLs** — bucket, upload routing for members-only media, signed-URL endpoint.
5. **Payment** — host price field, Razorpay subscription checkout, webhook → `host_memberships`.
6. **Client** — NewPost "Members only" toggle; Feed/post locked-teaser UI + "Join to unlock"; the
   Membership tab buy flow (replaces the waitlist modal when the flag is on).
7. **Verify** — server tests green, client build, manual: non-member sees teaser, member sees content
   + can download + comment, cancel revokes access.

## Out of scope (v1)

- Multiple membership tiers per host (schema leaves room via `tier`, UI is single-tier).
- Gifting/trials of a host membership.
- Member-only live events or DMs.

## Where it lands in the code

- Server: `server/migrations/` (new), `server/services/community/{membership,store,serialize,visibility}.js`,
  `server/controllers/communityController.js`, `server/routes/communityRoutes.js`,
  `server/controllers/paymentController.js` (webhook), `server/config/featureRegistry.js`.
- Client: `client/src/pages/HostProfile.jsx` (Feed teaser + Membership buy), `client/src/pages/community/NewPost.jsx`
  (members-only toggle), `client/src/services/communityApi.js`.
- DB: `host_memberships`, `community_posts.access_tier`, private bucket `community-exclusive`.
