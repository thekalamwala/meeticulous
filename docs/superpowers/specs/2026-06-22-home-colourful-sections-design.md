# Colourful homepage sections — design

**Date:** 2026-06-22
**Branch:** `refactor/home-colourful-sections`
**Status:** Approved (design), pending implementation

## Problem

The homepage uses a single accent colour (brand orange `--primary #FE5100`) everywhere.
It reads flat. Goal: introduce a small, harmonious, reusable accent palette — like
Calendly's multi-hue sections — applied tastefully (icons/accents, not whole
backgrounds) to four sections that currently look one-note.

## Scope

Four sections in `client/src/pages/Home.jsx`:

| Section | Heading | Line (approx) | Current bg |
|---|---|---|---|
| Industry Discovery | "Industries we support" | 856 | dark (`bg-ink`) |
| How it works | "From link to paid. Calmly." | 1113 | dark (`bg-neutral-800`) |
| Why Book A Sloth | "Why Book A Sloth" | 1470 | dark (`bg-ink`) |
| Trust & security | "Trust & security" | 1829 | light (canvas) |

## Palette

Distilled from the existing `MOREFEATURES` array ("...and so much more" grid,
Home.jsx:253) — the proven per-card colour pattern in this codebase. Six hues,
dropping the integration brand-reds/greens to keep it harmonious:

| Token | Hue | Hex |
|---|---|---|
| `--c-blue` | Blue | `#2563eb` |
| `--c-violet` | Violet | `#7c3aed` |
| `--c-cyan` | Cyan | `#0891b2` |
| `--c-emerald` | Emerald | `#059669` |
| `--c-amber` | Amber | `#f59e0b` |
| `--c-pink` | Pink | `#db2777` |

## Token plumbing (reusable, single source of truth)

1. **`client/src/styles/design-tokens.css` `:root`** — add the 6 hex vars above
   under a new `/* Accent palette */` block. This is the source of truth.
2. **`client/tailwind.config.js`** — mirror as named colours
   (`"c-blue": "#2563eb"`, …) so utility classes (`text-c-violet`,
   `bg-c-violet/10`, `bg-c-emerald/15`) are available app-wide for future use.
   (Tailwind needs literal hex for the `/opacity` modifier to compute alpha, so
   we duplicate the hex here rather than reference the CSS var — values must stay
   in sync; both blocks carry a comment pointing at the other.)

## Per-section changes

Colour lands on **icon tiles + accents only**. CTAs stay brand-orange
(`primary-cta`) for brand + conversion consistency. Dark sections stay dark
(the recent dark-section pass is intentional — do not flip to light).

- **Why Book A Sloth** (`WHY_CARDS`, 6 cards): add a `color` field per card →
  `blue, violet, cyan, emerald, amber, pink`. Icon tile becomes
  hue-tinted (`bg` hue @ ~15%) with hue icon; replace uniform
  `bg-primary/15 text-primary`. Add a soft hue glow on hover (optional, matches
  "...and so much more").
- **Trust & security** (`TRUST`, 5 cards): add `color` per card →
  `blue, emerald, violet, cyan, amber`. Icon tile hue-tinted (@ ~10%) + hue icon;
  replace `bg-primary/10 text-primary`.
- **How it works** (`STEPS`, 3 steps): add `color` per step →
  `blue → amber → emerald`. Hue applies to: node glow, the `+N` number badge,
  the chip, and the connector arrows between cards. (Number badge keeps white
  text — verify contrast on each hue; amber may need the darker stop.)
- **Industry Discovery** (`INDUSTRIES`, 5 cards): already carries a `color`
  field. Promote it from the faint corner watermark to a real accent: hue-tinted
  small tile/initial and hue on the profession-chip hover/border. Re-map `teal`
  `#0d9488` → `--c-emerald #059669` for palette consistency. CTA stays orange.

## Out of scope

- No layout/structure/copy changes.
- No change to other sections, the hero, footer, or the existing
  "...and so much more" grid (already colourful).
- No new dependencies.

## Verification

- `cd client && npm run build` passes.
- Preview homepage: dark sections show coloured icon tiles; Trust shows tinted
  tiles; CTAs still orange; number badges legible on their hue; hover states fine;
  nothing shifts/reflows.
- Spot-check mobile (375px) — grids already responsive; confirm tiles wrap.
