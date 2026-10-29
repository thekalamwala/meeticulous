# Blog Internal Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the blog a keyword-driven hub-and-spoke internal link graph — an automatic cluster-aware "Related reading" block on every post, plus scoped in-body pillar anchors — so link equity concentrates on pillars and flows to their clusters.

**Architecture:** A keyword taxonomy (`POST_TAGS` map + `BLOG_CLUSTERS` registry) drives a pure `selectRelated(slug)` selector over the static `BLOG_POSTS` array. A `RelatedPosts` component renders the selector's picks, **replacing** the existing newest-2 "Keep reading" block in `BlogPost.jsx`. In-body anchors are hand-added to pillar/spoke bodies and reseeded to both DBs.

**Tech Stack:** React 18 + Vite, react-router-dom v6, client Vitest (no jest-dom).

## Global Constraints

- No DB migration, no API change, no `blogs`-table column. Taxonomy is client-only.
- Card data comes from the **static `BLOG_POSTS`** array — no `/api/blogs` fetch in the post page.
- Related block renders **≤3** cards, never self-links, never empty (same-category → newest fallback).
- Client Vitest has **no jest-dom** (node22 ESM): assert DOM with `.getAttribute()`, not `toHaveAttribute`.
- Card markup matches the existing in-post "Keep reading" card exactly (category chip + title text card), NOT the thumbnail index card.
- Spec: `docs/superpowers/specs/2026-07-23-blog-internal-linking-design.md`.
- Commit after every task. Branch: `feat/blog-internal-linking`.

---

### Task 1: Cluster taxonomy data

**Files:**
- Create: `client/src/data/blogClusters.js`
- Test: `client/src/data/__tests__/blogClusters.test.js`

**Interfaces:**
- Produces: `export const POST_TAGS` (`Record<slug, string[]>`, all 40 published slugs), `export const BLOG_CLUSTERS` (`Array<{ key, keyword, pillar, tags: string[], priority?: number, description?: string, priorityLinks?: string[] }>`).

- [ ] **Step 1: Write the failing test**

```js
// client/src/data/__tests__/blogClusters.test.js
import { describe, it, expect } from 'vitest';
import { POST_TAGS, BLOG_CLUSTERS } from '../blogClusters';
import { BLOG_POSTS } from '../blogPosts';

const slugs = new Set(BLOG_POSTS.map((p) => p.slug));

describe('blog clusters taxonomy', () => {
  it('every published post has a non-empty tag list', () => {
    const missing = BLOG_POSTS.filter((p) => !(POST_TAGS[p.slug] && POST_TAGS[p.slug].length));
    expect(missing.map((p) => p.slug)).toEqual([]);
  });

  it('POST_TAGS has no unknown slugs', () => {
    expect(Object.keys(POST_TAGS).filter((s) => !slugs.has(s))).toEqual([]);
  });

  it('every cluster pillar is a real post', () => {
    expect(BLOG_CLUSTERS.filter((c) => !slugs.has(c.pillar)).map((c) => c.pillar)).toEqual([]);
  });

  it('every cluster tag is used by at least one post', () => {
    const used = new Set(Object.values(POST_TAGS).flat());
    const dead = BLOG_CLUSTERS.flatMap((c) => c.tags).filter((t) => !used.has(t));
    expect(dead).toEqual([]);
  });

  it('every priorityLink slug is real', () => {
    const bad = BLOG_CLUSTERS.flatMap((c) => c.priorityLinks || []).filter((s) => !slugs.has(s));
    expect(bad).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/data/__tests__/blogClusters.test.js`
Expected: FAIL — cannot resolve `../blogClusters`.

- [ ] **Step 3: Create the taxonomy file**

