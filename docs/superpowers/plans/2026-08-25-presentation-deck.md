# Meeticulous `/presentation` Interactive Deck — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a full-screen, shareable `/presentation` deck that tells the Meeticulous story in 10 slides, with a live-data interactive booking simulation as its centerpiece.

**Architecture:** One lazy-loaded route `pages/presentation/Presentation.jsx` that calls `useHideChrome()` for a bare canvas. A `SLIDES` registry drives a paged deck (one slide per view, all breakpoints); `useDeckNav` handles keyboard/swipe/hash deep-linking; `usePresentationHost` fetches host `/sndatarkar` with a curated fallback; `BookingDemo` is a client-only simulation. Reuses existing brand components; adds zero dependencies.

**Tech Stack:** React 18 + Vite, react-router-dom v6, Tailwind (overridden radius scale), framer-motion `^12`, canvas-confetti `^1.9` (all already installed).

## Global Constraints

- **No new npm dependencies.** framer-motion, gsap, @gsap/react, lenis, canvas-confetti already installed.
- **Brand tokens only:** primary `#FE5100`, text-CTA `#c23d00`, canvas `#faf9f6`, ink `#1a1a1a`, muted `#6b7280`, amber `#FFB703`, success `#4CAF50`. Plus Jakarta Sans headings, Poppins body. Radius `rounded-md`=4px / `rounded-xl`=6px (scale is overridden — do not assume TW defaults). Reuse `.btn`, `.btn--outline`, `.page-card`, `Reveal`, `ServiceCard`, `HostAvatar`, `PricingCards`, `Button`, `Badge`. Public site is **light-only** — no dark-mode variants.
- **Booking demo is pure simulation** — no booking API call, no OTP, no Razorpay, no DB write. A test enforces this.
- **Reserved-list sync:** any top-level route MUST appear in `client/src/config/reservedSegments.js` AND server `server/config/reservedNamespaces.js`. Two CI tests enforce it.
- **Respect `prefers-reduced-motion`** (repo already kills animations globally; new motion must inherit).
- **Gates before PR:** `cd client && npx vitest run` green (Vercel deploy gates on vitest) and `npm run build` green.
- **Stop at PR. Do NOT merge.** Do NOT stage the pre-existing modified files (`server/routes/authRoutes.js`, `server/routes/hostRoutes.js`, `server/middleware/gone.js`) — they belong to another session.

---

## File Structure

```
client/src/pages/presentation/
  Presentation.jsx          # route entry: useHideChrome, host fetch, deck state, renders shell
  Deck.jsx                  # paged canvas + AnimatePresence transitions
  DeckControls.jsx          # progress dots, prev/next, fullscreen, share, overview toggle
  SlideShell.jsx            # per-slide responsive frame (desktop centered / mobile stack)
  SlideOverview.jsx         # grid of slide thumbnails, click-to-jump
  useDeckNav.js             # keyboard + swipe + URL-hash sync; returns {index, go, next, prev, ...}
  usePresentationHost.js    # live /sndatarkar fetch + curated fallback; never throws
  demoData.js               # fallback host+services, category→demo map, slot generator
  BookingDemo.jsx           # service→date→time→confirmed simulation + confetti
  slides/
    index.js                # SLIDES registry (order, key, title, lazy component)
    S01Hook.jsx  S02Problem.jsx  S03Idea.jsx  S04How.jsx  S05Demo.jsx
    S06Sides.jsx S07Transform.jsx S08Who.jsx  S09Pricing.jsx S10Start.jsx
  __tests__/
    usePresentationHost.test.jsx
    BookingDemo.test.jsx
    deckNav.test.js
client/src/config/reservedSegments.js   # MODIFY: add 'presentation'
client/src/App.jsx                       # MODIFY: lazy route before /:profileSlug
server/config/reservedNamespaces.js      # MODIFY: add 'presentation' to FUTURE
```

Each slide file has one responsibility (one story beat). Engine files are split by concern (nav vs data vs chrome) so each stays small and independently testable.

---

### Task 1: Route + reserved lists + full-screen shell

Wire the route safely and render a bare full-screen page. Deliverable: `/presentation` loads with no navbar/footer and both sync tests pass.

**Files:**
- Create: `client/src/pages/presentation/Presentation.jsx`
- Modify: `client/src/config/reservedSegments.js` (line 21 area)
- Modify: `server/config/reservedNamespaces.js` (FUTURE array, ~line 37)
- Modify: `client/src/App.jsx` (add lazy import + Route before `/:profileSlug`)

**Interfaces:**
- Produces: default export `Presentation` (React component). Route `/presentation`.

- [ ] **Step 1: Add `presentation` to both reserved lists**

In `client/src/config/reservedSegments.js`, add to the array (e.g. after `'search', 'wall-of-love', 'moments', 'opening', 'inaugurators',` on line 21):
```js
  'presentation', // full-screen product pitch deck (pages/presentation/)
```
In `server/config/reservedNamespaces.js`, add `'presentation'` to the `FUTURE` array (line 37 block):
```js
  'presentation',
```

- [ ] **Step 2: Run the sync tests, expect PASS**

```bash
cd client && npx vitest run src/__tests__/routeManifestSync.test.jsx
cd ../server && npx jest tests/unit/reservedSegmentsSync.test.js
```
Expected: both PASS. (routeManifestSync also asserts every Route segment is listed — it stays green because the Route is added next and `presentation` is now reserved.)

- [ ] **Step 3: Create the minimal full-screen page**

