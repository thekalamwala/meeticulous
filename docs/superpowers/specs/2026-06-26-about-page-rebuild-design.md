# About Page Rebuild — Design Spec

**Date:** 2026-06-26
**Branch:** `refactor/about-page-redo`
**Scope:** Rebuild the `/about` page into a new long-scroll marketing page with homepage-grade motion. The "Team page" is folded in as a **section** on About (no separate route). Single page, single branch.

---

## 1. Goal

Replace the current 12-section calm/editorial About page with a new, motion-rich marketing layout (typewriter hero, logo marquee, sticky stacking cards, flip testimonials, masonry team) while **keeping** the 6 non-duplicate existing sections appended at the bottom.

- **Direction:** modern, polished, smooth motion, editorial layout.
- **Visual language:** reuse the existing app tokens — accent = `--primary-cta` (orange), `--c-*` palette, existing radii. CTAs stay orange.
- **Motion stack:** existing GSAP + Lenis + ScrollTrigger (already wired in `useAboutMotion.js`). No framer-motion added. All motion honors `prefers-reduced-motion`.
- **Known values filled from project context** (NOT placeholders): company = "Meeticulous"; one-liner + hero copy from existing `aboutContent.js`; booking-slot link = `meeticulous.com/:username`.

---

## 2. Page structure (top → bottom)

### New design block

1. **Hero** (`HeroV2.jsx`) — replaces old `AboutHero`.
   - Two columns. Left: text. Right: portrait image `[IMG TBD]`.
   - Headline in black (`--ink`); the **final word(s)** are a **typewriter loop** (type → erase → retype) in **orange accent** (`--primary-cta`).
   - Sub-copy below (reuse `hero.sub`).
   - Two CTAs side by side: **primary** (`btn` orange → `ROUTE_START`) + **ghost/outline** (`hero.ctaGhost` → "See how it works", scrolls to a section or `/` how-it-works).

2. **Logo marquee** (`LogoMarquee.jsx`).
   - Full-width, **two rows** auto-scrolling opposite directions (row 1 L→R, row 2 R→L), continuous loop.
   - Logos **grayscale by default**; on hover, **only the hovered logo** shows full color (siblings stay grayscale).
   - Data: `logos[]` in `aboutContent.js` — `[LOGOS TBD]`, placeholder monochrome chips until real assets supplied.

3. **Join split 30/70** (`JoinSplit.jsx`).
   - Left 30%: heading ("Join our team" `[COPY TBD]`) + single button.
   - Right 70%: one large image `[IMG TBD]`.

4. **Stacking cards** (`StackingCards.jsx`).
   - Section headline above.
   - One large **horizontal feature card** on top.
   - Then **4 cards** that **sticky-stack on scroll** (ScrollTrigger pin — confirmed: the 4 row-cards are the stacking set).
   - Each of the 4: image + heading + description. **On hover**, a panel slides up over ~bottom half revealing extra info + **2 buttons** (primary + ghost).
   - Maps to product features (reuse feature copy from homepage `FEATURE_GROUPS`/`MOREFEATURES` as the source of truth; images `[TBD]`).

5. **Case studies** (`CaseStudyGrid.jsx`).
   - Asymmetric grid, 5 tiles: top row **70/30**, bottom row **30/30/30**.
   - `[IMGS + COPY TBD]` — placeholder tiles.

6. **Testimonials flip** (`TestimonialsFlip.jsx`) — replaces old `AboutTestimonials`.
   - Photo marquee scrolling **R→L**.
   - Default face: photo + name + title. **On hover: card flips** to reveal testimonial quote.
   - Data: reuse existing real `testimonials` (8 real hosts) from `aboutContent.js`.

7. **FAQ accordion** (`FaqAccordion.jsx`) — replaces old `AboutFaq`.
   - **Single-open** accordion: opening one closes any previously open item.
   - Data: reuse existing real `faq` (6 Q&A).

8. **Team masonry** (`TeamMasonry.jsx` + `TeamModal.jsx`).
   - People in a **masonry / irregular grid** (not uniform rows).
   - Click person → **modal**: left = image; right = short bio + **social links** + **2 buttons**: **"Book a session"** (primary) and **"Visit their page"** — both link to `meeticulous.com/:username`.
   - Data: extend `team.members` with `username`, `bio`, `socials[]` — `[PHOTOS/BIOS/USERNAMES TBD]`, current 3 placeholder members.