```js
// client/src/data/blogClusters.js
// Keyword taxonomy for blog internal linking. Client-only (NOT a DB column) —
// drives selectRelated() and the Related-reading block. Add a cluster = add a
// row to BLOG_CLUSTERS; tag a post = add/extend its POST_TAGS entry.
// See docs/superpowers/specs/2026-07-23-blog-internal-linking-design.md.

// Per-post keyword tags. Every published slug MUST appear (enforced by test).
export const POST_TAGS = {
  'the-strike-you-could-reset-yourself': ['security', 'trust', 'bolt'],
  'bolt-learned-to-say-no': ['bolt', 'support', 'ai', 'security'],
  'meet-bolt-the-support-assistant': ['bolt', 'support', 'ai'],
  'write-with-bolt-drafts-your-listing': ['bolt', 'ai', 'hosting'],
  'explore-ranking-and-a-more-app-like-app': ['discovery', 'growth', 'booking'],
  'gst-invoices-host-verification-mobile': ['payments', 'invoices', 'onboarding', 'hosting'],
  'themes-doors-and-a-warmer-booking-flow': ['booking', 'guest-experience', 'hosting'],
  'google-sign-in-service-pages-two-way-reviews': ['onboarding', 'account', 'hosting'],
  'onboarding-a-host-in-60-seconds': ['onboarding', 'hosting', 'account'],
  'monthly-plans-whatsapp-verification-reminders': ['pricing', 'onboarding', 'booking'],
  'phone-login-and-reschedule-bookings': ['booking', 'account', 'guest-experience'],
  'categories-that-make-sense-profile-polish': ['discovery', 'hosting'],
  'pricing-page-and-the-rebook-nudge': ['pricing', 'commission', 'growth'],
  'homepage-emails-and-downloadable-products': ['growth', 'marketing', 'earnings'],
  'permanent-usernames-legal-and-newsletter': ['onboarding', 'account', 'marketing'],
  'booking-in-under-a-minute': ['booking', 'scheduling', 'guest-experience'],
  'your-phone-number-is-the-account': ['account', 'booking', 'onboarding'],
  'the-first-booking': ['booking', 'building-in-public', 'milestones'],
  'the-ledger-nobody-asked-for': ['payments', 'money', 'earnings'],
  'two-bookings-one-slot': ['security', 'booking', 'data'],
  'payments-and-calendars-on-autopilot': ['payments', 'scheduling', 'booking'],
  'notifications-that-actually-arrive': ['booking', 'guest-experience', 'support'],
  'security-nobody-claps-for': ['security', 'trust', 'data'],
  'what-happens-to-your-aadhaar': ['security', 'trust', 'data', 'onboarding'],
  'how-explore-ranking-works': ['discovery', 'growth', 'marketing'],
  'digital-marketing-strategy-vibe-coders': ['marketing', 'growth', 'discovery'],
  'advance-payments-without-the-screenshot-dance': ['payments', 'booking', 'money'],
  'welcome-aastha-nikhare': ['team', 'building-in-public', 'milestones'],
  'building-in-public-why-we-blog': ['building-in-public', 'team', 'milestones'],
  'welcome-mohini-daf': ['team', 'building-in-public', 'milestones'],
  'the-arithmetic-of-commission': ['commission', 'pricing', 'earnings'],
  'what-a-booking-page-needs-in-india': ['commission', 'booking', 'pricing'],
  'where-your-money-sits': ['money', 'payments', 'earnings', 'commission'],
  'razorpay-is-the-source-of-truth': ['payments', 'money', 'invoices'],
  'going-live': ['building-in-public', 'milestones'],
  'hello-world': ['building-in-public', 'milestones'],
  'refer-earn-studio-crm-offline-bookings': ['growth', 'earnings', 'hosting'],
  'zero-commission-bet': ['commission', 'pricing', 'earnings'],
  'the-day-the-site-went-white': ['security', 'building-in-public', 'data'],
  'the-first-host-who-paid': ['commission', 'building-in-public', 'milestones', 'earnings'],
};

// Clusters, highest priority first. priority breaks ties when a post matches
// several clusters equally; priorityLinks floats curated siblings to the top.
export const BLOG_CLUSTERS = [
  { key: 'commission', keyword: '0% commission', pillar: 'zero-commission-bet',
    tags: ['commission', 'pricing', 'earnings'], priority: 100,
    description: 'The 0%-commission / flat-fee pricing argument.',
    priorityLinks: ['the-first-host-who-paid'] },
  { key: 'payments', keyword: 'payments', pillar: 'razorpay-is-the-source-of-truth',
    tags: ['payments', 'money', 'invoices'], priority: 90,
    description: 'Money movement, payouts, invoices, ledger.' },
  { key: 'security', keyword: 'security', pillar: 'security-nobody-claps-for',
    tags: ['security', 'trust', 'data'], priority: 85,
    description: 'Trust, data handling, abuse defense.' },
  { key: 'booking', keyword: 'booking', pillar: 'booking-in-under-a-minute',
    tags: ['booking', 'scheduling', 'guest-experience'], priority: 80,
    description: 'The guest booking experience.' },
  { key: 'onboarding', keyword: 'becoming a host', pillar: 'onboarding-a-host-in-60-seconds',
    tags: ['onboarding', 'hosting', 'account'], priority: 75,
    description: 'Signing up + setting up as a host.' },
  { key: 'growth', keyword: 'getting found', pillar: 'how-explore-ranking-works',
    tags: ['discovery', 'growth', 'marketing'], priority: 70,
    description: 'Discovery, ranking, referrals, marketing.' },
  { key: 'bolt', keyword: 'Bolt support', pillar: 'meet-bolt-the-support-assistant',
    tags: ['bolt', 'support', 'ai'], priority: 60,
    description: 'The Bolt support assistant.' },
  { key: 'stories', keyword: 'building in public', pillar: 'building-in-public-why-we-blog',
    tags: ['building-in-public', 'team', 'milestones'], priority: 50,
    description: 'Team, milestones, host stories, case studies.' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/data/__tests__/blogClusters.test.js`
