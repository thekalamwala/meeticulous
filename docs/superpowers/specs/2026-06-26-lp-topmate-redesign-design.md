# /lp/topmate-vs-meeticulous — Topmate-style rebuild

**Date:** 2026-06-26
**Branch:** `feat/lp-topmate-redesign`
**Route (unchanged):** `/lp/topmate-vs-meeticulous`

## Goal
Rebuild the paid-traffic landing page so each block mirrors Topmate.io's homepage
*visual style*, while the copy positions Meeticulous *against* Topmate (0% commission,
flat ₹499/mo, India-native). Single conversion goal: start a host signup.

## Decisions (locked with user)
- **Full replace** — drop old Savings Calculator, Comparison Table, "Switch in 2 min" steps.
- **Testimonials** — reuse Home.jsx carousel design + its 8 host quotes.
- **CTA** — single Topmate-style button → `/vendor-register` (GoogleStart). No email LeadForm.
- **Structure** — split into `client/src/components/lp/` (one file per block + a data file).
- **Animation** — pure CSS (keyframe marquee, scroll-snap carousel). Reduced-motion safe.
- Page keeps its own minimal header/footer; global nav already hidden on `/lp` (App.jsx).

## Blocks (top → bottom)

1. **Hero** (ref img 1)
   - Left: pill badge, H1 "Your All-in-One **Creator Storefront**", subcopy, dark
     **"Start My Page →"** button → `/vendor-register`, social-proof row
     (star rating + "0% commission" + count chips).
   - Right: two vertical columns of creator profile cards. Column A animates **up**,
     column B **down**, infinite loop via CSS keyframes on a duplicated list.
     Pauses under `prefers-reduced-motion`. Hidden/simplified on mobile (<sm).

2. **Creators carousel** (ref img 2)
   - Orange (`--primary`) full-bleed section. Heading "See what the best creators
     build on Meeticulous", prev/next arrow buttons (scroll the strip), horizontal
     scroll-snap row of dark cards: name, tag pills, photo, "View page →".

3. **Page in a flash** (ref img 3)
   - Left: H2 "Create your Meeticulous page in a **flash**" + subcopy + text-link CTA.
   - Right: static mockup card — avatar + slug + colored swatch column + lightning tile
     + notification stack ("New booking | ₹X", "A new testimonial", "New sale | ₹Y").

4. **Interactive accordion** (ref img 4)
   - Right: controlled numbered accordion (NOT native `<details>`): Offer 1:1 sessions /
     Setup Priority DM / Host a webinar / Bundle your services / Sell courses & products.
   - Left: preview image/mockup that **swaps when the open item changes** (React state).
   - One open at a time; first open by default.

5. **Testimonials** (ref img 5 slot)
   - Reuse Home carousel design + the 8 host testimonial objects (quote/name/role/avatar).
   - Self-contained copy on the LP (LP pages are intentionally standalone).

6. **Bento stat grid** (ref img 6)
   - Heading "Earn & Convert more with Meeticulous". 6 colored bento cards using the
     existing `--c-*` palette, reworded honestly for us:
     localised currency (2X), testimonial showcase (40%), country pricing (4X),
     instant/transparent payouts, abandoned-cart emails, get discovered.
     Icons only; CTAs (if any) stay orange.

7. **FAQ + final CTA + footer**
   - Restyle existing FAQ content (5 Q&A). Native `<details>` ok here.
   - Final dark CTA band: H2 + single "Start My Page →" button.
   - Minimal footer as currently (© / Privacy / Help / email).

## File layout
```
client/src/pages/lp/TopmateVsMeeticulous.jsx   # orchestrator: meta, analytics, block order
client/src/components/lp/
  lpData.js            # PROFILES (hero+carousel placeholders), TESTIMONIALS, BENTO, FAQ, STEPS
  LpHero.jsx
  LpCreatorsCarousel.jsx
  LpFlash.jsx
  LpAccordion.jsx
  LpTestimonials.jsx
  LpBento.jsx
  LpFaq.jsx            # also exports final CTA + footer, or keep those inline in page
```
- All placeholder profile/creator data lives in **one** `PROFILES` const in `lpData.js`
  so real profiles swap in one place later.

## Cross-cutting
- Keep `analytics.page({lp})` + `LP_VIEWED` on mount.
- Fire `LP_CTA_CLICKED` (with `{slug, slot}`) on every primary button click.
- Remove `LeadForm` + `useUtm`-for-lead usage (no email capture). Keep `useUtm` only if
  still attached to LP_VIEWED.
- Styling: Tailwind + existing tokens (`--primary`, `--c-*`, `bg-canvas`, `bg-sand`, `text-ink`).
  Watch the global `h1-h6 { color: ink }` rule — dark sections need explicit `text-white`.
- Vitest note: jest-dom matchers are NOT loaded — use `.getAttribute()`/`.textContent`,
  not `toHaveAttribute`/`toHaveTextContent`/`toHaveClass`.

## Out of scope
- Real creator profiles (user supplies later — swap `PROFILES`).
- Backend/leads table changes.
- Other `/lp/*` pages.

## Success criteria
- Page renders all 7 blocks in order; no console errors.
- Hero columns animate opposite directions; freeze under reduced-motion.
- Accordion swaps left preview on open.
- Every CTA navigates to `/vendor-register` and fires `LP_CTA_CLICKED`.
- `npm run build` (client) passes; existing client test suite stays green.
- Preview verified at 1440px + 375px.
