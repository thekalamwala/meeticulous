# About Page — Design Spec

**Date:** 2026-06-25
**Branch:** `feat/about-page`
**Status:** Approved — ready for implementation plan

## Goal

Replace the 70-line placeholder `client/src/pages/About.jsx` with a world-class, story-driven About page that feels like a natural continuation of the homepage. It must answer, before the visitor asks: why we exist, why trust us, who built this, why we're different, will we last, why choose us.

Route `/about` already exists in `App.jsx` (lazy-loaded, public, between `/reset-password` and `/help`). No routing changes needed beyond keeping the existing registration.

## Non-negotiable constraint: reuse the homepage design system

The page must reuse — not reinvent — the existing visual language. Ground truth (from `client/src/styles/design-tokens.css`, `tailwind.config.js`, `index.css`, `pages/Home.jsx`):

| Aspect | Value / source |
|---|---|
| Canvas bg | `--bg #FFF8EE` (warm white) |
| Dark section | `.bg-ink` / `#1a1a1a`, white text |
| Primary CTA | orange `#FE5100`; button class `bg-primary-cta #c23d00` text-white |
| Accent palette | `--c-blue/violet/cyan/emerald/amber/pink` (6 hues, `c-*` Tailwind too) |
| Radius | 4px max; 6px only on wrappers (`--radius-card`) |
| Shadows | `--shadow-hard-1/2` (hard tactile offset shadows) |
| Heading font | Plus Jakarta Sans (h1/h2 only) — Tailwind `font-heading` |
| Body font | Poppins — Tailwind `font-sans` |
| h1 size | `clamp(2.1rem,5vw,3.7rem)` weight 800 |
| Section shell | `<section className="px-5 py-20 sm:px-8 lg:py-28"><div className="mx-auto max-w-6xl">…</div></section>` |
| Icons | lucide-react |
| Motion | Framer Motion v12.40 + `components/home/Reveal.jsx` scroll fade-up |
| Keyframes | `brand-float` (floating cards), `brand-draw` (SVG line-draw on visible) |
| Button hover | `hover:-translate-y-0.5` lift |

**No new dependencies.** Framer Motion + lucide already present.

## Architecture (Approach B — focused components, no Home refactor)

```
client/src/pages/About.jsx                 # composes the 12 sections, lazy-loaded
client/src/components/about/
  AboutHero.jsx          # §1
  ProblemSplit.jsx       # §2
  StoryTimeline.jsx      # §3
  BeliefGrid.jsx         # §4
  BehindProduct.jsx      # §5
  StatStrip.jsx          # §6  (lift+localize Home Odometer)
  TeamGrid.jsx           # §7
  BuildFlow.jsx          # §8
  TrustGrid.jsx          # §9
  AboutTestimonials.jsx  # §10 (reuse homepage testimonial data/style)
  AboutFaq.jsx           # §11 (lift+localize Home FAQ single-open accordion)
  FinalCta.jsx           # §12
  Placeholder.jsx        # shared swappable placeholder tile (photos/avatars)
  aboutContent.js        # all copy + data arrays (single edit point for round-2 swap)
```

**Reuse as-is:** `components/home/Reveal.jsx`, `.btn` / `.btn--outline`, section shell pattern, `--c-*` palette, lucide icons, `brand-float` / `brand-draw` keyframes.

**Lift-and-localize (copy the pattern, do NOT refactor `Home.jsx`):**
- Odometer rolling-digit counter → inside `StatStrip.jsx`.
- FAQ single-open accordion (click toggles, lucide Plus rotate) → `AboutFaq.jsx`.

Rationale for B: spec asks for reusable components; keeps blast radius off the live 2248-line `Home.jsx`; each section is testable in isolation. Localizing Odometer/FAQ avoids risky edits to the homepage while staying visually identical.

### Placeholder strategy (round-2 swap)

`Placeholder.jsx` renders gradient/initials tiles matching `HeroFace` / `ProductMock` look. Every placeholder carries a `data-swap="<slot-name>"` attribute so round-2 real-content wiring is grep-able (`grep -r data-swap client/src/components/about`). All swappable copy/data lives in `aboutContent.js`. Bracketed values in copy (e.g. `<Xh`, `[N]+`) mark numbers to replace with real data — never invented.

## Section-by-section

Alternating warm-white (W) / ink-dark (D) rhythm: 1W 2W 3D 4W 5W 6D 7W 8D 9W 10W 11D 12W.

