# Moments Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google-Doodle-style Moments archive (`/moments`) and per-moment page (`/moments/:slug`) from a static data file, seeded with the Argentina FIFA 2026 moment.

**Architecture:** Static data file `client/src/data/moments.js` is the single source of truth. Two lazy-loaded React pages render straight from it. Search.jsx refactored to import the featured moment. No backend, no DB.

**Tech Stack:** React 18 + Vite, react-router-dom v6, Tailwind, Vitest.

## Global Constraints

- Reuse existing design tokens; no new colors. Brand `#FE5100`, `border-2` (4px) borders, `rounded-xl` where already used.
- Plus Jakarta Sans headings (`font-heading`), Poppins body.
- Client tests use Vitest with NO jest-dom — use plain assertions / `.getAttribute()`, not `toBeInTheDocument`.
- Lazy-load routes via `lazyWithRetry` (aliased `lazy` in App.jsx), matching surrounding routes.
- Moment art URL convention: `https://company-assets.meeticulous.in/images/moments/${slug}.png` (matches existing Search.jsx).

---

### Task 1: Moments data file + Argentina seed

**Files:**
- Create: `client/src/data/moments.js`
- Test: `client/src/data/moments.test.js`

**Interfaces:**
- Produces:
  - `MOMENTS` — array of `{ slug, title, date, image, alt, excerpt, body, credits?, cta? }`, newest-first. `body` = array of `{ p }` or `{ h2 }` blocks.
  - `FEATURED` — equals `MOMENTS[0]`.
  - `getMoment(slug)` — returns the matching moment or `undefined`.

- [ ] **Step 1: Write the failing test**

```js
// client/src/data/moments.test.js
import { describe, it, expect } from 'vitest';
import { MOMENTS, FEATURED, getMoment } from './moments';

describe('moments data', () => {
  it('has at least one moment', () => {
    expect(MOMENTS.length).toBeGreaterThan(0);
  });

  it('has unique slugs', () => {
    const slugs = MOMENTS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every moment has required fields', () => {
    for (const m of MOMENTS) {
      expect(typeof m.slug).toBe('string');
      expect(m.slug).toMatch(/^[a-z0-9-]+$/);
      expect(m.title).toBeTruthy();
      expect(m.date).toBeTruthy();
      expect(m.image).toBeTruthy();
      expect(Array.isArray(m.body)).toBe(true);
    }
  });

  it('FEATURED is the first moment', () => {
    expect(FEATURED).toBe(MOMENTS[0]);
  });

  it('getMoment resolves real slugs and returns undefined for bogus', () => {
    expect(getMoment(MOMENTS[0].slug)).toBe(MOMENTS[0]);
    expect(getMoment('nope-not-real')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/data/moments.test.js`
Expected: FAIL — cannot resolve `./moments`.

- [ ] **Step 3: Write the data file**

```js
// client/src/data/moments.js
// Moments — Google-Doodle-style archive content. Single source of truth for
// pages/Moments.jsx (index), pages/MomentPage.jsx (detail), and the featured
// moment on pages/Search.jsx. Curated, dev-authored; publish = edit + deploy.
//
// Each moment:
//   slug     — URL segment (/moments/:slug). Unique, URL-safe [a-z0-9-].
//   title    — headline.
//   date     — display string; also sort order (keep array newest-first).
//   image    — art URL. Convention: CDN .../images/moments/${slug}.png
//   alt      — image alt text.
//   excerpt  — 1-2 line summary (index card + meta description, keep < 160 chars).
//   body     — array of blocks: { p } paragraph | { h2 } section heading.
//   credits  — optional attribution string.
//   cta      — optional { label, href } (internal path or external URL).

const CDN = 'https://company-assets.meeticulous.in/images/moments';

export const MOMENTS = [
  {
    slug: 'fifa-2026-winners-argentina',
    title: 'Argentina — FIFA World Cup 2026 Champions',
    date: 'July 19, 2026',
    image: `${CDN}/fifa-2026-winners-argentina.png`,
    alt: 'Illustration celebrating Argentina winning the FIFA World Cup 2026',
    excerpt: 'La Albiceleste lifts the trophy again. We are celebrating with a Meeticulous moment for the 2026 champions.',
    body: [
      { p: 'Argentina are champions of the world once more. After a tournament that kept an entire planet on the edge of its seat, La Albiceleste lifted the FIFA World Cup 2026 trophy.' },
      { h2: 'Why we made this moment' },
      { p: 'At Meeticulous we love the days the whole world stops to watch the same thing at the same time. A World Cup final is one of those days — so we drew a little something to mark it.' },
      { p: 'Congratulations to the champions, and to every fan who stayed up for extra time. Here is to the next four years.' },
    ],
    credits: 'Art by the Meeticulous team.',
    cta: { label: 'Explore hosts', href: '/explore' },
  },
];

export const FEATURED = MOMENTS[0];

export function getMoment(slug) {
  return MOMENTS.find((m) => m.slug === slug);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/data/moments.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/data/moments.js client/src/data/moments.test.js
git commit -m "feat(moments): static moments data + Argentina FIFA 2026 seed"
```

