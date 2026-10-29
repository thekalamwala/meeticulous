# Moments — Google-Doodle-style archive (2 pages)

**Date:** 2026-07-19
**Branch:** `feat/moments-pages`
**Status:** Approved design, pending implementation plan.

## What

"Moments" is a Book A Sloth product surface modeled on Google Doodles: an
archive homepage listing all moments, plus a subpage per moment with its art
and story. Search.jsx already links a featured moment to `/moments/:slug` and
falls back to `/moments` on empty search — those routes do not exist yet. This
spec builds them.

## Scope

Two client pages + a static data file + route wiring. No backend, no DB, no
admin. Curated marketing content (rare, dev-authored), so content lives in a
static file and publishing = edit file + deploy.

Out of scope (follow-ups, not this PR):
- DB-backed moments + admin CRUD.
- SEO indexing: prerender.mjs + sitemapService.js entries (both hold hardcoded
  slug lists — a known landmine; a separate PR does this deliberately).
- Per-moment OG share cards.

## Data — `client/src/data/moments.js`

Single source of truth, listed newest-first. Named exports:
- `MOMENTS` — array. Each moment:
  ```
  {
    slug,     // URL segment (/moments/:slug), unique, URL-safe
    title,    // headline
    date,     // display string, also sort order (newest first in the array)
    image,    // art URL. Convention: CDN .../images/moments/${slug}.png
    alt,      // image alt text
    excerpt,  // 1-2 line summary (index card + meta description)
    body,     // array of blocks: { p } paragraph | { h2 } section heading
    credits,  // optional attribution string
    cta,      // optional { label, href } — internal or external link
  }
  ```
- `FEATURED` — `MOMENTS[0]` (the current moment). Search.jsx imports this.
- `getMoment(slug)` — returns the moment or `undefined`.

Mirrors the `blogPosts.js` shape but skips the DB seed — pages render straight
from this file.

## Page 1 — `/moments` → `Moments.jsx` (index / archive)

- Normal app chrome (global navbar + footer, like `/blog`).
- `<Seo>` with title + description; `robots` indexable.
- Featured moment large at top (FEATURED), linking to its subpage.
- Responsive grid of the remaining moments: art thumbnail + title + date, each
  a link to `/moments/:slug`. Uses existing design tokens (border-2, rounded-xl,
  brand `#FE5100`, Plus Jakarta Sans headings / Poppins body).

## Page 2 — `/moments/:slug` → `MomentPage.jsx` (per-moment)

- Normal app chrome + `<Seo>` (title/description from the moment; JSON-LD).
- Large art, title, date.
- Story body: `{p}` / `{h2}` block renderer (same trivial pattern BlogPost
  uses — inline, no shared abstraction).
- Optional CTA button (moment.cta).
- Prev / next moment nav + "← All moments" back link.
- Unknown slug → existing errorCatalog 404 path (no new plumbing).

## Wiring — `App.jsx`

- Add `<Route path="/moments" element={<Moments />} />`.
- Add `<Route path="/moments/:slug" element={<MomentPage />} />`.
- Lazy-load both, matching the surrounding route pattern.

## Refactor — `Search.jsx`

Replace the hardcoded `MOMENT_SLUG` / `MOMENT_TITLE` / `MOMENT_IMG` /
`MOMENT_URL` consts with an import of `FEATURED` from `moments.js`. Single
source of truth, no drift. Behavior unchanged (still links to the moment page,
empty search still falls back to `/moments`).

## Testing (self-check)

One small test (`moments.test.js`, Vitest — client has no jest-dom, use plain
assertions / `.getAttribute()`):
- Every slug is unique.
- `getMoment` resolves each moment's slug and returns `undefined` for a bogus
  slug.
- `FEATURED === MOMENTS[0]`.

## Design tokens / product rules

- Reuse existing tokens; no new colors. 4px (`border-2`) borders, `rounded-xl`
  where already used. Plus Jakarta Sans headings, Poppins body.
- Reuse existing components before creating new ones.