### §1 Hero — W, floating glass cards
- **UX reasoning:** Lead with *why we exist*, not "we are". Headline = purpose. Establishes homepage continuity instantly (same hero motif: big Plus-Jakarta headline + floating `brand-glass` cards).
- **Copy:**
  - H1: "Your time is worth protecting. So we built the calm way to get booked."
  - Sub: "Meeticulous helps creators publish their services, get booked, and get paid — without chasing DMs or losing a cut to commission."
  - CTA primary: "Let's Get Started" (→ host/get-started route, match homepage CTA target). Ghost: "See how it works" (anchor to §8 or home how-it-works).
- **Layout:** 2-col desktop (text left, floating placeholder cards right with `brand-float`); centered single column mobile. Warm ambient aura bg (reuse hero aura).

### §2 The Problem — W, strikethrough→solution
- **UX:** Describe the creator's world before introducing us. Builds empathy + the 0%-commission wedge.
- **Copy (heading + 4 pain→fix rows):**
  - Heading: "Getting booked shouldn't feel like a second job."
  - ~~Endless "what time works?" DMs~~ → "One link. They pick. Done."
  - ~~Platforms taking a cut of every booking~~ → "0% commission. You keep it all."
  - ~~No-shows and forgotten sessions~~ → "Auto reminders + paid-upfront options."
  - ~~Your audience locked inside someone else's app~~ → "Your page, your customers, your data."
- **Layout:** 2-col card grid desktop (reuse Problem→Solution card pattern: icon, strikethrough pain, dashed separator, solution). Stack on mobile.

### §3 Our Story — D, vertical timeline
- **UX:** Chronological journey builds "will you last" confidence. Concise nodes, not paragraphs.
- **Copy (4 nodes, origin spark = placeholder):**
  - The idea — "[placeholder: origin spark] We were tired of watching creators lose time and money to clunky tools."
  - The prototype — "First booking link, built in a weekend."
  - First host — "Someone got paid before the first message. It worked."
  - Today — "Building the calmest way to run a booking business."
- **Layout:** Vertical timeline, `brand-draw` connecting line/nodes animate on visible. Alternating left/right on desktop, single rail on mobile.

### §4 What We Believe — W, icon grid `--c-*`
- **UX:** Real product philosophies, not generic values. Each = belief + one-line why.
- **Copy:**
  - "Time should never be wasted." — Every tap removed is a minute given back.
  - "Software should simplify, not complicate." — If it needs a tutorial, we failed.
  - "Creators should own their audience." — Your customers are yours. Always.
  - "Automation should feel invisible." — The best tool is the one you forget is there.
  - "Calm beats hustle." — Work slower. Earn smarter.
- **Layout:** Icon-grid cards (reuse Features-grid card style), one `--c-*` accent per card cycling the 6-hue palette. 1-col mobile / 2-3 col desktop.

### §5 Behind the Product — W, placeholder tiles
- **UX:** Human side. No stock photos — designed placeholders swappable for real workspace/whiteboard shots round 2.
- **Copy:** Heading "Made by people who hate busywork as much as you do." Caption tiles: "Whiteboard sessions", "Real support", "Shipping weekly".
- **Layout:** 3-tile grid of `Placeholder` (data-swap="behind-1..3"), captions under each.

### §6 By the Numbers — D, Odometer (honest only)
- **UX:** Open-metrics trust. ONLY honest/non-fabricated values; bracketed numbers swap round 2. No invented customer counts.
- **Copy:** "0%" commission · "99.9%" uptime · "<[X]h" support response · "[N]+" countries ready · "[N]" years building.
- **Layout:** Dark strip, 4-5 Odometer counters (rolling digits on scroll-in), icon + label each. 2x2 mobile / row desktop (reuse Home stats strip).

### §7 Meet the Team — W, profile cards
- **UX:** Friendly, not corporate. Real team round 2; placeholders now.
- **Copy/data:** card = avatar (`Placeholder` data-swap="team-N") · name · role · one-line philosophy. Array in `aboutContent.js` with obvious placeholder entries.
- **Layout:** Responsive card grid (1/2/3-4 col). Hover lift.

### §8 How We Build — D, connected step flow
- **UX:** Show the process — transparency = trust.
- **Copy:** Listen → Research → Prototype → Build → Launch → Improve. Each step: short caption.
- **Layout:** Reuse How-It-Works connectors — horizontal arrows desktop, vertical line mobile; line-draw SVG step icons.