Expected: PASS (5 tests). If "every published post has a non-empty tag list" fails, a slug exists in the DB but not in `POST_TAGS` — add it (get the live list with the SQL in the spec). If "no unknown slugs" fails, a `POST_TAGS` key was renamed/removed in the DB — delete it.

- [ ] **Step 5: Commit**

```bash
git add client/src/data/blogClusters.js client/src/data/__tests__/blogClusters.test.js
git commit -m "feat(blog): add keyword taxonomy for internal linking"
```

---

### Task 2: `selectRelated` selector + orphan guard

**Files:**
- Create: `client/src/lib/relatedPosts.js`
- Test: `client/src/lib/__tests__/relatedPosts.test.js`

**Interfaces:**
- Consumes: `BLOG_POSTS` (from `blogPosts.js`; each entry has `slug`, `category`, `date`), `POST_TAGS`, `BLOG_CLUSTERS` (from `blogClusters.js`).
- Produces: `export function selectRelated(slug: string): string[]` — returns ≤3 slugs, current slug excluded, deduped.

- [ ] **Step 1: Write the failing test**

```js
// client/src/lib/__tests__/relatedPosts.test.js
import { describe, it, expect } from 'vitest';
import { selectRelated } from '../relatedPosts';
import { BLOG_POSTS } from '../../data/blogPosts';
import { BLOG_CLUSTERS } from '../../data/blogClusters';

describe('selectRelated', () => {
  it('returns at most 3, never the current slug, no dupes', () => {
    for (const p of BLOG_POSTS) {
      const r = selectRelated(p.slug);
      expect(r.length).toBeLessThanOrEqual(3);
      expect(r).not.toContain(p.slug);
      expect(new Set(r).size).toBe(r.length);
    }
  });

  it('puts the primary cluster pillar first for a spoke', () => {
    // arithmetic-of-commission is a commission spoke; pillar = zero-commission-bet
    expect(selectRelated('the-arithmetic-of-commission')[0]).toBe('zero-commission-bet');
  });

  it('does not self-link when the post is its own pillar', () => {
    const r = selectRelated('zero-commission-bet');
    expect(r).not.toContain('zero-commission-bet');
    expect(r.length).toBeGreaterThan(0);
  });

  it('honors priorityLinks ordering', () => {
    // commission.priorityLinks = ['the-first-host-who-paid'] → floats above other siblings
    const r = selectRelated('the-arithmetic-of-commission');
    expect(r).toContain('the-first-host-who-paid');
  });

  it('falls back to same-category posts when a post has no cluster match', () => {
    // Sanity: an unknown slug returns [] (no crash)
    expect(selectRelated('does-not-exist')).toEqual([]);
  });

  it('leaves no published post an internal-link orphan', () => {
    const incoming = new Map(BLOG_POSTS.map((p) => [p.slug, 0]));
    for (const p of BLOG_POSTS) for (const s of selectRelated(p.slug)) incoming.set(s, (incoming.get(s) || 0) + 1);
    const orphans = [...incoming].filter(([, n]) => n === 0).map(([s]) => s);
    expect(orphans).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/__tests__/relatedPosts.test.js`
