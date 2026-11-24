# Mobile APP UI Design

How to make any section **feel like a native app on a phone**, not a shrunk-down
web page. This is a look-and-interaction guide — **CSS/JS only, never logic**.
Same data, same routes, same handlers: we only change layout, type, depth,
motion and touch behaviour at mobile width.

> Scope: applies below the `lg` breakpoint (<1024px). Desktop keeps its own
> layout (see the device-split pattern at the end). Everything here uses the
> brand tokens in `styles.css` / `client/src/styles/brand.css` — never a raw hex,
> font, radius or shadow. Read `BRAND_RULES.md` first; this doc does not override it.

---

## 0. The one test

Before shipping a mobile section, ask: **"If I saw this with no browser chrome,
would I think it was a native app screen?"** If it reads as a responsive website
(top nav bar, hover menus, dense table, tiny text, desktop grid squeezed thin),
it fails. The rules below are how it passes.

---

## 1. Principles (the difference between app and website)

| Website habit | App habit (do this) |
|---|---|
| Top nav / hamburger as primary | **Fixed bottom tab bar**, thumb-reachable |
| Hover menus, dropdowns | **Bottom sheets** that slide up |
| Dense tables, many columns | **Stacked cards / list rows**, one thing per row |
| Small body text (12–14) | **Bigger type**; headings 20–32, numbers hero-sized |
| Equal-weight grids | **One focal thing per screen** (a balance, a CTA, a hero) |
| Visible scrollbars | **Hidden scrollbars** + fade / peek affordance |
| Everything on one scroll | **Horizontal carousels** with snap + peek |
| Click, instant | **Press states** (scale/opacity), spring transitions |
| Content to the pixel edge | **16px side gutter**, safe-area insets |
| Buttons mid-page | **Primary CTA full-width, pinned at bottom** |
| Reload to update | **Pull-to-refresh**, skeletons not spinners |

**Golden rules**
1. Primary actions live in the **bottom third** (thumb zone).
2. **One accent, lots of calm** — generous whitespace, one focal element.
3. **Everything rounded**, soft depth only where it means elevation.
4. **No hover dependence** — every hover has a touch/press equivalent.
5. **Momentum + snap** scrolling; nothing janky.
6. **Respect the hardware** — notch and home-indicator safe areas.

---

## 2. Layout skeleton

```
┌─────────────────────────────┐
│ status bar (OS)             │
│ ┌───── sticky header ─────┐ │  ← back/title/actions, collapses on scroll
│ scrollable content          │  ← 16px gutters, cards, carousels
│   • hero / big number       │
│   • quick actions (circles) │
│   • horizontal carousel     │
│   • list rows               │
│ ┌──── pinned CTA (opt) ───┐ │  ← full-width pill, above tab bar
│ ┌────── bottom tab bar ───┐ │  ← fixed, 5 items, optional center FAB
│ home indicator (OS)         │
└─────────────────────────────┘
```

- **Side gutter:** 16px (`px-4`). Cards go edge-to-edge within that.
- **Vertical rhythm:** sections separated by 20–24px (`gap-5`/`gap-6`), not hairlines.
- **Page bg:** `--mt-cream`. Cards sit on it as flat fills, not bordered boxes everywhere.

---

## 3. Pattern library

Each pattern: what it is · when · recipe (our stack) · native cue.

### 3.1 Bottom tab bar (+ optional center action)
Fixed nav, 4–5 destinations, icon over label, current tab in `--mt-maroon`. A
raised center circle (FAB) for the one primary create/scan action.

```jsx
<nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around
  border-t-2 border-neutral-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
  {items.map(t => (
    <button key={t.key} className="flex flex-1 flex-col items-center gap-0.5 py-1">
      <t.icon className={cn('h-5 w-5', active ? 'text-maroon' : 'text-ink/45')} strokeWidth={2.2}/>
      <span className={cn('text-[10px] font-semibold', active ? 'text-maroon' : 'text-ink/45')}>{t.label}</span>
    </button>
  ))}
</nav>
```
Native cue: it never scrolls away; labels are tiny; the active item is colour +
a dot. We already ship this in host-lab.