`client/src/pages/presentation/Presentation.jsx`:
```jsx
import { useHideChrome } from '../../context/ChromeContext';

export default function Presentation() {
  useHideChrome(); // drops navbar, footer, consent banner, bot — bare canvas
  return (
    <main
      className="fixed inset-0 overflow-hidden bg-canvas text-ink"
      style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
    >
      <div className="h-full w-full grid place-items-center">
        <h1 className="font-heading text-4xl">Presentation</h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Register the lazy route in `App.jsx`**

Near the other `lazy(() => import(...))` declarations add:
```jsx
const Presentation = lazy(() => import('./pages/presentation/Presentation'));
```
In the `<Routes>` block, **before** the `/:profileSlug` catch-all route, add:
```jsx
<Route path="/presentation" element={<Presentation />} />
```

- [ ] **Step 5: Verify in browser**

Start the client dev server via preview_start (name it in `.claude/launch.json` if absent: runtimeExecutable `npm`, runtimeArgs `["run","dev"]`, port `5173`, cwd client). Navigate to `/presentation`. Confirm: no global navbar/footer, "Presentation" centered, canvas background `#faf9f6`. Check `read_console_messages` for errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/presentation/Presentation.jsx client/src/config/reservedSegments.js server/config/reservedNamespaces.js client/src/App.jsx
git commit -m "feat(presentation): full-screen route + reserved-list sync"
```

---

### Task 2: Demo data + live host hook

Curated fallback and a never-throws live fetch of `/sndatarkar`. Deliverable: `usePresentationHost` returns live data or fallback, tested.

**Files:**
- Create: `client/src/pages/presentation/demoData.js`
- Create: `client/src/pages/presentation/usePresentationHost.js`
- Test: `client/src/pages/presentation/__tests__/usePresentationHost.test.jsx`

**Interfaces:**
- Produces:
  - `demoData.js`: `export const FALLBACK_HOST` = `{ username, name, tagline, profile_image, cover_image, accent_color, services: Service[] }`; `Service` = `{ id, title, slug, short_description, price, duration, meeting_mode }`. `export const CATEGORY_DEMOS` = array of `{ key, label, icon, host }` (each `host` same shape as FALLBACK_HOST). `export function genSlots(dateISO): string[]` (HH:mm 24h).
  - `usePresentationHost.js`: `export function usePresentationHost(): { host, services, loading, source: 'live'|'fallback' }` (default host = FALLBACK_HOST until live resolves; `services` = `host.services`).

- [ ] **Step 1: Write `demoData.js`**

```js
// Curated fallback so an externally shared link never shows an empty demo.
// Category personas re-skin the booking demo on slide 08.
export const FALLBACK_HOST = {
  username: 'slothstudio',
  name: 'Sloth Studio',
  tagline: 'Calm sessions, booked in seconds.',
  profile_image: '', // HostAvatar renders initials fallback on themeColor
  cover_image: '',   // HostCover renders theme gradient
  accent_color: '#FE5100',
  services: [
    { id: 'd1', title: 'Discovery Call', slug: 'discovery-call', short_description: '20 min to see if we click.', price: 0, duration: 20, meeting_mode: 'online' },
    { id: 'd2', title: 'Strategy Session', slug: 'strategy-session', short_description: 'A focused hour on your goals.', price: 1500, duration: 60, meeting_mode: 'online' },
    { id: 'd3', title: 'Deep Dive', slug: 'deep-dive', short_description: 'Half-day intensive.', price: 4000, duration: 180, meeting_mode: 'in_person' },
  ],
};

export const CATEGORY_DEMOS = [
  { key: 'coach', label: 'Coaches', icon: '🎯', host: { ...FALLBACK_HOST, name: 'Aarav Coaching', accent_color: '#269CEF',
    services: [{ id: 'c1', title: 'Clarity Call', slug: 'clarity-call', short_description: 'Reset your week.', price: 0, duration: 30, meeting_mode: 'online' },
               { id: 'c2', title: 'Coaching Hour', slug: 'coaching-hour', short_description: '1:1 deep work.', price: 2000, duration: 60, meeting_mode: 'online' }] } },
  { key: 'therapist', label: 'Therapists', icon: '🧠', host: { ...FALLBACK_HOST, name: 'Meera Wellness', accent_color: '#7c3aed',
    services: [{ id: 't1', title: 'First Consultation', slug: 'first-consult', short_description: 'A gentle start.', price: 800, duration: 45, meeting_mode: 'online' },
               { id: 't2', title: 'Therapy Session', slug: 'therapy-session', short_description: 'Weekly support.', price: 1500, duration: 50, meeting_mode: 'online' }] } },
  { key: 'salon', label: 'Salons & Spas', icon: '💇', host: { ...FALLBACK_HOST, name: 'Bloom Studio', accent_color: '#db2777',
    services: [{ id: 's1', title: 'Haircut & Style', slug: 'haircut', short_description: 'Fresh look.', price: 600, duration: 45, meeting_mode: 'in_person' },
               { id: 's2', title: 'Spa Ritual', slug: 'spa-ritual', short_description: 'Full reset.', price: 2500, duration: 90, meeting_mode: 'in_person' }] } },
  { key: 'tutor', label: 'Tutors', icon: '📚', host: { ...FALLBACK_HOST, name: 'Ravi Tutoring', accent_color: '#059669',
    services: [{ id: 'e1', title: 'Trial Class', slug: 'trial-class', short_description: 'See the method.', price: 0, duration: 30, meeting_mode: 'online' },
               { id: 'e2', title: 'IELTS Session', slug: 'ielts-session', short_description: 'Band-boost hour.', price: 1200, duration: 60, meeting_mode: 'online' }] } },
];

// Deterministic-ish open slots for a given date; skips past times if date is today.
export function genSlots(dateISO) {
  const base = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00', '18:30'];
  const today = new Date().toISOString().slice(0, 10);
  if (dateISO !== today) return base;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  return base.filter((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m > nowMin + 30; });
}
```

- [ ] **Step 2: Write the failing test for the hook**

`client/src/pages/presentation/__tests__/usePresentationHost.test.jsx`:
```jsx
import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePresentationHost } from '../usePresentationHost';
import { FALLBACK_HOST } from '../demoData';

vi.mock('../../../services/api', () => ({ getHostProfile: vi.fn() }));
import { getHostProfile } from '../../../services/api';

describe('usePresentationHost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with fallback host synchronously', () => {
    getHostProfile.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => usePresentationHost());
    expect(result.current.host.name).toBe(FALLBACK_HOST.name);
    expect(result.current.source).toBe('fallback');
  });

  it('swaps to live data on success', async () => {
    getHostProfile.mockResolvedValue({ data: { username: 'sndatarkar', name: 'S N Datarkar', profile_image: 'x', cover_image: 'y', services: [{ id: '1', title: 'Consult', slug: 'consult', price: 500, duration: 30, meeting_mode: 'online' }] } });
    const { result } = renderHook(() => usePresentationHost());
    await waitFor(() => expect(result.current.source).toBe('live'));
    expect(result.current.host.name).toBe('S N Datarkar');
    expect(result.current.services).toHaveLength(1);
  });

  it('stays on fallback when the fetch rejects', async () => {
    getHostProfile.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePresentationHost());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.source).toBe('fallback');
    expect(result.current.host.name).toBe(FALLBACK_HOST.name);
  });
});
```

- [ ] **Step 3: Run it, expect FAIL**

```bash
cd client && npx vitest run src/pages/presentation/__tests__/usePresentationHost.test.jsx
```
Expected: FAIL (module `../usePresentationHost` not found).

- [ ] **Step 4: Implement the hook**

`client/src/pages/presentation/usePresentationHost.js`:
```js
import { useEffect, useRef, useState } from 'react';
import { getHostProfile } from '../../services/api';
import { FALLBACK_HOST } from './demoData';

const DEFAULT_USERNAME = 'sndatarkar';
const TIMEOUT_MS = 2500;

