# Explore Service Card Redesign — Design

**Date:** 2026-07-17
**Branch:** `feat/explore-card-redesign`
**Scope:** The service card on `/explore`, plus the grid that holds it.

## Goal

Rebuild the `/explore` service card to match a founder-supplied reference mockup:
cover image with an overlaid host chip, large title, short description, a row of
meta pills, and a footer pairing the price with a Book Now button.

## Reference vs. reality

The mockup was drawn with ideal data. Live production (38 active,
explore-eligible services, measured 2026-07-17) does not have all of it:

| Field | Populated | Consequence for the card |
|---|---|---|
| `thumbnail_url` (cover) | 38/38 | Safe |
| `meeting_mode` | 38/38 (36 online, 2 offline) | Safe, but ~95% read "Online" |
| `profiles.is_verified` | 38/38 | Check mark is decoration, not signal |
| `short_description`/`description` | 18/38, max 160 chars, only 5 over 80 | 20 cards render no description; none reach 3 lines |
| `profiles.location` (area) | 21/38 | 17 cards render no location pill |
| `total_reviews` | **0/38** | The rating line is dead on every card today |
| `price > 0` | 19/38 | Half the catalogue is Free |

Two elements in the mockup are therefore built but effectively invisible at
current data density: the rating line (0 rows) and, for half the grid, the
description. This is accepted, not designed around — see Non-goals.

## Deliberate deviations from the mockup

1. **Corner radius.** The mockup uses ~16–20px radii. `client/tailwind.config.js`
   caps the scale globally (`xl`/`2xl`/`3xl` → 6px) and `--radius-card` is 6px.
   CLAUDE.md states the 4px rule. The card ships at the system radius (6px).
2. **Book Now colour.** The mockup's button is amber. Amber is a real token
   (`secondary` = `#f59e0b`), but every CTA on `/explore` is `primary-cta`
   (`#c23d00`, picked for 5.3:1 contrast with white text). The button ships
   `primary-cta` so the page has one CTA colour.
3. **Mode wording.** The mockup says "Offline Meeting". `HostProfile.jsx:206`
   already renders `meeting_mode === 'offline' ? 'In-person' : 'Online'`. Reuse
   those words; do not introduce a third vocabulary for one concept.
4. **Description length.** The mockup shows three lines. Real descriptions max at
   160 chars, so the card clamps to two.

## Architecture

Three files. No new components, no new dependencies, no migration.

### 1. `server/controllers/exploreController.js`

The card payload is built by `toCard(row)`. It already reads `description` (for
search relevance) but never returns it. Add two fields:

- Add `meeting_mode` to the `.select()` in `fetchRanked()`.
- Add `short_description` to the same select.
- In `toCard()`, return:
  - `description: row.short_description || row.description || ''`
  - `meetingMode: row.meeting_mode === 'offline' ? 'offline' : 'online'`

`meeting_mode` is the real column. `service_type` is a **client-side alias only**
(`ServiceForm.jsx` writes both keys; only `meeting_mode` exists in Postgres).
Selecting `service_type` would 42703.

### 2. `client/src/components/guest/ServiceCard.jsx`

Full relayout. Structure, top to bottom:

- **Cover** — 4:3, `object-cover`, existing placeholder fallback when `coverImage` is null.
  - NEW badge, top-left, existing amber pill, with a `Sparkles` glyph added.
  - **Host chip**, overlaid bottom-left, over a `bg-gradient-to-t from-black/70`
    scrim. Avatar + host name + `BadgeCheck`. Star rating and review count
    render **only when `reviewCount > 0`**.
  - The scrim is required: white text over an arbitrary host-uploaded photo is
    otherwise unreadable on light images.
- **Body**
  - Title — `font-heading`, bold, `line-clamp-2`.
  - Description — `line-clamp-2`, muted. Renders only when non-empty.
  - Meta pills — location (when `area`), mode (always), available-this-week
    (when badge set). Tinted pills, existing language.
- **Footer** — above a hairline rule, pushed down with `mt-auto` so footers align
  across a grid row regardless of description presence.
  - Paid: "STARTS AT" eyebrow / `₹499` / "per session".
  - Free: the word `Free` alone — no eyebrow, no per-session suffix.
  - Book Now — a styled `<span>`, not an `<a>`. The whole card is already a
    `<Link>`; a nested anchor is invalid HTML.

Removed from the current card: the category pill (redundant — category is the
filter dimension), the Instant badge (`badges.instantBook` is hardcoded `false`
server-side; dead), and the footer "Verified" label (moves into the host chip).

The `rank` prop and its `logExploreClick` call are preserved exactly.

### 3. `client/src/pages/Explore.jsx`

- Grid `sm:grid-cols-2 lg:grid-cols-3`, dropping `xl:grid-cols-4`. The new card is
  portrait; at 4-up it would be a column of slivers.
- `PAGE_SIZE` 12 → 9, so pages stay whole 3-up rows.
- Skeleton updated to the new card's proportions.
- Drop `variant="flat"` from the `<ServiceCard>` call — the prop is not read by
  the component and never has been.

## Blast radius

`grep` confirms `components/guest/ServiceCard` has exactly one importer:
`Explore.jsx`. `HostProfile.jsx` defines its own inline `ServiceCard` (line 182)
and is untouched by this work.

## Testing

- `client/src/tests/` — a Vitest render of `ServiceCard` asserting: description
  hidden when empty, rating line hidden when `reviewCount === 0`, `Free` renders
  without the STARTS AT eyebrow, mode pill reads "In-person" for `offline`.
  Note: this repo's Vitest has **no jest-dom** — assert with `.getAttribute()` /
  `textContent`, not `.toBeInTheDocument()`.
- `server/tests/` — extend existing explore controller coverage to assert
  `toCard()` emits `description` and `meetingMode`.
- `cd client && npm run build` and `cd server && npm test` before finishing.

## Non-goals

- **Backfilling descriptions.** 20 of 38 services have none. Making
  `short_description` required belongs in `ServiceForm`, not in a card redesign.
- Making reviews exist. 0/38 is a marketplace problem, not a card problem.
- Touching `HostProfile`'s inline card.
- Any schema migration.