### §9 Security & Reliability — W, trust cards
- **UX:** Reassure on data/money. Clean cards, no walls of text.
- **Copy:**
  - "Encrypted by default" — data protected in transit and at rest.
  - "Payments you can trust" — Razorpay-secured, money handled right.
  - "Always backed up" — regular backups, nothing lost.
  - "Privacy-first" — your data is never sold. Export anytime.
- **Layout:** 2x2 / 4-col card grid, lucide shield/lock/database icons, `--c-*` accents.

### §10 Customer Trust — W, reuse homepage testimonials
- **UX:** Social proof. Reuse the testimonials already live on the homepage (assumed real).
- **Implementation:** Source the same testimonial data/quotes used in `Home.jsx`. If that data is inline in Home, extract the array into a shared `aboutContent.js` import or a small shared data module that BOTH can use — but do NOT alter Home's rendering. Simplest: copy the testimonial data into `aboutContent.js` (acceptable duplication; flagged for future de-dup). Render with the homepage testimonial card visual.
- **Layout:** Card row/grid (static grid acceptable; full drag-carousel optional, not required).

### §11 FAQ — D, single-open accordion
- **UX:** Answer trust questions directly.
- **Copy (Q list, answers placeholder-grade):** Who are you? · Where are you based? · How do you handle my data? · Can I export everything? · How fast is support? · How often do you ship?
- **Layout:** Lift Home FAQ accordion pattern — single-open, lucide Plus rotate, smooth height. Dark variant styling.

### §12 Final CTA — W, warm aura
- **UX:** Emotional close → convert.
- **Copy:** H2 "Your calmer booking business starts today." CTA "Let's Get Started" · ghost "Become a host".
- **Layout:** Centered, warm ambient aura bg, big orange CTA, lift hover.

## Motion & interaction spec

- Every section heading + card group: `Reveal` fade-up (`opacity 0→1, y 24→0, scale .985→1`, dur .7, ease `[0.22,1,0.36,1]`, staggered delay, `viewport once amount .25`). Respects `prefers-reduced-motion` (Reveal already does).
- `StatStrip`: Odometer rolling digits trigger on scroll-into-view; reduced-motion → instant final value.
- `StoryTimeline` + `BuildFlow`: `brand-draw` stroke-dash line animation on `is-visible`.
- `AboutHero`: floating placeholder cards use `brand-float` / `--slow` / `--mid`.
- Hover: cards `hover:-translate-y-0.5/1`; CTAs lift + color shift (existing `.btn`).
- No new animation library; no parallax-heavy scroll JS beyond existing patterns. Keep 60fps (transform/opacity only).

## Responsive

- Mobile-first. Section shell padding `px-5 py-20`, scales `sm:px-8 lg:py-28`.
- Multi-col grids collapse to single column on mobile; 2-col tablet; 3-5 col desktop per section.
- Horizontal step connectors (§8) → vertical line on mobile (homepage convention).
- White/dark alternation preserved at every breakpoint.
- Touch targets ≥44px; CTAs full-width on mobile where homepage does so.

## Accessibility & SEO

- Semantic `<section>`, single `<h1>` (hero), `<h2>` per section, `<h3>` cards.
- Reuse `Seo.jsx` for title/description + JSON-LD `Organization` schema.
- Alt text on every placeholder/image; decorative SVGs `aria-hidden`.
- Accordion: button semantics, `aria-expanded`, keyboard operable.
- Color contrast: use `primary-cta #c23d00` for white-on-orange (WCAG AA, per tailwind config note).

## Out of scope / deferred to round 2

- Real team names/photos, real hero + behind-the-product photos, real story origin spark, real metric numbers — all placeholder now, swapped via `aboutContent.js` + `data-swap` slots.
- Optional delight sections (public roadmap, changelog, wall-of-love) — NOT in this build; can be added later.
- De-duplicating testimonial data shared with Home — accepted duplication now.

## Testing

- `cd client && npm run build` must pass.
- `cd client && npm test` (Vitest) green; add a smoke render test for `About.jsx` (renders all section headings, no crash) and a unit test for the FAQ accordion toggle + Odometer final value.
- Manual: preview at `/about`, verify desktop + mobile breakpoints, reduced-motion, all CTAs navigate.

## Files touched

- New: `pages/About.jsx` (rewrite), `components/about/*` (13 files incl. `aboutContent.js`).
- Possibly touched: none in `Home.jsx` (explicitly avoided). `App.jsx` route already present — no change.
