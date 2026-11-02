# Restructuring the existing Meeticulous website

Instructions for Claude Code. Work in this order and commit after each phase.

## Phase 0: Install the system
1. Copy this folder into the repo (e.g. `/design-system/` or `src/brand/`).
2. Import `styles.css` globally (it pulls in tokens, fonts and component classes). In Next.js, use `app/layout.tsx` or `_app.tsx`; in Vite, use `main.tsx`.
3. Copy `assets/` into the public/static folder. Replace the favicon set with `assets/06-favicon/*` and paste `head-snippet.html` into `<head>`.
4. If the codebase uses Tailwind, map tokens into `tailwind.config` theme (colors → `var(--mt-*)` / semantic vars, fontFamily → `--font-display/body/script`, borderRadius → `--radius-*`, spacing → `--space-*`). Do not invent new values.

## Phase 1: Audit (no visual changes yet)
- List every page, section and shared component in the current site.
- List every hard-coded colour, font, radius and shadow (grep for `#`, `rgb(`, `font-family`, `border-radius`, `box-shadow`).
- Produce `MIGRATION_AUDIT.md`: page → sections → proposed system replacement.

## Phase 2: Foundations swap
- Replace hard-coded values with tokens (semantic ones first: `--bg-*`, `--fg-*`, `--border-*`).
- Swap fonts to Bricolage Grotesque, Poppins and Instrument Serif.
- Apply the base styles from `tokens/base.css`: cream page, maroon headings, ink body.

## Phase 3: Components
Replace site primitives with the system's components:
| Existing | Replace with |
|---|---|
| Buttons/links styled as buttons | `Button` / `.mt-btn` (+ variants) |
| Icon buttons | `IconButton` |
| Form fields | `Input`, `Select`, `Checkbox`, `Radio`, `Switch` |
| Feature/pricing/testimonial boxes | `Card` (surface / cream / blush / brand / outline) |
| Pills, labels, status chips | `Badge` (booked/open/busy/…) and `Tag` |
| Tab switchers | `Tabs` |
| Modals, toasts, tooltips | `Dialog`, `Toast`, `Tooltip` |
| Logos | `Logo` (never inline SVG copies) |
| Icons | `Icon` (Lucide) |

## Phase 4: Section patterns
Rebuild each section with these patterns (see `readme.md` VISUAL FOUNDATIONS and `guidelines/`):
- **Hero:** cream ground, two-beat headline (Bricolage 800, serif accent on the human half), body text, primary + ghost CTA. Right side: a live **slot-grid** composition (`SlotCell`: booked, open and empty cells) with ONE rose thread running behind it.
- **Feature grid:** a maroon section with dark-mode cards (`--bg-brand-strong`), each with a dark illustration, Bricolage title and blush body.
- **How it works:** a blush ground, with three steps connected by the ribbon/thread.
- **Social proof:** white cards on cream with a real photo (24px radius), quote, name and role.
- **Pricing:** surface cards, with the recommended plan as a `brand` card and an `onBrand` button.
- **CTA band:** a maroon field with the pink thread bleeding off the edge, a big headline and an `onBrand` button.
- **Footer:** maroon-dark, inverse wordmark, binder-tab divider (`assets/05-dividers/mt-divider-tabs-pink.svg`).
- **Section dividers:** a 2px ink rule or the binder-tab divider.

## Phase 5: Content
- Rewrite headlines as two-beat lines; buttons verb-first; sentence case everywhere.
- Remove emoji and hype words. Keep product facts specific.

## Phase 6: QA
Run the checklist at the bottom of `BRAND_RULES.md` on every page, then:
- Lighthouse accessibility ≥95, contrast checks, keyboard focus on all controls.
- Test at 375 / 768 / 1280 / 1920 widths.
- `prefers-reduced-motion` disables the thread draw-in.

## Never
- Redraw or recolour logos/illustrations
- Add a second accent colour, gradients or stock 3D art
- Use square corners or grey shadows
- Put the thread or a pattern behind paragraphs