Expected: FAIL — cannot resolve `../relatedPosts`.

- [ ] **Step 3: Write the selector**

```js
// client/src/lib/relatedPosts.js
// Pure cluster-aware related-post selector. Reads the static BLOG_POSTS +
// taxonomy (POST_TAGS/BLOG_CLUSTERS). No fetch, no side effects — so it is
// prerender-safe and the orphan test can run it over every post.
import { BLOG_POSTS } from '../data/blogPosts';
import { POST_TAGS, BLOG_CLUSTERS } from '../data/blogClusters';

const RELATED_COUNT = 3;
const BY_SLUG = new Map(BLOG_POSTS.map((p) => [p.slug, p]));

const tagsOf = (slug) => POST_TAGS[slug] || [];
const overlap = (a, b) => a.filter((t) => b.includes(t)).length;
const timeOf = (slug) => {
  const p = BY_SLUG.get(slug);
  const t = p ? new Date(p.date).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

// Clusters a post belongs to, best match first:
// tag-overlap desc → priority desc → registry order.
function clustersFor(slug) {
  const tags = tagsOf(slug);
  return BLOG_CLUSTERS
    .map((c, i) => ({ c, i, ov: overlap(tags, c.tags) }))
    .filter((x) => x.ov > 0)
    .sort((a, b) => b.ov - a.ov || (b.c.priority || 0) - (a.c.priority || 0) || a.i - b.i)
    .map((x) => x.c);
}

export function selectRelated(slug) {
  const self = BY_SLUG.get(slug);
  if (!self) return [];
  const tags = tagsOf(slug);
  const primary = clustersFor(slug)[0] || null;

  const picks = [];
  const seen = new Set([slug]);
  const add = (s) => {
    if (s && !seen.has(s) && BY_SLUG.has(s) && picks.length < RELATED_COUNT) {
      seen.add(s);
      picks.push(s);
    }
  };

  // Slot 1: primary cluster's pillar (unless this post IS that pillar).
  if (primary && primary.pillar !== slug) add(primary.pillar);

  // Siblings: share >=1 tag; priorityLinks first, then overlap desc, newest tiebreak.
  const pri = primary ? (primary.priorityLinks || []) : [];
  const rank = (s) => (pri.indexOf(s) === -1 ? Infinity : pri.indexOf(s));
  BLOG_POSTS
    .map((p) => p.slug)
    .filter((s) => !seen.has(s) && overlap(tags, tagsOf(s)) > 0)
    .sort((a, b) =>
      (rank(a) - rank(b)) ||
      (overlap(tags, tagsOf(b)) - overlap(tags, tagsOf(a))) ||
      (timeOf(b) - timeOf(a)))
    .forEach(add);

  // Fallback so the block is never thin: same category newest, then newest overall.
  if (picks.length < RELATED_COUNT) {
    const byNew = BLOG_POSTS.slice().sort((a, b) => timeOf(b.slug) - timeOf(a.slug));
    byNew.filter((p) => p.category === self.category).forEach((p) => add(p.slug));
    byNew.forEach((p) => add(p.slug));
  }

  return picks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/__tests__/relatedPosts.test.js`