### 3.2 Sticky / collapsing header
Back arrow · title · 1–2 trailing icon actions. Sticky; may shrink the title on
scroll. No desktop nav row.

```jsx
<header className="sticky top-0 z-30 flex items-center gap-2 bg-cream/90 px-4 py-2 backdrop-blur">
  <button aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full"><ChevronLeft/></button>
  <h1 className="flex-1 truncate font-display text-[18px] font-extrabold text-maroon">Title</h1>
  <button className="grid h-9 w-9 place-items-center rounded-full"><Icon/></button>
</header>
```

### 3.3 Hero / big-number block
The screen opens on ONE thing: a balance, "ready to withdraw", a welcome. Oversized
display number, everything else recedes.

```jsx
<section className="rounded-2xl bg-maroon p-4 text-white">
  <p className="text-[11px] font-semibold text-white/70">Ready to withdraw</p>
  <p className="mt-1 font-display text-[34px] font-extrabold leading-none tracking-[-0.04em]">₹38,400</p>
</section>
```
Native cue: number is the biggest thing on screen. Don't surround it with four
equal tiles.

### 3.4 Quick-action circles
Row of 3–5 circular icon buttons with a label under each — the "what do I do
here" shortcuts. First may be filled accent, rest tinted.

```jsx
<div className="dash-noscrollbar flex gap-3 overflow-x-auto">
  {actions.map(a => (
    <button className="flex w-[74px] shrink-0 flex-col items-center gap-1.5">
      <span className={cn('grid h-14 w-14 place-items-center rounded-full',
        a.primary ? 'bg-maroon text-white' : 'bg-blush text-maroon')}><a.icon className="h-5 w-5"/></span>
      <span className="text-center text-[10.5px] font-semibold text-ink/70">{a.label}</span>
    </button>
  ))}
</div>
```
(Shipped on host-lab Today.)

### 3.5 Horizontal carousel with peek + snap
The signature app move: a row that scrolls sideways, snaps to each card, and shows
a **sliver of the next card** so you know to swipe. Hidden scrollbar; fade the
right edge when there are no arrows.

```jsx
<div className="dash-noscrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto"
     style={{ maskImage:'linear-gradient(to right,#000 86%,transparent)',
              WebkitMaskImage:'linear-gradient(to right,#000 86%,transparent)' }}>
  {cards.map(c => <article key={c.id} className="w-[78%] shrink-0 snap-start rounded-2xl …">…</article>)}
</div>
```
- Card width `72–82%` so the next one peeks.
- `snap-mandatory` + `snap-start`.
- `.dash-noscrollbar` (already in tokens.css) hides the track.
- Fade OR flanking circular arrows — not a raw scrollbar. (Both shipped.)

### 3.6 Category / bento grid
2×4 or varied-size tiles: icon over label, tap to drill in. Keep tiles square-ish,
rounded, flat-filled.

```jsx
<div className="grid grid-cols-4 gap-2">
  {cats.map(c => (
    <button className="flex flex-col items-center gap-1.5 rounded-xl bg-white p-3">
      <c.icon className="h-6 w-6 text-maroon"/><span className="text-[10.5px] font-semibold">{c.label}</span>
    </button>
  ))}
</div>
```

### 3.7 List rows (the table replacement)
One record per row: leading avatar/icon · title + subtitle · trailing value/chip.
Full-width tap target, 2px divider, no columns.

```jsx
<button className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-blush">
  <Avatar name={r.name}/>
  <span className="min-w-0 flex-1">
    <span className="block truncate text-[13px] font-bold text-ink">{r.title}</span>
    <span className="block truncate text-[11px] text-ink/55">{r.subtitle}</span>
  </span>
  <span className="shrink-0 text-right text-[12px] font-bold text-maroon">{r.value}</span>
</button>
```
A desktop data table (`<table>`, many columns) becomes this below `lg`.