---

### Task 2: MomentBlocks renderer + MomentPage detail

**Files:**
- Create: `client/src/pages/MomentPage.jsx`

**Interfaces:**
- Consumes: `getMoment`, `MOMENTS` from `../data/moments`.
- Produces: default export `MomentPage` (route element for `/moments/:slug`).

- [ ] **Step 1: Write the page**

```jsx
// client/src/pages/MomentPage.jsx
// Per-moment detail page. Route: /moments/:slug. Renders art + story from the
// static moments data. Unknown slug -> ErrorPage-style 404 via <Navigate>.
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Seo from '../components/common/Seo';
import { MOMENTS, getMoment } from '../data/moments';

function Block({ block }) {
  if (block.h2) {
    return <h2 className="mt-10 font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">{block.h2}</h2>;
  }
  return <p className="mt-5 text-[15px] leading-relaxed text-muted sm:text-base">{block.p}</p>;
}

export default function MomentPage() {
  const { slug } = useParams();
  const moment = getMoment(slug);

  if (!moment) return <Navigate to="/404" replace />;

  const idx = MOMENTS.findIndex((m) => m.slug === slug);
  const prev = MOMENTS[idx + 1]; // older
  const next = MOMENTS[idx - 1]; // newer

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <Seo
        title={`${moment.title} — Moments · Meeticulous`}
        description={moment.excerpt}
        image={moment.image}
        ogType="article"
        canonical={`https://meeticulous.com/moments/${moment.slug}`}
      />

      <Link to="/moments" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> All moments
      </Link>

      <img
        src={moment.image}
        alt={moment.alt}
        className="mx-auto mt-6 h-auto w-full max-w-2xl rounded-xl border-2 border-ink/10 object-contain"
      />

      <p className="mt-6 text-sm font-medium text-primary">{moment.date}</p>
      <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">{moment.title}</h1>

      <div className="mt-2">
        {moment.body.map((block, i) => <Block key={i} block={block} />)}
      </div>

      {moment.credits && <p className="mt-8 text-xs italic text-muted">{moment.credits}</p>}

      {moment.cta && (
        <Link
          to={moment.cta.href}
          className="mt-8 inline-flex rounded-xl border-2 border-primary bg-primary px-6 py-2.5 text-sm font-semibold text-surface transition hover:brightness-95"
        >
          {moment.cta.label}
        </Link>
      )}

      {(prev || next) && (
        <nav className="mt-12 flex items-center justify-between border-t-2 border-ink/10 pt-6 text-sm">
          {prev ? (
            <Link to={`/moments/${prev.slug}`} className="inline-flex items-center gap-1.5 text-muted transition hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> {prev.title}
            </Link>
          ) : <span />}
          {next ? (
            <Link to={`/moments/${next.slug}`} className="inline-flex items-center gap-1.5 text-right text-muted transition hover:text-primary">
              {next.title} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify route target `/404` exists**

Run: `grep -n 'path="/404"\|path="\*"' client/src/App.jsx`
Expected: a catch-all or `/404` route exists (ErrorPage). If only `path="*"` exists, change `<Navigate to="/404" replace />` to render `<ErrorPage />` directly by importing it, OR to the existing not-found path. Use whatever the file already wires for unknown routes.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/MomentPage.jsx
git commit -m "feat(moments): per-moment detail page"
```

---

### Task 3: Moments index page

**Files:**
- Create: `client/src/pages/Moments.jsx`

**Interfaces:**
- Consumes: `MOMENTS`, `FEATURED` from `../data/moments`.
- Produces: default export `Moments` (route element for `/moments`).

- [ ] **Step 1: Write the page**

```jsx
// client/src/pages/Moments.jsx
// Moments archive index. Route: /moments. Featured moment large on top, then a
// responsive grid of the rest. Renders from the static moments data.
import { Link } from 'react-router-dom';
import Seo from '../components/common/Seo';
import { MOMENTS, FEATURED } from '../data/moments';

export default function Moments() {
  const rest = MOMENTS.slice(1);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <Seo
        title="Moments — Meeticulous"
        description="A little archive of the days the world stopped to watch. Meeticulous moments, doodle-style."
        canonical="https://meeticulous.com/moments"
      />

      <header className="text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">Moments</h1>
        <p className="mt-3 text-muted">The days worth marking, drawn by the Meeticulous team.</p>
      </header>

      {/* Featured */}
      <Link
        to={`/moments/${FEATURED.slug}`}
        className="group mt-10 block overflow-hidden rounded-xl border-2 border-ink/10 transition hover:border-primary/40"
      >
        <img src={FEATURED.image} alt={FEATURED.alt} className="h-auto w-full object-contain" />
        <div className="p-6">
          <p className="text-sm font-medium text-primary">{FEATURED.date}</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-ink sm:text-2xl">{FEATURED.title}</h2>
          <p className="mt-2 text-sm text-muted">{FEATURED.excerpt}</p>
        </div>
      </Link>

      {/* Grid */}
      {rest.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((m) => (
            <Link
              key={m.slug}
              to={`/moments/${m.slug}`}
              className="group block overflow-hidden rounded-xl border-2 border-ink/10 transition hover:border-primary/40"
            >
              <img src={m.image} alt={m.alt} className="h-40 w-full object-cover" />
              <div className="p-4">
                <p className="text-xs font-medium text-primary">{m.date}</p>
                <h3 className="mt-1 font-heading text-base font-semibold text-ink">{m.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Moments.jsx
git commit -m "feat(moments): archive index page"
```

---

### Task 4: Wire routes in App.jsx

**Files:**
- Modify: `client/src/App.jsx` (lazy import block near line 67; route block near line 336)

- [ ] **Step 1: Add lazy imports**

Near the other page lazy consts (e.g. after the `BlogPost` const around line 70), add:

```jsx
const Moments        = lazy(() => import('./pages/Moments'));
const MomentPage     = lazy(() => import('./pages/MomentPage'));
```

- [ ] **Step 2: Register routes**

Near the `/blog` routes (around line 336-337), add:

```jsx
          <Route path="/moments" element={<Moments />} />
          <Route path="/moments/:slug" element={<MomentPage />} />
```

- [ ] **Step 3: Verify build**

Run: `cd client && npm run build`
Expected: build succeeds, no missing-import errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(moments): register /moments and /moments/:slug routes"
```

---

### Task 5: Refactor Search.jsx to single-source the featured moment

**Files:**
- Modify: `client/src/pages/Search.jsx:18-22` (remove hardcoded MOMENT consts), plus the featured-moment JSX block (~line 81-89) and the empty-search redirect (~line 52).

- [ ] **Step 1: Replace the hardcoded consts with an import**

Delete lines 18-22 (the `MOMENT_SLUG` / `MOMENT_TITLE` / `MOMENT_IMG` / `MOMENT_URL` block) and import FEATURED instead. Add near the other imports:

```jsx
import { FEATURED } from '../data/moments';
```

- [ ] **Step 2: Point the featured-moment link at the SPA route**

In the featured-moment JSX, replace the `<a href={MOMENT_URL}>` block with a router `Link` (Link is already imported):

```jsx
        <div className="mb-5 flex w-full max-w-3xl justify-center">
          <Link to={`/moments/${FEATURED.slug}`} title={FEATURED.title} aria-label={FEATURED.title} className="block w-3/4 sm:w-1/2">
            <img
              src={FEATURED.image}
              alt={FEATURED.title}
              className="mx-auto h-auto max-h-[32vh] w-full rounded-xl object-contain"
            />
          </Link>
        </div>
```

- [ ] **Step 3: Fix the empty-search fallback**

In `submit`, replace `window.location.href = 'https://meeticulous.com/moments';` with SPA navigation:

```jsx
    if (!v) { navigate('/moments'); return; }
```

- [ ] **Step 4: Verify build + Search test (if any)**

Run: `cd client && npm run build`
Expected: build succeeds. If `Search.test.*` exists, run `npx vitest run src/pages/Search` and confirm green.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Search.jsx
git commit -m "refactor(search): single-source featured moment from moments data"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run client tests + build**

Run: `cd client && npx vitest run src/data/moments.test.js && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 2: Visual check (preview)**

Start the dev server and load `/moments` and `/moments/fifa-2026-winners-argentina`. Confirm: featured art renders (or shows broken-image if CDN asset not yet uploaded — acceptable, note it), grid/detail layout intact, prev/next hidden with a single moment, `/moments/bogus` redirects to 404.

- [ ] **Step 3: Note CDN asset dependency**

The Argentina art must exist at `https://company-assets.meeticulous.in/images/moments/fifa-2026-winners-argentina.png`. If not uploaded, the page structure is correct but the image 404s — flag to the user as a content follow-up.

---

## Self-Review

- **Spec coverage:** data file (T1) ✓, `/moments` index (T3) ✓, `/moments/:slug` (T2) ✓, routes (T4) ✓, Search refactor (T5) ✓, unique-slug/getMoment test (T1) ✓, Argentina seed (T1) ✓. Follow-ups (DB, prerender/sitemap, OG) intentionally excluded.
- **Placeholder scan:** none — all steps show full code.
- **Type consistency:** `MOMENTS`/`FEATURED`/`getMoment` names and moment field set (`slug,title,date,image,alt,excerpt,body,credits?,cta?`) identical across T1–T5. Block shape `{ p }`/`{ h2 }` consistent between data and renderer.
- **Known unknown:** the 404 route target (T2 Step 2) — verify against App.jsx's actual not-found wiring at execution time.