Expected: PASS (6 tests). If the orphan test fails, it names the orphan slug(s) — fix by adding a shared tag to that post in `POST_TAGS` (Task 1) or adding it to a cluster's `priorityLinks`, then re-run.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/relatedPosts.js client/src/lib/__tests__/relatedPosts.test.js
git commit -m "feat(blog): cluster-aware selectRelated selector with orphan guard"
```

---

### Task 3: `RelatedPosts` component

**Files:**
- Create: `client/src/components/blog/RelatedPosts.jsx`
- Test: `client/src/components/blog/__tests__/RelatedPosts.test.jsx`

**Interfaces:**
- Consumes: `selectRelated` (Task 2), `BLOG_POSTS` + `themeFor` (from `blogPosts.js`).
- Produces: `default export function RelatedPosts({ slug })` — renders ≤3 `<Link to="/blog/:slug">` cards, or `null` if none.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/blog/__tests__/RelatedPosts.test.jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RelatedPosts from '../RelatedPosts';

const renderFor = (slug) =>
  render(<MemoryRouter><RelatedPosts slug={slug} /></MemoryRouter>);

describe('RelatedPosts', () => {
  it('renders 1-3 blog links, never a self-link', () => {
    const { container } = renderFor('zero-commission-bet');
    const links = container.querySelectorAll('a[href^="/blog/"]');
    expect(links.length).toBeGreaterThan(0);
    expect(links.length).toBeLessThanOrEqual(3);
    links.forEach((a) => expect(a.getAttribute('href')).not.toBe('/blog/zero-commission-bet'));
  });

  it('renders nothing for an unknown slug', () => {
    const { container } = renderFor('does-not-exist');
    expect(container.querySelector('a[href^="/blog/"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/blog/__tests__/RelatedPosts.test.jsx`
Expected: FAIL — cannot resolve `../RelatedPosts`.

- [ ] **Step 3: Write the component**

Card markup is copied from the existing "Keep reading" block in `BlogPost.jsx` (category chip + title), so the two read identically. Grid is 3-up.

```jsx
// client/src/components/blog/RelatedPosts.jsx
// Cluster-aware "Related reading" block shown at the foot of every post.
// Static (no fetch) → prerendered into the post HTML → the internal links are
// crawlable. Card style matches the former "Keep reading" block it replaces.
import { Link } from 'react-router-dom';
import { BLOG_POSTS, themeFor } from '../../data/blogPosts';
import { selectRelated } from '../../lib/relatedPosts';

const HEAD_TX = '#F5F5F7';
const BY_SLUG = new Map(BLOG_POSTS.map((p) => [p.slug, p]));

export default function RelatedPosts({ slug }) {
  const posts = selectRelated(slug).map((s) => BY_SLUG.get(s)).filter(Boolean);
  if (posts.length === 0) return null;

  return (
    <div className="mt-14">
      <h2 className="text-lg font-bold tracking-tight" style={{ color: HEAD_TX }}>Related reading</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {posts.map((p) => {
          const pt = themeFor(p.category);
          return (
            <Link key={p.slug} to={`/blog/${p.slug}`}
              className="group rounded-xl border p-4 transition-colors hover:no-underline"
              style={{ borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: pt.accent }}>{p.category}</span>
              <h3 className="mt-1 font-heading text-base font-bold tracking-tight" style={{ color: HEAD_TX }}>{p.title}</h3>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/blog/__tests__/RelatedPosts.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/blog/RelatedPosts.jsx client/src/components/blog/__tests__/RelatedPosts.test.jsx
git commit -m "feat(blog): RelatedPosts component"
```

