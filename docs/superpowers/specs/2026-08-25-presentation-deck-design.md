# Meeticulous — `/presentation` Interactive Deck — Design Spec

**Date:** 2026-08-25
**Branch:** `feat/presentation-deck`
**Route:** `https://meeticulous.com/presentation`

## Goal
A single shareable link that lets a potential client understand Meeticulous end-to-end
without a human explaining it: what it is, why it exists, how it works, what the customer
and the host each experience, why it's valuable, and how to start. It must feel like a
premium interactive product story in the existing Meeticulous brand — Google Slides +
Keynote + product demo — **not** a PowerPoint clone, not a long marketing webpage, and
**not** a new visual identity.

## Decisions (locked)
- **Content source:** Live product data. Fetch a real host + services from the API,
  default host **`/sndatarkar`**, with a curated static fallback if the fetch is slow/fails
  so an externally shared link never shows an empty/broken demo.
- **Interactive booking:** Full mini flow (service → date → time → confirm), **pure
  simulation** — no real booking row, no OTP, no Razorpay charge. Confetti + success screen only.
- **Category switcher (slide 08)** re-skins the demo host/service, feeding the slide-05 demo.

## Brand system (must reuse — from audit)
- Colors: primary `#FE5100`, `primary-cta #c23d00` (AA text), canvas `#faf9f6`/`#FFF8EE`,
  surface `#fff`, ink `#1a1a1a`, muted `#6b7280`, amber accent `#FFB703`, success `#4CAF50`.
  Accent hues `--c-blue/violet/cyan/emerald/amber/pink`. Public site is **light-only**.
- Type: Plus Jakarta Sans headings, Poppins body (self-hosted woff2, already preloaded).
  h1 `clamp(2.1rem,5vw,3.7rem)` w800; h2 `clamp(1.45rem,3vw,2.35rem)` w700.
- Shape: radius small — `rounded-md`=4px, `rounded-xl`=**6px** (scale is overridden, not TW default).
  Soft editorial card shadow `0 8px 30px rgba(23,32,51,0.05)`; brutalist hard shadow
  `6px 6px 0 rgba(30,30,30,0.9)` for accents. Borders 1px light on soft cards, up to 3px black on brutalist accents.
- Existing classes reusable anywhere: `.btn`, `.btn--outline`, `.btn-primary`, `.page-card`,
  `.fb-card`, `.fb-badge`, `.brand-glass`.
- Motion tokens `--motion-fast 120ms`, `--motion-base 180ms`. `prefers-reduced-motion`
  already killed globally — new work must inherit that.

## Dependencies
**None new.** framer-motion `^12`, gsap `^3.15` + `@gsap/react`, lenis, canvas-confetti are
all installed and in use.

## Storyline (10 slides — tightened from the 14 candidates)
Each slide answers one question. `key` is the deep-link hash.

| # | key | Slide | ONE thing | Primary source |
|---|-----|-------|-----------|----------------|
| 01 | `hook` | Hook | What it is | Hero copy `Home.jsx:816` "Your booking link that actually gets you paid" + brand mark |
| 02 | `problem` | The Problem | Today is fragmented | `PROBLEMS` `Home.jsx:507`, About `problem.rows` |
| 03 | `idea` | The Idea | A calmer system | About beliefs, "Made for India. Not adapted for it." |
| 04 | `how` | How It Works | 3-step flow | `components/home/HowItWorks.jsx` (Share link → book & pay → just show up) |
| 05 | `demo` | Interactive Demo ⭐ | Try it yourself | Booking markup lifted from `ServiceBooking.jsx` + live `/sndatarkar` data |
| 06 | `sides` | Two Sides | Beautiful both sides | `ProductMock` `Home.jsx:290`, guest `ServiceCard`, host dashboard mock; `Tabs` switch |
| 07 | `transform` | Before vs After | Dramatic transformation | `BenefitsComparison` / `PROBLEMS` pairs; toggle |
| 08 | `who` | Who It's For | It's for you | `businessCategories` (10) `howItWorksData.js:91`; chips re-skin demo |
| 09 | `pricing` | Pricing | Simple, keep your money | `PricingCards` + `plans.js` (Starter ₹0 / Host+ ₹229·₹1,499 / Studio ₹555·₹3,650) |
| 10 | `start` | Getting Started + CTA | Start now | `processSteps`, "Live in ~42 seconds", Continue with Google → `/become-a-host` |

Deliberately cut: standalone "business value", "product walkthrough", "customer/host
experience" as separate slides — folded into 06/07 so no slide restates another.

## Emotional arc
Recognition (02) → relief (03) → clarity (04) → **engagement** (05) → confidence (06–07)
→ self-identification (08) → trust (09) → momentum (10).

## Architecture

### New files (`client/src/pages/presentation/`)
- `Presentation.jsx` — deck engine. Calls `useHideChrome()`. Owns `current` slide index,
  renders `SlideShell` + active slide, deck chrome (progress dots, prev/next, fullscreen,
  share/copy-link, overview grid). Registers slide list from a single `SLIDES` array.
- `useDeckNav.js` — keyboard (←/→/space/Home/End/Esc/O), touch-swipe (framer drag threshold),
  and URL-hash sync (`#demo`). Deep-link: on mount, jump to hash slide; on nav, replace hash.
