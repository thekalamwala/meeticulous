# Public-Page Performance — Optimization Pass & Reusable Kit

Branch: `perf/public-page-optimization`. Scope: global boot wins + Homepage as the
reference implementation. **No functionality, API, route, query, or visual-design
change** — only deferral, lazy-loading, self-hosting, and code-splitting.

## TL;DR — what changed

| Area | Before | After |
|---|---|---|
| Eager `index` chunk (every page) | **111.1 kB gzip** | **40.5 kB gzip** (−70.6) |
| posthog-js | bundled in `index`, init at boot | own chunk (69.5 kB gz), **dynamic-imported on first idle** |
| Razorpay `checkout.js` | sync `<script>` in `index.html` (every page) | **loaded on demand at checkout** |
| Fonts | 2 render-blocking Google requests (Poppins fetched twice) | **self-hosted woff2, preloaded**, 0 Google requests for UI fonts |
| Homepage brand splash | **fixed 2.5 s overlay** covering hero every load | snappy, **readiness-gated**, **once per session**, instant under reduced-motion |
| Homepage hero image | eager, no priority hint | `<link rel=preload as=image>` (desktop-gated) |
| `<main>` landmark on Home | none | added |

Build + 352 client tests stay green throughout.

## The big win: posthog-js off the critical path

`posthog-js` (67 kB gzip) was **>50% of the `index` chunk that loads on every
page**, pulled in three ways: `<PostHogProvider>` in `main.jsx`, the analytics bus
adapter, and `usePostHog()` in `AuthContext`. It was statically imported, so it
downloaded and initialised before first paint.

Now:
- `main.jsx` no longer wraps the tree in `<PostHogProvider>`.
- `services/analytics/adapters/posthog.js` **dynamically imports** posthog-js inside
  `init()`, with a small pre-init queue so no events are dropped during the gap.
- The analytics bus (`services/analytics/index.js`) owns PostHog identity/reset; it
  fans `identify` to every adapter (GA4 ignores props, Clarity reads name/role/plan,
  PostHog gets email + fields — **identical** to before, no new PII to ad networks).
- `AuthContext` calls `analytics.identify()` / `analytics.reset()` instead of the
  `usePostHog()` hook.
- `AnalyticsBridge` boots the bus on **first idle** (`useIdle`), not at mount.

Net: posthog-js downloads + inits after first paint, as its own cacheable chunk.

## Reusable kit (use these on every future public page)

| File | What it's for |
|---|---|
| `src/hooks/useIdle.js` | run a one-shot callback on `requestIdleCallback` (fallback to timeout). Defer non-critical boot work. |
| `src/hooks/useInViewport.js` | `[ref, hasEntered]` IntersectionObserver, once-only, configurable `rootMargin`. Lazy-mount without pulling in framer-motion. |
| `src/components/perf/LazySection.jsx` | mount a below-the-fold section (Suspense + lazy) only as it nears the viewport; reserves `minHeight` to avoid CLS. |
| `src/utils/loadRazorpay.js` | single idempotent Razorpay-script injector. **Always `await` it before `new window.Razorpay(...)`.** |
| `src/styles/fonts.css` + `public/fonts/*.woff2` | self-hosted Poppins (4 weights) + Plus Jakarta Sans (variable). |

### How to optimize the next public page (About, Contact, Legal, vendor profile, …)
1. Give the page one `<main>` landmark (matches Home / About / Careers convention).
2. Below-the-fold heavy sections → split into a `lazyWithRetry(() => import(...))`
   component and render inside `<LazySection minHeight={…}>`.
3. Any payment trigger → `await loadRazorpay()` before constructing the checkout.
4. LCP image → eager + add a media-gated `<link rel=preload as=image>` in
   `index.html` (or skip for text heroes like the mobile homepage).
5. Don't import analytics SDKs directly — call `analytics.track(EVENTS.X)`; the bus
   already defers everything.

## Tooling
`rollup-plugin-visualizer` is wired into `vite.config.js`, off by default. Run
`ANALYZE=1 npm run build` → emits `dist/stats.html` (treemap). `ANALYZE_JSON=1`
emits raw data for scripting.

## Verified (preview MCP, dev server)
- ✅ Razorpay is **not** requested on the homepage (only at checkout).
- ✅ UI fonts served same-origin from `/fonts/`; preloaded weights return 304.
- ✅ posthog-js loads **last** (after page render), not on the critical path.
- ✅ Homepage renders fully with a `main` landmark; nav/buttons/links/images have
  accessible names; brand splash exits on readiness.
- ✅ `npm run build` clean; `npm test` 352/352.

## Known follow-ups (out of scope this pass)
- `BrandPreloader` still pulls ~11 tiny Noto greeting-font subsets from Google on the
  first session load (brand greeting glyphs); skipped on repeat/reduced-motion.
  Could self-host or drop non-primary scripts later.
- `@supabase/supabase-js` (54 kB gz) is still eager via `AuthContext`
  (`onAuthStateChange`). Deferring it for anonymous visitors is a larger, separate
  change.
- `framer-motion` stays in the homepage's initial load because the hero animates
  above the fold; a CSS-only hero would let it be fully deferred (design change —
  not done).
- `@posthog/react` remains in `package.json` but is no longer imported/bundled.
- Run a real Lighthouse/axe pass on the hosted production build to confirm
  Performance 90+ / a11y 100 and close any remaining contrast items.