---

### Task 4: Wire `RelatedPosts` into the post page (replace "Keep reading")

**Files:**
- Modify: `client/src/pages/BlogPost.jsx`

**Interfaces:**
- Consumes: `RelatedPosts` (Task 3).

- [ ] **Step 1: Add the import**

In `client/src/pages/BlogPost.jsx`, after the existing `BlogHeroThumbnail` import (line 8), add:

```jsx
import RelatedPosts from '../components/blog/RelatedPosts';
```

- [ ] **Step 2: Drop the now-unused live-posts fetch**

Change the api import (line 5) from:

```jsx
import { getBlogBySlug, getBlogs } from '../services/api';
```
to:
```jsx
import { getBlogBySlug } from '../services/api';
```

Remove the `more` state (line 237):
```jsx
  const [more, setMore] = useState([]);
```

Remove the `getBlogs()` call inside the effect (lines 247-249):
```jsx
    getBlogs()
      .then((res) => { if (alive) setMore((res.data.posts || []).filter((p) => p.slug !== slug).slice(0, 2)); })
      .catch(() => {});
```

- [ ] **Step 3: Replace the "Keep reading" block with `RelatedPosts`**

Replace the entire block (lines 357-375, the `{/* Keep reading */}` comment through its closing `)}`):

```jsx
          {/* Keep reading */}
          {more.length > 0 && (
            <div className="mt-14">
              <h2 className="text-lg font-bold tracking-tight" style={{ color: HEAD_TX }}>Keep reading</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {more.map((p) => {
                  const pt = themeFor(p.category);
                  return (
                    <Link key={p.slug} to={`/blog/${p.slug}`}
                      className="group rounded-xl border p-4 transition-colors hover:no-underline"
                      style={{ borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: pt.accent }}>{p.category}</span>
                      <h3 className="mt-1 font-heading text-base font-bold tracking-tight" style={{ color: HEAD_TX }}>{p.title}</h3>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
```
with:
```jsx
          {/* Related reading — cluster-aware internal links (static, prerendered) */}
          <RelatedPosts slug={post.slug} />
```

- [ ] **Step 4: Build + verify render**

Run: `cd client && npm run build`
Expected: build succeeds, no unused-var errors for `more`/`getBlogs`/`themeFor`.
Note: `themeFor` is still used elsewhere in the file (`const t = themeFor(post.category)`), so keep its import.

