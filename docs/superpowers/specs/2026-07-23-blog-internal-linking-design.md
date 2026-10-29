# Blog Internal Linking — Related Posts + Pillar Anchors (Design)

_Date: 2026-07-23 · Branch: `feat/blog-internal-linking`_

## Goal

Give the blog a keyword-driven internal link graph so link equity concentrates on
pillar posts and flows out to the whole cluster ("boost one, it passes along").
Two mechanisms:

1. An automatic **Related reading** block on every post (structural pillar + sibling links).
2. Hand-wired **in-body pillar anchors** for the defined clusters (contextual keyword links).

Shape is deliberately **hub-and-spoke topic clusters**, NOT an all-to-all mesh — a mesh
dilutes equity across too many links and reads as a link farm, which Google discounts.

## Non-goals (YAGNI)

- No admin UI for tags/clusters.
- No per-*post* manual `related` override (cluster-level `priorityLinks` covers curation).
- No live `/api/blogs` fetch in the post page (static data only).
- No auto all-to-all linker.
- No DB migration, no API change, no `blogs`-table column.
- **No build-time precomputed related index.** The selector is pure over ~40 static posts;
  per-render cost is trivial and a generated artifact only adds a staleness surface. If the
  post count ever makes this measurable, the upgrade path is a module-level memo inside
  `relatedPosts.js` (compute once on first call) — not a build step. The orphan test runs the
  pure selector directly, so it needs no precomputed index.

## Key distinction: cluster ≠ display category

`category` (Feature Update, Security, Money, …) is the visual color band (`CATEGORY_THEME`).
An SEO **cluster** is a keyword theme and spans categories — e.g. the "0% commission"
story lives in Growth + Comparison + Money + Host Story + Product. Clusters are therefore
a **separate layer** from category, modeled with per-post keyword `tags` + a cluster registry.

## Cluster taxonomy (initial 8)

A post may belong to several clusters (tag overlap). Pillar = the hub every spoke links up to.

| # | Cluster (keyword) | Pillar slug | Key spokes |
|---|---|---|---|
| 1 | 0% commission / pricing | `zero-commission-bet` | arithmetic-of-commission, where-your-money-sits, pricing-page-and-the-rebook-nudge, refer-earn-studio-crm-offline-bookings, the-first-host-who-paid, what-a-booking-page-needs-in-india |
| 2 | Payments & money | `razorpay-is-the-source-of-truth` | where-your-money-sits, advance-payments-without-the-screenshot-dance, gst-invoices-host-verification-mobile, the-ledger-nobody-asked-for, payments-and-calendars-on-autopilot |
| 3 | Security & trust | `security-nobody-claps-for` | what-happens-to-your-aadhaar, the-strike-you-could-reset-yourself, two-bookings-one-slot, the-day-the-site-went-white |
| 4 | Booking experience | `booking-in-under-a-minute` | themes-doors-and-a-warmer-booking-flow, phone-login-and-reschedule-bookings, your-phone-number-is-the-account, advance-payments-without-the-screenshot-dance |
| 5 | Getting found / growth | `how-explore-ranking-works` | explore-ranking-and-a-more-app-like-app, refer-earn-studio-crm-offline-bookings, digital-marketing-strategy-vibe-coders, categories-that-make-sense-profile-polish |
| 6 | Becoming a host / onboarding | `onboarding-a-host-in-60-seconds` | google-sign-in-service-pages-two-way-reviews, gst-invoices-host-verification-mobile, permanent-usernames-legal-and-newsletter, monthly-plans-whatsapp-verification-reminders |
| 7 | Bolt / support bot | `meet-bolt-the-support-assistant` | bolt-learned-to-say-no, the-strike-you-could-reset-yourself, write-with-bolt-drafts-your-listing |
| 8 | Building in public / stories (host stories, team, case studies) | `building-in-public-why-we-blog` | the-first-host-who-paid, welcome-aastha-nikhare, welcome-mohini-daf, hello-world, going-live |

Cluster 8 is the home for internal stories + future case studies. Guides fold into 1/5.
Adding a cluster later = one row in `BLOG_CLUSTERS` + tagging the relevant posts.

## Data model (all in `client/src/data/blogPosts.js` — client-only, no DB)

- Each `BLOG_POSTS` entry gains `tags: string[]` (keyword layer). Client-only; NOT a DB
  column, so adding tags needs **no reseed**.
- New export `BLOG_CLUSTERS`:
  ```js
  export const BLOG_CLUSTERS = [
    { key: 'commission', keyword: '0% commission', pillar: 'zero-commission-bet',
      tags: ['0% commission', 'pricing', 'earnings'],
      priority: 100,                       // optional; higher wins when clusters tie
      description: 'Why 0% commission…',   // optional; maintenance/authoring note only
      priorityLinks: ['the-first-host-who-paid'] }, // optional; curated siblings floated first
    // …7 more (one per cluster above)
  ];
  ```
  - `tags` — keywords that pull posts into the cluster; `pillar` — its hub slug.
  - `priority` (optional, default 0) — favors this cluster when several match a post with
    equal tag overlap (see selector step 3). Lets important clusters win ties deterministically.
  - `description` (optional) — human note for authors; no runtime effect.
  - `priorityLinks` (optional, default `[]`) — curated sibling slugs that float to the top of
    the sibling ranking for posts in this cluster, for cases where pure tag-overlap isn't ideal.

## Selector — `client/src/lib/relatedPosts.js` (pure, testable)

