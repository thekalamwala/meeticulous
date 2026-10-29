# Profile Landing Redesign — Design

_Date: 2026-06-14_
_Scope: `client/src/pages/HostProfile.jsx` (public creator profile at `/:username`)_

## Goal

Turn the public profile (`domain.com/:username`, e.g. `/sndatarkar`) into a
minimal, trustworthy, conversion-focused creator landing page — a blend of
Calendly and a LinkedIn creator profile. Single centered card on the first
screen; bookable content below the fold.

## Constraints

- **Frontend-only.** No API or DB changes. `host.badges`,
  `google_calendar_connected`, `reviewData`, `services`, `products` already
  arrive via existing endpoints.
- Hidden metrics (Services count, Rating, Reviews count, Comments) are
  **collected and still fetched** — only hidden from the card UI, behind a
  flag, so they can be re-enabled later without layout changes.

## Layout

Replace the current two-column (`flex lg:flex-row`) layout with a vertical
stack:

1. **Hero** — `lg:min-h-screen`, flex-centered both axes. The profile card sits
   dead-center of the first screen on desktop. A subtle "↓" scroll cue at the
   bottom hints that services are below.
2. **Below the fold** — Services grid + view toggle, Reviews section, Digital
   Products. Unchanged in content; just relocated beneath the hero.

**Mobile (`< lg`):** no forced 100vh. Page flows naturally top-to-bottom
(card, then services) to avoid clipping tall cards on small screens. The 100vh
centering is a desktop-only enhancement.

## Profile Card

- **Width ≈ 80% of current.** Current `minWidth 350 / maxWidth 420` →
  new `maxWidth ~340`, centered. Cover height trimmed proportionally
  (`180 → ~150`).
- **Vertical order:** photo → name → Available Now → bio → badges → social →
  location.

### Photo presence
- Keep the 100×100 rounded-square photo with plan-colored outline.
- Keep the green online dot on the photo, gated on
  `google_calendar_connected` (truthful presence signal).

### "Available Now"
- Move out of the rating row onto its **own line directly under the name**:
  centered green dot + bold "Available Now" label.
- Stays gated on `google_calendar_connected` so it never falsely claims
  availability.

### Bio
- `text-left` → `text-center`. Keep 3-line clamp. Sits under Available Now,
  integrated with card styling.

### Badges
- Keep rendering `host.badges` (jsonb emoji badges, `{icon|emoji, label|name}`).
- Centered row, slightly larger, prominent but capped (wrap, no overflow).
- The badge-engine image showcase at `/:username/badges` is unchanged
  (out of scope).

## Hidden Metrics (flag-gated, not deleted)

Introduce a single constant, e.g.:

```js
const SHOW_CARD_METRICS = false; // hide stats strip + card star rating; data still collected
```

Gated by this flag (default off):
- The 3-column **Services / Rating / Reviews** stats strip on the card.
- The **star rating** beside the creator name on the card.

`reviewData` is still fetched and still drives the **below-fold Reviews
section** (which keeps its stars + review list). Flipping `SHOW_CARD_METRICS`
to `true` restores the card metrics with no other change.

## Out of Scope

- No changes to services/reviews/products data or their below-fold rendering
  beyond relocation.
- No badge-engine integration changes.
- No backend/API/DB changes.

## Acceptance

- Desktop: first screen is exactly the centered card filling the viewport; no
  scroll needed to see it; scrolling reveals services/reviews/products.
- Card is ~80% prior width, centered, with centered bio and Available Now
  under the name.
- No stats strip or card star rating visible; Reviews section below still works.
- Mobile flows naturally with no clipping.