// Never throws. First render returns FALLBACK_HOST so paint is never blank;
// swaps to live data only if the fetch succeeds with usable services.
export function usePresentationHost(username = DEFAULT_USERNAME) {
  const [state, setState] = useState({ host: FALLBACK_HOST, loading: true, source: 'fallback' });
  const done = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => { if (!done.current) { done.current = true; setState((s) => ({ ...s, loading: false })); } }, TIMEOUT_MS);
    getHostProfile(username)
      .then(({ data }) => {
        if (done.current) return;
        const services = Array.isArray(data?.services) ? data.services : [];
        if (!data || services.length === 0) return; // keep fallback
        done.current = true;
        setState({ host: { ...data, services }, loading: false, source: 'live' });
      })
      .catch(() => {}) // swallow: fallback stays
      .finally(() => { if (!done.current) { done.current = true; setState((s) => ({ ...s, loading: false })); } clearTimeout(timer); });
    return () => clearTimeout(timer);
  }, [username]);

  return { host: state.host, services: state.host.services || [], loading: state.loading, source: state.source };
}
```

- [ ] **Step 5: Run tests, expect PASS**

```bash
cd client && npx vitest run src/pages/presentation/__tests__/usePresentationHost.test.jsx
```
Expected: all 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/presentation/demoData.js client/src/pages/presentation/usePresentationHost.js client/src/pages/presentation/__tests__/usePresentationHost.test.jsx
git commit -m "feat(presentation): curated demo data + never-throw live host hook"
```

---

### Task 3: Deck navigation hook

Keyboard + swipe + URL-hash deep-linking. Deliverable: pure index/hash logic unit-tested.

**Files:**
- Create: `client/src/pages/presentation/useDeckNav.js`
- Test: `client/src/pages/presentation/__tests__/deckNav.test.js`

**Interfaces:**
- Consumes: `slides` array `[{ key }]` (from Task 6 registry; test uses a stub).
- Produces:
  - `export function keyToIndex(slides, key): number` (-1 if missing).
  - `export function clampIndex(n, len): number`.
  - `export function useDeckNav(slides): { index, next, prev, go(i), goKey(key) }` — binds keydown (ArrowRight/Space/ArrowDown → next; ArrowLeft/ArrowUp → prev; Home/End; digit not required), reads/writes `location.hash`.

- [ ] **Step 1: Write failing test for pure helpers**

`client/src/pages/presentation/__tests__/deckNav.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { keyToIndex, clampIndex } from '../useDeckNav';

const slides = [{ key: 'hook' }, { key: 'demo' }, { key: 'start' }];

describe('deck nav helpers', () => {
  it('maps hash key to index', () => {
    expect(keyToIndex(slides, 'demo')).toBe(1);
    expect(keyToIndex(slides, 'nope')).toBe(-1);
  });
  it('clamps out-of-range indices', () => {
    expect(clampIndex(-3, 3)).toBe(0);
    expect(clampIndex(9, 3)).toBe(2);
    expect(clampIndex(1, 3)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `cd client && npx vitest run src/pages/presentation/__tests__/deckNav.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement `useDeckNav.js`**

```js
import { useCallback, useEffect, useState } from 'react';

export function keyToIndex(slides, key) { return slides.findIndex((s) => s.key === key); }
export function clampIndex(n, len) { return Math.max(0, Math.min(len - 1, n)); }

export function useDeckNav(slides) {
  const initial = () => {
    const key = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '');
    const i = keyToIndex(slides, key);
    return i >= 0 ? i : 0;
  };
  const [index, setIndex] = useState(initial);

  const go = useCallback((i) => {
    const clamped = clampIndex(i, slides.length);
    setIndex(clamped);
    const key = slides[clamped]?.key;
    if (key && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${key}`);
    }
  }, [slides]);

  const next = useCallback(() => setIndex((i) => { const n = clampIndex(i + 1, slides.length); const k = slides[n]?.key; if (k) window.history.replaceState(null, '', `#${k}`); return n; }), [slides]);
  const prev = useCallback(() => setIndex((i) => { const n = clampIndex(i - 1, slides.length); const k = slides[n]?.key; if (k) window.history.replaceState(null, '', `#${k}`); return n; }), [slides]);
  const goKey = useCallback((key) => { const i = keyToIndex(slides, key); if (i >= 0) go(i); }, [slides, go]);

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', ' ', 'Spacebar', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
    };
    window.addEventListener('keydown', onKey);
    const onHash = () => { const i = keyToIndex(slides, window.location.hash.replace('#', '')); if (i >= 0) setIndex(i); };
    window.addEventListener('hashchange', onHash);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('hashchange', onHash); };
  }, [next, prev, go, slides]);

  return { index, next, prev, go, goKey };
}
```

- [ ] **Step 4: Run test, expect PASS** — `cd client && npx vitest run src/pages/presentation/__tests__/deckNav.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/presentation/useDeckNav.js client/src/pages/presentation/__tests__/deckNav.test.js
git commit -m "feat(presentation): deck nav (keyboard, hash deep-link, helpers)"
```

---

### Task 4: Deck shell, controls, overview, SlideShell

The paged canvas + quiet controls. Deliverable: navigable deck with placeholder slides, verified in browser at desktop + mobile.

**Files:**
- Create: `client/src/pages/presentation/Deck.jsx`, `DeckControls.jsx`, `SlideShell.jsx`, `SlideOverview.jsx`, `slides/index.js`
- Modify: `client/src/pages/presentation/Presentation.jsx`

**Interfaces:**
- Consumes: `useDeckNav`, `usePresentationHost`, `SLIDES` registry.
- Produces:
  - `slides/index.js`: `export const SLIDES = [{ key, title, Component }]` (Task 4 uses placeholder Components; Tasks 6–7 replace them).
  - `SlideShell.jsx`: `export default function SlideShell({ eyebrow, children, className })` — responsive frame: `min-h-full grid` centered on desktop; mobile allows vertical scroll (`overflow-y-auto`). Max content width `min(100%-2rem, 64rem)`.
  - `Deck.jsx`: `export default function Deck({ slides, index, direction, hostCtx })` — AnimatePresence with direction-aware slide transition; renders `slides[index].Component` inside `SlideShell`, passing `hostCtx`.
  - `DeckControls.jsx`: `export default function DeckControls({ index, total, onPrev, onNext, onJump, onToggleOverview, source })`.
  - `SlideOverview.jsx`: `export default function SlideOverview({ slides, index, onJump, onClose })`.

- [ ] **Step 1: Create the SLIDES registry with placeholders**

`client/src/pages/presentation/slides/index.js`:
```jsx
function Placeholder({ title }) { return <div className="text-center"><h2 className="font-heading text-3xl">{title}</h2></div>; }
const P = (title) => () => <Placeholder title={title} />;