`selectRelated(slug) -> string[]` (≤3 slugs), reading static `BLOG_POSTS` + `BLOG_CLUSTERS`:

1. Resolve the current post + its `tags`.
2. Candidate clusters = clusters whose `tags` intersect the post's `tags`.
3. **Primary cluster** = the candidate with the most tag overlap; tiebreak = `priority` desc,
   then order in `BLOG_CLUSTERS`.
4. **Pillar** = primary cluster's `pillar` → slot 1. If the current post *is* that pillar,
   skip it (no self-link) and fill all 3 slots with spokes.
5. **Siblings** = all other posts sharing ≥1 tag with the current post. Ranking: the primary
   cluster's `priorityLinks` (that are eligible siblings) come first, in listed order; then the
   rest by shared-tag count desc, tiebreak newest (`published_at`/date desc). Fill remaining
   slots, excluding the current post and the already-chosen pillar. Dedup by slug.
6. **Fallbacks** (block is never empty, never self-links, never >3):
   - No/unknown tags or no candidate cluster → 3 newest posts of the same `category`.
   - Cluster smaller than 3 → top up from same-category, then newest overall.
   - Always return ≤3, deduped, current slug excluded.

## Component — `client/src/components/blog/RelatedPosts.jsx`

- Props: `slug` (current post). Calls `selectRelated(slug)`, maps results to `BLOG_POSTS`
  entries for card data (title/excerpt/image/icons/category).
- Renders a "Related reading" heading + up to 3 cards, reusing `BlogHeroThumbnail` art and
  the category chip so it matches the existing index cards (no new visual design).
- Anchor text = target post **title** (descriptive, keyword-rich — not "read more").
- Renders nothing if `selectRelated` returns empty (defensive; shouldn't happen given fallbacks).
- Mounted in `client/src/pages/BlogPost.jsx` after the body, before the bottom CTA band.

## Card data source: static `BLOG_POSTS`

Cards read the static `BLOG_POSTS` array (it is the seed source and lists every published
post with all display fields). Consequences:
- **No extra API call**, and links are pure static → prerender bakes them into the post HTML → crawlable.
- Tradeoff (accepted): a post whose title/excerpt was edited *only* via the admin UI, not
  `blogPosts.js`, shows the `blogPosts.js` value in a related card. `blogPosts.js` is the
  pipeline's source of truth, so this is tolerable.

## In-body pillar anchors (manual, scoped to pillars + direct spokes)

For each of the 8 clusters, edit post **bodies** in `blogPosts.js` so:
- the pillar links **down** to each of its spokes on a natural keyword anchor, and
- each spoke links **up** to its pillar on the cluster keyword,
using the existing inline `[anchor](/blog/slug)` renderer. Natural prose only — skip any
anchor that would read as forced. Thin/older posts outside the clusters rely on the auto
Related block alone.

**LANDMINE — anchors edit post bodies, which live in the DB.** Unlike `tags`/`BLOG_CLUSTERS`,
body edits require re-seeding **both** DBs: `node -r dotenv/config scripts/seedBlogs.js
dotenv_config_path=.env.staging` then `…=.env.production` (idempotent upsert by slug).

## SEO notes

- Related block is prerendered static HTML → the internal links are visible to crawlers.
- Descriptive title anchors + hub-and-spoke shape concentrate PageRank on pillars, which then
  redistribute to spokes — the intended "one boosts all" flow.
- Structural cap of 3 related links + only-natural in-body anchors avoids over-linking/dilution.

## Testing (client vitest)

- `client/src/lib/__tests__/relatedPosts.test.js` — pure selector: pillar-first ordering,
  self-link exclusion when post is its own pillar, tag-overlap ranking + newest tiebreak,
  no-tags → same-category fallback, tiny-cluster top-up, dedup, always ≤3. Mutation-checked
  (e.g. break the ranking sort → a test fails).
- `client/src/components/blog/__tests__/RelatedPosts.test.jsx` — renders ≤3 cards with correct
  `href`s. **LANDMINE:** client vitest has no jest-dom (node22 ESM) — assert with
  `.getAttribute('href')`, not `toHaveAttribute`.
- **Orphan guard** in `relatedPosts.test.js` — build the incoming-link map by running
  `selectRelated` over every published slug, then assert **no published post has zero incoming
  links** (every post is reachable via the Related block of at least one other post). This
  catches a post that was tagged such that nothing ever links to it. Scope: the structural
  Related-block graph only (not in-body prose anchors, which would need markdown parsing).
  Fails loudly with the orphan slug(s) named, so fixing = add a tag or a `priorityLinks` entry.

## Gates / rollout

- Client build (`npm run build`) + client vitest green.
- No server test, no migration, no API change.
- Publish steps: (1) merge branch (ships component + tags, no reseed needed for tags);
  (2) reseed both DBs for the in-body anchor body edits. Prod post pages re-prerender on deploy.

## Files touched

- `client/src/data/blogPosts.js` — add `tags` to each entry, add `BLOG_CLUSTERS`, add in-body anchors.
- `client/src/lib/relatedPosts.js` — new pure selector.
- `client/src/components/blog/RelatedPosts.jsx` — new component.
- `client/src/pages/BlogPost.jsx` — mount `RelatedPosts`.
- `client/src/lib/__tests__/relatedPosts.test.js`, `client/src/components/blog/__tests__/RelatedPosts.test.jsx` — new tests.