### 3.8 Segmented control / pill tabs
Switch views without a dropdown: a pill group (filled active segment) or an
underline tab row. Scroll horizontally if they overflow.

```jsx
<div className="flex rounded-full border-2 border-neutral-200 bg-white p-0.5">
  {opts.map(o => (
    <button className={cn('flex-1 rounded-full py-1 text-[11.5px] font-bold',
      on ? 'bg-maroon text-white' : 'text-ink/55')}>{o.label}</button>
  ))}
</div>
```
(Shipped: host-lab Bookings List/Week/Month.)

### 3.9 Bottom sheet (replaces dropdown & modal)
Filters, pickers, detail, confirm — everything that would be a dropdown/modal on
web slides up from the bottom with a grabber handle. Backdrop dims; swipe/tap to
dismiss.

- Use the existing `Drawer` primitive, but on mobile anchor it to the **bottom**
  with a top radius + grabber:
```jsx
<div className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)]">
  <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-neutral-300"/> {/* grabber */}
  …
</div>
```
Native cue: content comes from the **bottom**, not the center. Filters as a sheet
is shipped on host-lab Bookings.

### 3.10 Pinned primary CTA
The main action (Confirm, Book, Pay, Add) is a **full-width pill**, fixed just
above the tab bar, always reachable. One per screen.

```jsx
<div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] px-4">
  <button className="w-full rounded-full bg-maroon py-3.5 text-[14px] font-bold text-white
    active:translate-y-px">Confirm</button>
</div>
```

### 3.11 Hero image card
Full-bleed photo, overlay title at the bottom, a heart/save top-right, rounded
corners. Used for featured items.

### 3.12 Accordion / expandable rows
Itineraries, FAQs, day-by-day: a row that expands in place with a chevron. Avoid
separate pages for small detail.

### 3.13 Stat tiles (2-col)
When you must show numbers, a 2-col grid of rounded tiles, each one number + a tiny
ring/sparkline — never a multi-series chart, never a pie (see BRAND_RULES: single
hue, no five-colour charts).

### 3.14 Chips & badges
Status, counts, "9d left", "22k saves" — pill chips, colour carries a word (reuse
`StatusPill`). Save/like = heart toggle.

### 3.15 Banner carousel + dot pager
Promo strip that auto-advances with dot indicators. Dots: filled = current.

---

## 4. Type & number scale (mobile)

Bigger than web. Suggested:

| Role | Size | Token |
|---|---|---|
| Hero number | 30–40px | `font-display` 800 |
| Screen title | 18–22px | `font-display` 800, maroon |
| Section heading | 13–15px | `font-display` 700 |
| Card title | 12–13px | `font-sans` 700 |
| Body / subtitle | 11–12px | `font-sans` 500, ink/55 |
| Caption / label | 10–10.5px | `font-sans` 600 |

Numbers are the hero — a balance/price is the biggest glyph on its card.

---

## 5. Shape, depth, colour

- **Radius:** inputs 16 · slots 20 · cards 24 · dialogs/sheets 32 · pills full.
  Nothing square-cornered (brand scale).
- **Depth:** flat fills by default. Shadow ONLY for things that float above the
  page — sheets, the tab bar edge, a pressed card lift. No decorative shadows.
- **Colour:** one accent (`--mt-maroon`) + calm grounds (`cream`, `blush`, white).
  Proportion per BRAND_RULES. Marigold only for open slots. No gradients/blur/3D
  unless a reference asset is explicitly approved (e.g. the glance sprite).

---

## 6. Motion & interaction (the "feel")

- **Press feedback on everything tappable:** `active:scale-[0.97]` or
  `active:translate-y-px` + slight opacity. 90–120ms.
- **Navigation:** screens slide/push in (`translateX`), sheets slide up, 200–260ms,
  brand easing `[0.22,0.61,0.36,1]`, no bounce. Respect `prefers-reduced-motion`.