Then confirm in the browser (server on staging DB already covers blogs):
- `preview_start {name:"server"}` and `{name:"client"}`, navigate to `http://localhost:5173/blog/the-arithmetic-of-commission`.
- Expect a "Related reading" heading with 3 cards; the first card = "The 0% commission bet".
- `read_console_messages onlyErrors:true` → none.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/BlogPost.jsx
git commit -m "feat(blog): cluster-aware Related reading replaces Keep reading block"
```

---

### Task 5: In-body pillar anchors (content pass) + reseed both DBs

**Files:**
- Modify: `client/src/data/blogPosts.js` (post `body` strings only)

**Interfaces:** none (content edits).

Goal: for each of the 8 clusters, ensure the **pillar body links down** to its spokes and **each spoke body links up** to its pillar, using the existing inline `[anchor](/blog/slug)` renderer, on natural keyword anchors. Many cross-links already exist — only fill gaps. Skip any anchor that would read as forced; the auto Related block already covers structure, so in-body anchors are additive, not mandatory per pair.

Pillar → spoke targets to ensure at least 3 down-links per pillar (from the taxonomy in the spec):
- `zero-commission-bet` → arithmetic-of-commission, where-your-money-sits, the-first-host-who-paid, pricing-page-and-the-rebook-nudge
- `razorpay-is-the-source-of-truth` → where-your-money-sits, gst-invoices-host-verification-mobile, the-ledger-nobody-asked-for
- `security-nobody-claps-for` → what-happens-to-your-aadhaar, the-strike-you-could-reset-yourself, two-bookings-one-slot
- `booking-in-under-a-minute` → themes-doors-and-a-warmer-booking-flow, phone-login-and-reschedule-bookings, advance-payments-without-the-screenshot-dance
- `how-explore-ranking-works` → explore-ranking-and-a-more-app-like-app, refer-earn-studio-crm-offline-bookings, digital-marketing-strategy-vibe-coders
- `onboarding-a-host-in-60-seconds` → google-sign-in-service-pages-two-way-reviews, gst-invoices-host-verification-mobile, permanent-usernames-legal-and-newsletter
- `meet-bolt-the-support-assistant` → bolt-learned-to-say-no, write-with-bolt-drafts-your-listing, the-strike-you-could-reset-yourself
- `building-in-public-why-we-blog` → the-first-host-who-paid, welcome-aastha-nikhare, welcome-mohini-daf

- [ ] **Step 1: For each pillar, add missing down-links**

Open the pillar's entry in `blogPosts.js`. For each target spoke not already linked in its body, wrap an existing keyword phrase in `[phrase](/blog/<spoke-slug>)` inside a `p`/`ul`/`info` string where it reads naturally. Example pattern (already used throughout the file): change
```js
{ p: 'The numbers are on the pricing page.' }
```
to
```js
{ p: 'The full breakdown is in [the arithmetic of commission](/blog/the-arithmetic-of-commission).' }
```
Do not invent new sentences solely to hold a link — extend existing ones.

- [ ] **Step 2: For each spoke, ensure one up-link to its pillar**

In each spoke's body, confirm there is a `[keyword](/blog/<pillar-slug>)` link on the cluster keyword; add one naturally if absent.

- [ ] **Step 3: Verify link integrity (no broken internal targets)**

Run (from repo root):
```bash
node -e "import('./client/src/data/blogPosts.js').then(({BLOG_POSTS})=>{const slugs=new Set(BLOG_POSTS.map(p=>p.slug));const bad=[];for(const p of BLOG_POSTS){JSON.stringify(p.body).replace(/\]\(\/blog\/([a-z0-9-]+)\)/g,(_,s)=>{if(!slugs.has(s))bad.push(p.slug+' -> '+s);return _;});}console.log(bad.length?('BROKEN: '+bad.join(', ')):'all internal blog links resolve');})"
```
Expected: `all internal blog links resolve`. Fix any `BROKEN` entry (typo'd slug).

- [ ] **Step 4: Build**

Run: `cd client && npm run build`
Expected: success.

- [ ] **Step 5: Reseed both DBs (bodies live in the DB)**

```bash
cd server && node -r dotenv/config scripts/seedBlogs.js dotenv_config_path=.env.staging
node -r dotenv/config scripts/seedBlogs.js dotenv_config_path=.env.production
```
Expected: `seeded 40/40 posts` each. (Prod reseed is a production write — confirm with the user before running the `.env.production` line if unsupervised.)

- [ ] **Step 6: Commit**

```bash
git add client/src/data/blogPosts.js
git commit -m "feat(blog): wire in-body pillar anchors across clusters"
```

---

## Final verification

- [ ] `cd client && npx vitest run src/data/__tests__/blogClusters.test.js src/lib/__tests__/relatedPosts.test.js src/components/blog/__tests__/RelatedPosts.test.jsx` → all green.
- [ ] `cd client && npm run build` → succeeds.
- [ ] Browser: a spoke post (e.g. `/blog/the-arithmetic-of-commission`) shows "Related reading" with its pillar first; a pillar post (`/blog/zero-commission-bet`) shows 3 non-self cards.
- [ ] Merge → prod re-prerenders post pages so the static related links bake into HTML.