### Appended existing sections (kept, unchanged)

9. `ProblemSplit` · 10. `BeliefGrid` · 11. `BehindProduct` · 12. `StatStrip` · 13. `BuildFlow` · 14. `TrustGrid`

### Removed

- `AboutHero`, `AboutTestimonials`, `AboutFaq` components are **superseded** by sections 1/6/7 and removed from the page (delete or leave unused — delete to avoid dead code).

---

## 3. Files

**New** (`client/src/components/about/`):
- `HeroV2.jsx` — typewriter hero (GSAP timeline for type/erase loop).
- `LogoMarquee.jsx` — dual-row marquee, grayscale→color-on-hover.
- `JoinSplit.jsx` — 30/70 recruiting split.
- `StackingCards.jsx` — big card + 4 sticky-stacking cards w/ hover panel.
- `CaseStudyGrid.jsx` — 70/30 + 30/30/30 asymmetric grid.
- `TestimonialsFlip.jsx` — flip-card photo marquee.
- `FaqAccordion.jsx` — single-open accordion.
- `TeamMasonry.jsx`, `TeamModal.jsx` — masonry grid + person modal.

**Modified:**
- `About.jsx` — new section order; import new components; drop old hero/testimonials/faq imports.
- `aboutContent.js` — add `logos`, `join`, `stackCards`, `caseStudies`; extend `team.members` (username/bio/socials). Mark all TBD with `data-swap`.

**Deleted:**
- `AboutHero.jsx`, `AboutTestimonials.jsx`, `AboutFaq.jsx` (+ their tests `__tests__/AboutFaq.test.jsx`).

---

## 4. Motion details

| Effect | Implementation |
|---|---|
| Typewriter headline | GSAP timeline, char-by-char type + erase + loop; reduced-motion → static final word |
| Logo marquee | CSS keyframe / GSAP x-translate loop, duplicated track for seamless wrap |
| Sticky stacking cards | ScrollTrigger pin + per-card scale/translate as next card overlays |
| Card hover panel | CSS transform translateY on hover/focus-within; keyboard accessible |
| Testimonial flip | CSS 3D `rotateY` on hover/focus; flips back on leave |
| Team modal | Focus-trapped dialog, Esc to close, click-backdrop close |

All marquees + scrubbed scenes skipped/static under `prefers-reduced-motion`.

---

## 5. Data / placeholder plan

| Data | Source |
|---|---|
| Hero copy, sub | existing `hero` (typewriter applied to last word) |
| Testimonials | existing `testimonials` (8 real hosts) |
| FAQ | existing `faq` (6 Q&A) |
| Stacking-card copy | from homepage feature data |
| Logos | `[TBD]` placeholder chips |
| Join copy + image | `[TBD]` |
| Case studies | `[TBD]` placeholder tiles |
| Team photos/bios/usernames/socials | `[TBD]` (3 placeholder members; "Book a session"/"Visit their page" → `meeticulous.com/:username`) |

All `[TBD]` slots marked with `data-swap="…"` and discoverable via `grep -r 'data-swap' client/src/components/about`.

---

## 6. Testing & verification

- RTL render test per new component (mirror existing `client/src/components/about/__tests__/` pattern + `IntersectionObserver`/GSAP stubs already in test setup).
- FAQ: assert single-open behavior (opening B closes A).
- Team modal: opens on click, closes on Esc/backdrop, renders both buttons + correct `:username` links.
- `About.test.jsx` updated to new section set.
- Visual verification in preview (typewriter, marquees, sticky stack, flip, modal) at desktop + mobile widths.
- `cd client && npm test` + `npm run build` green before PR.

---

## 7. Open / deferred

- Real assets (logos, images, case studies, team photos/bios) supplied later via `data-swap` slots.
- Final join/recruiting copy + accent confirmation TBD.
- Two visual languages coexist (new motion-rich block + 6 calm appended sections) by user choice ("keep all, append"); revisit harmonizing later if desired.