export const SLIDES = [
  { key: 'hook',      title: 'Meeticulous',        Component: P('Meeticulous') },
  { key: 'problem',   title: 'The Problem',         Component: P('The Problem') },
  { key: 'idea',      title: 'The Idea',            Component: P('The Idea') },
  { key: 'how',       title: 'How It Works',        Component: P('How It Works') },
  { key: 'demo',      title: 'Try a Booking',       Component: P('Try a Booking') },
  { key: 'sides',     title: 'Two Sides',           Component: P('Two Sides') },
  { key: 'transform', title: 'Before & After',      Component: P('Before & After') },
  { key: 'who',       title: "Who It's For",        Component: P("Who It's For") },
  { key: 'pricing',   title: 'Simple Pricing',      Component: P('Simple Pricing') },
  { key: 'start',     title: 'Get Started',         Component: P('Get Started') },
];
```

- [ ] **Step 2: Create `SlideShell.jsx`**

```jsx
export default function SlideShell({ eyebrow, children, className = '' }) {
  return (
    <section className="h-full w-full overflow-y-auto overflow-x-hidden">
      <div className="min-h-full grid place-items-center px-5 py-16 sm:py-20">
        <div className={`w-full ${className}`} style={{ maxWidth: 'min(100%, 64rem)' }}>
          {eyebrow && (
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `Deck.jsx` (direction-aware transitions)**

```jsx
import { AnimatePresence, motion } from 'framer-motion';
import SlideShell from './SlideShell';

const variants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
};

export default function Deck({ slides, index, direction, hostCtx, onSwipe }) {
  const { title, Component, eyebrow } = slides[index];
  return (
    <div className="absolute inset-0">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={slides[index].key}
          custom={direction}
          variants={variants}
          initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
          drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15}
          onDragEnd={(e, info) => { if (info.offset.x < -80) onSwipe(1); else if (info.offset.x > 80) onSwipe(-1); }}
          role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}: ${title}`}
        >
          <SlideShell eyebrow={eyebrow}>
            <Component hostCtx={hostCtx} />
          </SlideShell>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Create `DeckControls.jsx`**

Quiet controls: top-right fullscreen + share + overview; bottom-center progress dots + arrows. Share uses `navigator.share` when available else copies the URL (with `#key`).
```jsx
import { useState } from 'react';

export default function DeckControls({ index, total, onPrev, onNext, onJump, onToggleOverview, source }) {
  const [copied, setCopied] = useState(false);
  const fullscreen = () => { const el = document.documentElement; if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.(); };
  const share = async () => {
    const url = window.location.href;
    try { if (navigator.share) { await navigator.share({ title: 'Meeticulous', url }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <>
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button onClick={onToggleOverview} className="btn btn--outline !px-3 !py-2 text-sm" aria-label="Slide overview">☰</button>
        <button onClick={share} className="btn btn--outline !px-3 !py-2 text-sm" aria-label="Share link">{copied ? 'Copied!' : 'Share'}</button>
        <button onClick={fullscreen} className="btn btn--outline !px-3 !py-2 text-sm" aria-label="Toggle fullscreen">⤢</button>
      </div>
      {source === 'fallback' && (
        <div className="absolute top-4 left-4 z-20 rounded-md bg-sand px-2 py-1 text-[11px] text-muted">sample data</div>
      )}
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
        <button onClick={onPrev} disabled={index === 0} className="btn btn--outline !p-2 disabled:opacity-30" aria-label="Previous slide">‹</button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => onJump(i)} aria-label={`Go to slide ${i + 1}`} aria-selected={i === index}
              className="h-2 rounded-full transition-all"
              style={{ width: i === index ? 22 : 8, background: i === index ? '#FE5100' : '#d7ccbe' }} />
          ))}
        </div>
        <button onClick={onNext} disabled={index === total - 1} className="btn btn--outline !p-2 disabled:opacity-30" aria-label="Next slide">›</button>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Create `SlideOverview.jsx`**

```jsx
export default function SlideOverview({ slides, index, onJump, onClose }) {
  return (
    <div className="absolute inset-0 z-30 bg-canvas/95 backdrop-blur-sm p-5 overflow-y-auto" role="dialog" aria-label="Slide overview">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-heading text-xl">Slides</h2>
        <button onClick={onClose} className="btn btn--outline !px-3 !py-2" aria-label="Close overview">✕</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {slides.map((s, i) => (
          <button key={s.key} onClick={() => { onJump(i); onClose(); }}
            className={`page-card text-left p-4 aspect-video flex flex-col justify-between ${i === index ? 'ring-2 ring-primary' : ''}`}>
            <span className="text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
            <span className="font-heading text-sm">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire `Presentation.jsx`**

```jsx
import { useState, useRef } from 'react';
import { useHideChrome } from '../../context/ChromeContext';
import { SLIDES } from './slides';
import { useDeckNav } from './useDeckNav';
import { usePresentationHost } from './usePresentationHost';
import Deck from './Deck';
import DeckControls from './DeckControls';
import SlideOverview from './SlideOverview';

export default function Presentation() {
  useHideChrome();
  const { index, next, prev, go } = useDeckNav(SLIDES);
  const hostCtx = usePresentationHost();
  const [overview, setOverview] = useState(false);
  const prevIndex = useRef(index);
  const direction = index >= prevIndex.current ? 1 : -1;
  prevIndex.current = index;

  return (
    <main className="fixed inset-0 overflow-hidden bg-canvas text-ink" style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}>
      <Deck slides={SLIDES} index={index} direction={direction} hostCtx={hostCtx} onSwipe={(d) => (d > 0 ? next() : prev())} />
      <DeckControls index={index} total={SLIDES.length} onPrev={prev} onNext={next} onJump={go}
        onToggleOverview={() => setOverview(true)} source={hostCtx.source} />
      {overview && <SlideOverview slides={SLIDES} index={index} onJump={go} onClose={() => setOverview(false)} />}
    </main>
  );
}
```

- [ ] **Step 7: Verify in browser (desktop + mobile)**

Reload `/presentation`. Confirm: arrows/dots navigate, keyboard ←/→/space works, hash updates to `#problem` etc., deep-link `/presentation#demo` opens slide 5, overview grid opens/jumps. Then `resize_window` preset `mobile` (375px): swipe-drag changes slides, controls reachable, no horizontal page scroll. Check console clean.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/presentation/Deck.jsx client/src/pages/presentation/DeckControls.jsx client/src/pages/presentation/SlideShell.jsx client/src/pages/presentation/SlideOverview.jsx client/src/pages/presentation/slides/index.js client/src/pages/presentation/Presentation.jsx
git commit -m "feat(presentation): paged deck engine + quiet controls + overview"
```

---

### Task 5: Interactive booking simulation

The centerpiece. Deliverable: `service → date → time → confirmed` sim with confetti, tested to never call the API.

**Files:**
- Create: `client/src/pages/presentation/BookingDemo.jsx`
- Test: `client/src/pages/presentation/__tests__/BookingDemo.test.jsx`

**Interfaces:**
- Consumes: `genSlots` from `demoData.js`; `host` prop `{ name, accent_color, profile_image, services }`; reuses `HostAvatar` (`components/common/HostAvatar.jsx`), `Button` (`components/dashboard/ui/Button.jsx`), `canvas-confetti`.
- Produces: `export default function BookingDemo({ host, onConfirmed })` — self-contained; `onConfirmed` optional callback for slide chrome.

- [ ] **Step 1: Write failing test (flow advances; no API import)**

`client/src/pages/presentation/__tests__/BookingDemo.test.jsx`:
```jsx
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import BookingDemo from '../BookingDemo';
import { FALLBACK_HOST } from '../demoData';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
const apiSpy = vi.hoisted(() => vi.fn());
vi.mock('../../../services/api', () => new Proxy({}, { get: () => apiSpy }));

describe('BookingDemo (pure simulation)', () => {
  it('advances service → date → time → confirmed and calls no API', () => {
    render(<BookingDemo host={FALLBACK_HOST} />);
    // pick first service
    fireEvent.click(screen.getByRole('button', { name: /Discovery Call/i }));
    // pick a selectable day (first enabled day cell)
    const day = screen.getAllByRole('button', { name: /^day-/ }).find((b) => !b.disabled);
    fireEvent.click(day);
    // pick first time slot
    const slot = screen.getAllByRole('button', { name: /slot-/ })[0];
    fireEvent.click(slot);
    // confirm
    fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }));
    expect(screen.getByText(/You're booked/i)).toBeTruthy();
    expect(apiSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `cd client && npx vitest run src/pages/presentation/__tests__/BookingDemo.test.jsx` → FAIL (module missing).

- [ ] **Step 3: Implement `BookingDemo.jsx`**

Copy the calendar-grid + slot-grid + stepper + confirmation *shapes* from `ServiceBooking.jsx` (~902–1523) but strip details/otp/payment; all state local, zero network. Use `aria-label={`day-${n}`}` and `aria-label={`slot-${t}`}` so the test can target cells. Theme by `host.accent_color`.
```jsx
import { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { HostAvatar } from '../../components/common/HostAvatar';
import Button from '../../components/dashboard/ui/Button';
import { genSlots } from './demoData';

const STEPS = ['service', 'time', 'confirmed'];
const fmtPrice = (p) => (p === 0 ? 'Free' : `₹${p.toLocaleString('en-IN')}`);
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const hr = h % 12 || 12; return `${hr}:${String(m).padStart(2, '0')} ${ap}`; };

export default function BookingDemo({ host, onConfirmed }) {
  const tc = host.accent_color || '#FE5100';
  const [step, setStep] = useState('service');
  const [service, setService] = useState(null);
  const [date, setDate] = useState(null);       // ISO yyyy-mm-dd
  const [slot, setSlot] = useState(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const days = useMemo(() => {
    const first = new Date(month.y, month.m, 1).getDay();
    const count = new Date(month.y, month.m + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [month]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const iso = (n) => `${month.y}-${String(month.m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  const selectable = (n) => n && iso(n) >= todayISO;
  const slots = date ? genSlots(date) : [];

  const reset = () => { setStep('service'); setService(null); setDate(null); setSlot(null); };
  const confirm = () => { setStep('confirmed'); confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: [tc, '#FFB703', '#FE5100'] }); onConfirmed?.(); };

  return (
    <div className="page-card p-5 sm:p-7" style={{ '--tc': tc }}>
      {/* header */}
      <div className="flex items-center gap-3 mb-5">
        <HostAvatar src={host.profile_image} name={host.name} themeColor={tc} size={44} shape="rounded" />
        <div><p className="font-heading font-bold leading-tight">{host.name}</p><p className="text-sm text-muted">Book a session</p></div>
      </div>
      {/* stepper */}
      <div className="flex items-center gap-2 mb-6" aria-hidden="true">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 h-1.5 rounded-full" style={{ background: STEPS.indexOf(step) >= i ? tc : '#eee' }} />
        ))}
      </div>

      {step === 'service' && (
        <div className="grid gap-3">
          {host.services.map((sv) => (
            <button key={sv.id} onClick={() => { setService(sv); setStep('time'); }}
              className="page-card text-left p-4 hover:-translate-y-0.5 transition-transform flex justify-between items-center gap-4">
              <span><span className="font-heading font-semibold block">{sv.title}</span>
                <span className="text-sm text-muted">{sv.duration} min · {sv.short_description}</span></span>
              <span className="font-heading font-bold" style={{ color: tc }}>{fmtPrice(sv.price)}</span>
            </button>
          ))}
        </div>
      )}

      {step === 'time' && (
        <div>
          <button onClick={reset} className="text-sm text-muted mb-3">‹ {service?.title}</button>
          <div className="flex items-center justify-between mb-3">
            <button aria-label="prev-month" onClick={() => setMonth((m) => ({ y: m.m === 0 ? m.y - 1 : m.y, m: (m.m + 11) % 12 }))} className="btn btn--outline !p-2">‹</button>
            <span className="font-heading font-semibold">{new Date(month.y, month.m).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
            <button aria-label="next-month" onClick={() => setMonth((m) => ({ y: m.m === 11 ? m.y + 1 : m.y, m: (m.m + 1) % 12 }))} className="btn btn--outline !p-2">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-5">
            {days.map((n, i) => (
              <button key={i} disabled={!selectable(n)} aria-label={n ? `day-${n}` : 'empty'}
                onClick={() => { setDate(iso(n)); setSlot(null); }}
                className="aspect-square rounded-md text-sm disabled:opacity-25 disabled:cursor-default"
                style={date === iso(n) ? { background: tc, color: '#fff' } : {}}>
                {n || ''}
              </button>
            ))}
          </div>
          {date && (
            slots.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {slots.map((t) => (
                  <button key={t} aria-label={`slot-${t}`} onClick={() => setSlot(t)}
                    className="btn btn--outline" style={slot === t ? { background: tc, color: '#fff', borderColor: tc } : {}}>{fmtTime(t)}</button>
                ))}
              </div>
            ) : <p className="text-muted text-sm">No open times that day 🦥</p>
          )}
          {slot && (
            <div className="mt-6">
              <Button variant="primary" full onClick={confirm} aria-label="Confirm booking">Confirm booking</Button>
            </div>
          )}
        </div>
      )}

      {step === 'confirmed' && (
        <div className="text-center py-6">
          <div className="mx-auto mb-4 grid place-items-center h-14 w-14 rounded-full" style={{ background: `${tc}22` }}>
            <span style={{ color: tc, fontSize: 28 }}>✓</span>
          </div>
          <h3 className="font-heading text-2xl mb-1">You're booked!</h3>
          <p className="text-muted mb-1">{service?.title} with {host.name}</p>
          <p className="text-muted text-sm mb-6">{date && new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {slot && fmtTime(slot)}</p>
          <Button variant="outline" onClick={reset}>Try again</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test, expect PASS** — `cd client && npx vitest run src/pages/presentation/__tests__/BookingDemo.test.jsx` → PASS (flow advances, `apiSpy` never called).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/presentation/BookingDemo.jsx client/src/pages/presentation/__tests__/BookingDemo.test.jsx
git commit -m "feat(presentation): interactive booking simulation (no API, confetti)"
```

---

### Task 6: Slides 01–05 (Hook, Problem, Idea, How, Demo)

Replace placeholders with real content. Deliverable: first five slides render on brand at desktop + mobile.

**Files:**
- Create: `slides/S01Hook.jsx`, `S02Problem.jsx`, `S03Idea.jsx`, `S04How.jsx`, `S05Demo.jsx`
- Modify: `slides/index.js` (import real components; add per-slide `eyebrow`)

**Interfaces:**
- Consumes: `Reveal` (`components/home/Reveal.jsx`, default export, props `{children, delay, y, as, className}`); `Odometer` — **do not import from Home.jsx** (avoids pulling the 2147-line module); instead animate stats with a small inline count or a static number (YAGNI). `hostCtx` prop `{ host, services, source }` passed to every slide. `BookingDemo` for S05.

Each slide MUST provide an explicit mobile vertical order. Use this contract: outer wrapper `grid gap-8 lg:grid-cols-2 items-center` (desktop 2-col → mobile stacked), text block first in DOM so mobile reads text→visual.

- [ ] **Step 1: S01 Hook**

Copy (verbatim from `Home.jsx:816/821`): headline "Your booking link that **actually gets you paid**." sub "Share one link — clients book, pay over UPI, and the money lands in your account." CTA button "Continue with Google" (visual only — `href="/be-a-sloth"`). Include the inline `Sloth()` SVG (copy from `components/error/ErrorIllustration.jsx`) or `client/public/sloth.png` as the illustration.
```jsx
import Reveal from '../../../components/home/Reveal';
export default function S01Hook() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 items-center">
      <div>
        <Reveal><h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">Your booking link that <span className="text-primary">actually gets you paid</span>.</h1></Reveal>
        <Reveal delay={0.1}><p className="mt-5 text-lg text-muted max-w-md">Share one link — clients book, pay over UPI, and the money lands in your account.</p></Reveal>
        <Reveal delay={0.2}><a href="/be-a-sloth" className="btn-primary inline-block mt-7">Continue with Google</a></Reveal>
      </div>
      <Reveal delay={0.15} className="justify-self-center">
        <img src="/sloth.png" alt="Meeticulous mascot" width={320} height={320} className="w-56 sm:w-72 lg:w-80 h-auto" loading="eager" />
      </Reveal>
    </div>
  );
}
```

- [ ] **Step 2: S02 Problem**

Visualize the fragmented today. Copy the `PROBLEMS` framing ("The admin that eats your week"). Render a scattered grid of tool chips (Instagram, WhatsApp, Phone calls, Google Calendar, UPI, Notes, Spreadsheets, Follow-ups) each as a `page-card` tile with a subtle rotation, over a headline "Booking a client today takes **eight apps**." Mobile: 2-col chip grid under the headline.
```jsx
import Reveal from '../../../components/home/Reveal';
const TOOLS = ['Instagram DMs', 'WhatsApp', 'Phone calls', 'Google Calendar', 'UPI apps', 'Notes', 'Spreadsheets', 'Manual follow-ups'];
export default function S02Problem() {
  return (
    <div>
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl max-w-2xl">Getting booked today means juggling <span className="text-primary">eight different apps</span>.</h2></Reveal>
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TOOLS.map((t, i) => (
          <Reveal key={t} delay={i * 0.05}><div className="page-card p-4 text-center text-sm font-medium" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 1.5}deg)` }}>{t}</div></Reveal>
        ))}
      </div>
      <Reveal delay={0.4}><p className="mt-8 text-muted">Messages get missed. Payments slip. You become your own overworked receptionist.</p></Reveal>
    </div>
  );
}
```

- [ ] **Step 3: S03 Idea**

One link replaces the chaos. Headline "One calm link connects all of it." Subtext "Made for India. Not adapted for it." Visual: the eight chips collapsing into a single pill labeled with the host's link `meeticulous.com/{host.username}` (use `hostCtx.host.username`). Mobile stacks chips-arrow-pill vertically.
```jsx
import Reveal from '../../../components/home/Reveal';
export default function S03Idea({ hostCtx }) {
  const u = hostCtx?.host?.username || 'you';
  return (
    <div className="text-center">
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">One calm link connects <span className="text-primary">all of it</span>.</h2></Reveal>
      <Reveal delay={0.1}><p className="mt-4 text-muted">Made for India. Not adapted for it.</p></Reveal>
      <Reveal delay={0.2}>
        <div className="mt-8 inline-flex items-center gap-2 rounded-xl bg-ink text-white px-5 py-3 font-mono text-sm sm:text-base">
          <span className="opacity-60">meeticulous.com/</span><span className="text-[#FFB703]">{u}</span>
        </div>
      </Reveal>
    </div>
  );
}
```

- [ ] **Step 4: S04 How**

Three steps (from `components/home/HowItWorks.jsx`): "Share one link → Clients book and pay upfront → Just show up." Numbered cards, staggered. Mobile: vertical stack.
```jsx
import Reveal from '../../../components/home/Reveal';
const STEPS = [
  { n: '01', t: 'Share one link', d: 'Put it in your bio, your story, your WhatsApp.' },
  { n: '02', t: 'Clients book & pay upfront', d: 'They pick a time and pay over UPI — no back-and-forth.' },
  { n: '03', t: 'Just show up', d: 'Reminders go out automatically. The money is already in.' },
];
export default function S04How() {
  return (
    <div>
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">From link to paid. In <span className="text-primary">three steps</span>.</h2></Reveal>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}><div className="page-card p-6 h-full">
            <span className="font-heading text-3xl text-primary">{s.n}</span>
            <h3 className="font-heading text-lg mt-3">{s.t}</h3>
            <p className="text-sm text-muted mt-1">{s.d}</p>
          </div></Reveal>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: S05 Demo**

Centerpiece. Left: copy "Try it. This is exactly what your clients see." Right: `<BookingDemo host={hostCtx.host} />`. Mobile: copy on top, demo below.
```jsx
import Reveal from '../../../components/home/Reveal';
import BookingDemo from '../BookingDemo';
export default function S05Demo({ hostCtx }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 items-center">
      <div>
        <Reveal><h2 className="font-heading text-3xl sm:text-4xl">Try it yourself.</h2></Reveal>
        <Reveal delay={0.1}><p className="mt-4 text-muted max-w-sm">This is exactly what your clients see when they open your link. Pick a service, a time, and book.</p></Reveal>
      </div>
      <Reveal delay={0.15}><BookingDemo host={hostCtx.host} /></Reveal>
    </div>
  );
}
```

- [ ] **Step 6: Wire real components in `slides/index.js`**

Replace the placeholder entries for `hook/problem/idea/how/demo` with imports of the real components and add `eyebrow` per slide (e.g. hook → none; problem → 'The problem'; idea → 'The idea'; how → 'How it works'; demo → 'Live demo'). Keep `sides…start` as placeholders for now.

- [ ] **Step 7: Verify in browser (desktop + 375px)**

Reload; step through slides 1–5. Confirm brand fidelity (orange, Jakarta headings), the demo books end-to-end with confetti, mobile stacks text→visual with readable type and no overflow. Console clean.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/presentation/slides/
git commit -m "feat(presentation): slides 01-05 (hook, problem, idea, how, live demo)"
```

---

### Task 7: Slides 06–10 (Sides, Transform, Who, Pricing, Start) + category switcher

Deliverable: remaining slides on brand; slide 08 chips re-skin the slide-05 demo host via shared context.

**Files:**
- Create: `slides/S06Sides.jsx`, `S07Transform.jsx`, `S08Who.jsx`, `S09Pricing.jsx`, `S10Start.jsx`
- Modify: `slides/index.js`; `Presentation.jsx` (lift demo-host selection to shared state so S08 controls S05)

**Interfaces:**
- Consumes: `Tabs` (`components/dashboard/ui/Tabs.jsx`, props `{tabs:[{value,label}], value, onChange}`), `SegmentedControl` (`components/dashboard/ui/SegmentedControl.jsx`), `PricingCards` (`components/pricing/PricingCards.jsx`, no props), `ServiceCard` (`components/guest/ServiceCard.jsx`, props `{service, rank}`), `CATEGORY_DEMOS` from `demoData.js`.
- Produces: `hostCtx` gains `activeHost` + `setCategory` (see Step 1).

- [ ] **Step 1: Lift active-demo-host into `Presentation.jsx`**

So the "Who it's for" chips (S08) re-skin the demo (S05), add category state and expose `activeHost`:
```jsx
// in Presentation.jsx, after usePresentationHost():
const [category, setCategory] = useState(null); // null = the real/live host
const activeHost = category
  ? (CATEGORY_DEMOS.find((c) => c.key === category)?.host || hostCtx.host)
  : hostCtx.host;
// pass down:
const ctx = { ...hostCtx, activeHost, category, setCategory };
// <Deck ... hostCtx={ctx} />
```
Update S05 to use `hostCtx.activeHost` instead of `hostCtx.host`. Import `CATEGORY_DEMOS` and `useState`.

- [ ] **Step 2: S06 Sides (Tabs: Client view / Host view)**

Client view = a `ServiceCard` built from `activeHost.services[0]` (map to the flat ServiceCard shape). Host view = a lightweight dashboard mock (`page-card` list of upcoming bookings + an earnings tile). Mobile: tabs stay, content stacks.
```jsx
import { useState } from 'react';
import Reveal from '../../../components/home/Reveal';
import Tabs from '../../../components/dashboard/ui/Tabs';
import ServiceCard from '../../../components/guest/ServiceCard';
export default function S06Sides({ hostCtx }) {
  const [tab, setTab] = useState('client');
  const h = hostCtx.activeHost; const sv = h.services[0];
  const cardService = { id: sv.id, slug: sv.slug, title: sv.title, description: sv.short_description, price: sv.price, currency: 'INR',
    coverImage: h.cover_image, hostName: h.name, hostUsername: h.username, hostAvatar: h.profile_image, avgRating: 5, reviewCount: 12,
    area: 'Online', meetingMode: sv.meeting_mode, url: '#', badges: { isNew: true, availableThisWeek: true } };
  return (
    <div>
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">Beautiful on <span className="text-primary">both sides</span>.</h2></Reveal>
      <div className="mt-5 max-w-xs"><Tabs tabs={[{ value: 'client', label: 'Your client' }, { value: 'host', label: 'You' }]} value={tab} onChange={setTab} /></div>
      <div className="mt-6 max-w-md">
        {tab === 'client'
          ? <ServiceCard service={cardService} rank={1} />
          : <div className="page-card p-5 grid gap-3">
              <div className="flex justify-between"><span className="text-sm text-muted">This week</span><span className="font-heading font-bold text-primary">₹12,400</span></div>
              {['Strategy Session · Tue 3:00 PM', 'Discovery Call · Wed 11:00 AM', 'Deep Dive · Fri 2:00 PM'].map((r) => (
                <div key={r} className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-primary" />{r}</div>
              ))}
            </div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: S07 Transform (Before / After toggle)**

`SegmentedControl` Before|After. Before = messy list (missed DMs, no-shows, chasing payments). After = calm list. Animate the swap.
```jsx
import { useState } from 'react';
import Reveal from '../../../components/home/Reveal';
import SegmentedControl from '../../../components/dashboard/ui/SegmentedControl';
const BEFORE = ['Chasing replies across 8 apps', 'Payments after the session (maybe)', 'No-shows with no deposit', 'Your calendar in your head'];
const AFTER = ['One link does the booking', 'Paid upfront over UPI', 'Auto-reminders cut no-shows', 'Everything in one calm dashboard'];
export default function S07Transform() {
  const [v, setV] = useState('before');
  const rows = v === 'before' ? BEFORE : AFTER;
  return (
    <div className="text-center">
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">Before &amp; <span className="text-primary">after</span>.</h2></Reveal>
      <div className="mt-5 inline-block"><SegmentedControl options={[{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} value={v} onChange={setV} /></div>
      <div className="mt-6 grid gap-2 max-w-md mx-auto">
        {rows.map((r) => (
          <div key={r} className="page-card p-3 text-left text-sm flex items-center gap-2">
            <span>{v === 'before' ? '⚠️' : '✅'}</span>{r}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: S08 Who (chips re-skin the demo)**

Chips from `CATEGORY_DEMOS`. Clicking sets `hostCtx.setCategory(key)` and shows a hint "The demo on the previous slide now shows a {label} example." Mobile: chip grid 2-col.
```jsx
import Reveal from '../../../components/home/Reveal';
import { CATEGORY_DEMOS } from '../demoData';
export default function S08Who({ hostCtx }) {
  const active = hostCtx.category;
  return (
    <div className="text-center">
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">Built for <span className="text-primary">people like you</span>.</h2></Reveal>
      <Reveal delay={0.1}><p className="mt-3 text-muted">Tap a profession — the live demo re-skins to match.</p></Reveal>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {CATEGORY_DEMOS.map((c) => (
          <button key={c.key} onClick={() => hostCtx.setCategory(c.key)}
            className={`page-card px-4 py-3 text-sm font-medium flex items-center gap-2 ${active === c.key ? 'ring-2 ring-primary' : ''}`}>
            <span>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      {active && <p className="mt-6 text-sm text-muted">The booking demo now shows a <span className="text-primary font-medium">{CATEGORY_DEMOS.find((c) => c.key === active)?.label}</span> example.</p>}
    </div>
  );
}
```

- [ ] **Step 5: S09 Pricing**

Wrap `PricingCards` (no props; renders Starter/Host+/Studio with its own monthly/yearly toggle). Add eyebrow + headline "Simple pricing. Zero commission." Constrain width; ensure it scrolls within the slide on mobile.
```jsx
import Reveal from '../../../components/home/Reveal';
import PricingCards from '../../../components/pricing/PricingCards';
export default function S09Pricing() {
  return (
    <div>
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl text-center">Simple pricing. <span className="text-primary">Zero commission.</span></h2></Reveal>
      <div className="mt-8"><PricingCards /></div>
    </div>
  );
}
```
> If `PricingCards` pulls heavy transitive imports, lazy-load it: `const PricingCards = lazy(() => import('...'))` wrapped in `<Suspense fallback={null}>`.

- [ ] **Step 6: S10 Start + CTA**

"Live in ~42 seconds." Three micro-steps + big CTA "Continue with Google" → `/be-a-sloth`. Final calm line from `aboutContent.js:174`: "Keep 100% of what you earn."
```jsx
import Reveal from '../../../components/home/Reveal';
export default function S10Start() {
  return (
    <div className="text-center">
      <Reveal><h2 className="font-heading text-4xl sm:text-5xl">Live in <span className="text-primary">~42 seconds</span>.</h2></Reveal>
      <Reveal delay={0.1}><p className="mt-4 text-muted">Sign in, add a service, share your link. Keep 100% of what you earn.</p></Reveal>
      <Reveal delay={0.2}><a href="/be-a-sloth" className="btn-primary inline-block mt-8 text-lg">Continue with Google</a></Reveal>
      <Reveal delay={0.3}><p className="mt-6 text-sm text-muted">meeticulous.com</p></Reveal>
    </div>
  );
}
```

- [ ] **Step 7: Wire real components in `slides/index.js`** (all 10 now real; add eyebrows).

- [ ] **Step 8: Verify in browser** — step through 6–10; on S08 tap a category then swipe back to S05 and confirm the demo host changed; pricing toggle works; mobile 375px readable, no horizontal overflow. Console clean.

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/presentation/slides/ client/src/pages/presentation/Presentation.jsx
git commit -m "feat(presentation): slides 06-10 + category switcher re-skins demo"
```

---

### Task 8: Polish, a11y, reduced-motion, gates, PR

Deliverable: reduced-motion clean, a11y sound, vitest + build green, browser QA at 375/768/1280, PR opened.

**Files:**
- Modify: any presentation file needing polish.

- [ ] **Step 1: Reduced-motion pass**

Verify with `resize_window` (or DevTools emulate) `prefers-reduced-motion: reduce`: slide transitions become instant and drag still works. `Reveal` already respects it; ensure `Deck.jsx` transition is skipped — wrap the `transition` duration to `0` under reduced motion via `useReducedMotion()` from framer-motion:
```jsx
import { useReducedMotion } from 'framer-motion';
// const reduce = useReducedMotion(); transition={{ duration: reduce ? 0 : 0.28, ease: [...] }}
```

- [ ] **Step 2: A11y pass**

Add a visually-hidden live region announcing slide changes in `Presentation.jsx`:
```jsx
<p className="sr-only" aria-live="polite">Slide {index + 1} of {SLIDES.length}: {SLIDES[index].title}</p>
```
Confirm all controls have `aria-label` (already added), focus-visible ring shows on tab, and text CTAs use `.btn-primary` (AA). Use `read_page` to confirm the roles/labels.

- [ ] **Step 3: Run the full client test suite + build**

```bash
cd client && npx vitest run
cd client && npm run build
```
Expected: vitest green (incl. routeManifestSync + the 3 new tests), build succeeds. Also run the server sync test: `cd server && npx jest tests/unit/reservedSegmentsSync.test.js`.

- [ ] **Step 4: Browser QA sweep**

`resize_window` at 375, 768, 1280, 1600. For each: no horizontal page scroll, controls reachable, type readable, demo usable. Screenshot the hook slide + the confirmed demo state for the PR.

- [ ] **Step 5: Commit polish**

```bash
git add client/src/pages/presentation/
git commit -m "feat(presentation): reduced-motion, a11y live region, polish"
```

- [ ] **Step 6: Push + open PR (do NOT merge)**

```bash
git push -u origin feat/presentation-deck
gh pr create --title "feat(presentation): shareable interactive /presentation deck" --body "$(cat <<'EOF'
## What
Full-screen shareable `/presentation` deck telling the Meeticulous story in 10 slides, with a live-data interactive booking simulation.

## Highlights
- Zero new dependencies (framer-motion / canvas-confetti already present)
- Full-screen via `useHideChrome()`; route reserved on both client + server (sync tests pass)
- Centerpiece: booking simulation on live `/sndatarkar` data with curated fallback — pure simulation, no API/DB write (enforced by test)
- Slide 08 category chips re-skin the demo host
- Strict brand reuse: ServiceCard, PricingCards, HostAvatar, Reveal, Button, existing tokens
- Deep-linkable (`/presentation#demo`), keyboard + swipe nav, reduced-motion respected, mobile-first re-composed layouts

## Tests
- `usePresentationHost` fallback, `BookingDemo` flow + no-API guarantee, deck-nav helpers
- `npx vitest run` + `npm run build` green; reserved-segment sync tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Hand the PR link to the user. **Do not merge.**

---

## Self-Review

**Spec coverage:** All 10 slides ✓ (Tasks 6–7). Full-screen ✓ (T1). Live data + fallback ✓ (T2). Deep-link/keyboard/swipe/overview/fullscreen/share ✓ (T3–T4). Booking simulation, no real write ✓ (T5). Category switcher re-skins demo ✓ (T7). Reduced-motion + a11y ✓ (T8). Reserved-list sync ✓ (T1). Reuse of ServiceCard/PricingCards/HostAvatar/Reveal/Button ✓. Perf: lazy route + optional lazy PricingCards, lazy images, no new deps ✓. Stop-at-PR ✓ (T8).

**Placeholder scan:** No TBD/TODO; every code step has real code. (Slide copy is production text from audited data files.)

**Type consistency:** `hostCtx` shape `{ host, services, source, loading }` from T2, extended in T7 to add `{ activeHost, category, setCategory }`; S05 updated in T7 Step 1 to read `activeHost`. `Service` shape consistent (id/title/slug/short_description/price/duration/meeting_mode) across demoData, BookingDemo, S06 map. `SLIDES` entry `{ key, title, Component, eyebrow? }` consistent T4/T6/T7. `useDeckNav` returns `{ index, next, prev, go, goKey }` — used in Presentation.jsx (`go` for onJump) ✓.

**Note carried into every task:** never stage `server/routes/authRoutes.js`, `server/routes/hostRoutes.js`, `server/middleware/gone.js` (foreign working-tree changes). Each commit stages explicit paths only.