- **Snap scrolling** on every horizontal row (`snap-x snap-mandatory`).
- **Pull-to-refresh** on main lists (CSS overscroll + a JS threshold handler, or a
  lib) — no reload button.
- **Skeletons, not spinners** for loading (grey rounded placeholders matching the
  final layout).
- **Tap targets ≥ 44×44px** even if the visual is smaller (pad the hit area).
- **Sticky headers** shrink on scroll; **tab bar** stays put.
- **Overscroll:** `overscroll-behavior-y: contain` on scroll containers so the
  page doesn't bounce the whole app.

---

## 7. Hardware / platform

- **Safe areas:** pad with `env(safe-area-inset-top/bottom)` on the header and tab
  bar / pinned CTA. Add `viewport-fit=cover` to the viewport meta.
- **No hover-only UI:** menus open on tap; tooltips become inline or a sheet.
- **Inputs:** use native controls (`type="date"`, `type="tel"`, `inputmode`) so the
  OS keyboard/picker appears — don't rebuild pickers.
- **Scroll:** `-webkit-overflow-scrolling: touch`; hide bars with `.dash-noscrollbar`.
- **100vh trap:** use `100dvh` (dynamic viewport) so content isn't hidden under the
  mobile URL bar.

---

## 8. Anti-patterns (reads as "website on a phone")

- ❌ Top navigation bar / hamburger as the main nav.
- ❌ Multi-column data table squeezed to phone width.
- ❌ Hover menus, right-click, desktop dropdowns.
- ❌ Visible scrollbars on carousels.
- ❌ Tiny 11–12px everything with no focal hierarchy.
- ❌ Equal-weight 4-tile grids where nothing is the hero.
- ❌ Center-screen modals for pickers (use bottom sheets).
- ❌ Primary button floating mid-page instead of pinned bottom.
- ❌ Fixed px widths; content not reaching the gutter.
- ❌ Five-colour charts / pies / 3D decoration (brand rule).
- ❌ Ignoring the notch / home indicator.

---

## 9. Per-section checklist

Before a mobile section is "app-like":

- [ ] Opens on one focal element (hero/number/CTA), not a grid of equals
- [ ] Primary action is reachable by thumb (bottom third / pinned)
- [ ] Any horizontal row snaps, peeks the next item, hides its scrollbar
- [ ] Lists are rows (not tables); each row is a full-width tap target
- [ ] Pickers/filters/detail open as **bottom sheets**, not dropdowns/modals
- [ ] Every tappable thing has a press state; tap targets ≥ 44px
- [ ] Type is scaled up; the key number is the biggest glyph
- [ ] All corners rounded; depth only on floating things
- [ ] One accent, calm grounds, brand proportion
- [ ] Safe-area padding on header + bottom bars; `100dvh` not `100vh`
- [ ] Works with no hover; reduced-motion respected
- [ ] Only CSS/JS changed — data, routes and handlers untouched

---

## 10. How we apply it here (device-split)

Mobile gets this app treatment; desktop keeps the current prod layout. Each page
renders both, gated by breakpoint — only one is in the DOM-visible tree per width:

```jsx
const Page = (props) => (
  <>
    <div className="lg:hidden"><PageMobile {...props}/></div>      {/* app UI, this doc */}
    <div className="hidden lg:block"><PageDesktop {...props}/></div>{/* current prod */}
  </>
);
```

Shipped examples in `client/src/pages/hostlab/sections/`:
`Today.mobile.jsx`, `Bookings.mobile.jsx` (app UI) + `*.desktop.jsx` (prod) +
thin `Today.jsx` / `Bookings.jsx` wrappers. Reusable bits already in the codebase:
`.dash-noscrollbar` (tokens.css), the right-edge fade mask, the bottom tab bar,
the arrow-nav date strip, the Filters bottom sheet, the segmented switch, image
tiles.

Build order for a new mobile section: pick the patterns from §3, lay out per §2,
scale type per §4, add motion per §6, run the §9 checklist. **No logic changes —
ever.**