- `SlideShell.jsx` — responsive per-slide frame. Desktop centered canvas; mobile vertical
  stack with internal scroll when content overflows. Orchestrates `Reveal` stagger.
- `DeckControls.jsx` — quiet controls: bottom progress + arrows, top-right fullscreen +
  share, overview toggle. Becomes bottom bar on mobile.
- `SlideOverview.jsx` — grid of slide thumbnails (title + index), click to jump.
- `BookingDemo.jsx` — the interactive simulation. State machine `service → date → time →
  confirmed`. Calendar grid + slot grid + stepper + confirmation markup **copied** (not
  imported) from `ServiceBooking.jsx` (~902–1523), stripped of details/otp/payment. Confetti
  on confirm via `canvas-confetti`. Accepts a `host` prop so slide 08 can re-skin it.
- `demoData.js` — curated fallback host + 3 services + slot generator; and the category→demo
  mapping for slide 08.
- `slides/*.jsx` — one file per slide (10).
- `usePresentationHost.js` — fetches `/sndatarkar` profile+services via `services/api.js`;
  returns `{ host, services, loading, source: 'live'|'fallback' }`. Never throws; on error
  or timeout returns fallback. supabase-js never throws → check `error` (memory).

### Reused (import as-is)
`useHideChrome` (`context/ChromeContext.jsx`), `ServiceCard` (`components/guest/ServiceCard.jsx`),
`HostAvatar`/`HostCover` (`components/common/HostAvatar.jsx`), `PricingCards`/`PaidCard`
(`components/pricing/PricingCards.jsx`), `Button`+`buttonClasses` (`dashboard/ui/Button.jsx`),
`Badge`/`StatusBadge`/`StatusChip`, `Reveal` (`components/home/Reveal.jsx`), `Tabs`/
`SegmentedControl` (`dashboard/ui/*`), `Modal` (`booking/Modal.jsx`), `Odometer` (`Home.jsx:169`),
the brand mark.

### Routing (the safe-add checklist — both CI sync tests must pass)
1. `App.jsx`: lazy import + `<Route path="/presentation" element={<Presentation/>}/>` placed
   **before** the `/:profileSlug` catch-all.
2. `client/src/config/reservedSegments.js`: add `'presentation'` to `RESERVED_FIRST_SEGMENTS`.
3. Server reserved list (`server/utils/reservedUsernames.js` / `reservedSlugService.js`): add
   `presentation` so `server/tests/unit/reservedSegmentsSync.test.js` passes.
4. Verify: `client/src/__tests__/routeManifestSync.test.jsx` + the server sync test.

## Data flow
`Presentation` mounts → `usePresentationHost()` kicks off live fetch (fallback ready
immediately, so first paint is never blank) → `host`/`services` passed down to `BookingDemo`
(slide 05) and `ServiceCard` (slide 06). Slide 08 category chips set a local `demoCategory`
that maps (via `demoData.js`) to which service/host persona the demo shows — purely client-side.

## Responsive behaviour
- **One slide per view on all breakpoints.** Horizontal swipe/keys change slide; vertical
  scroll only inside a slide that overflows (mobile).
- Every horizontal desktop composition (`Text | UI | Illustration`) has an explicit mobile
  vertical order (`Text ↓ UI ↓ Illustration`) authored per slide — not a scaled-down desktop.
- Touch targets ≥44px, body ≥15px on mobile, controls become a bottom bar. Tested at 375px,
  768px, 1280px, and large desktop.

## Animation
`AnimatePresence` slide morph (fade/slide/scale, direction-aware); staggered `Reveal`
entrances within a slide; `Odometer` for stats. All gated by `prefers-reduced-motion`
(instant, no transform). Motion never blocks input — the demo is always tappable.

## Error handling
- Live fetch: timeout ~2.5s → fallback; any API error → fallback; `source` surfaced for a
  tiny "sample data" note if fallback used.
- Booking demo is stateless/simulated — no external calls, can't fail a client.
- Deep-link to unknown hash → slide 01.

## Performance
Route lazy-loaded (existing `lazyWithRetry` pattern); heavy slides (demo, pricing) lazy;
images `loading="lazy"` + existing CDN assets; fonts already self-hosted/preloaded. No new
deps → no bundle growth from libraries. Target: fast first paint on mobile networks.

## Accessibility
Semantic landmarks, slide `aria-roledescription="slide"` + live-region announcing
"Slide N of 10: <title>", focus management on slide change, keyboard nav, visible focus
(existing `focus-visible` ring), reduced-motion, AA contrast (use `primary-cta` for text CTAs).

## Testing
- Route sync: the two existing CI tests pass.
- `BookingDemo` state machine: one Vitest test — service→date→time→confirmed advances and
  confirm never calls the API (simulation guarantee).
- `usePresentationHost` fallback: returns fallback (never throws) on rejected fetch.
- Build: `cd client && npx vitest run` + `npm run build` green before PR (Vercel gates on vitest).

## Out of scope
Real booking/payment, auth, analytics events beyond existing harmless `logExploreClick`,
server changes other than the one-line reserved-username add, video assets, i18n.

## Definition of done
`/presentation` loads full-screen, tells the 10-slide story, the booking demo works and
re-skins by category, works beautifully at 375px and desktop, honors reduced-motion, both
sync tests + the new unit tests + build pass, PR opened (not merged).
