# Detective-Sloth 404 Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show rotating detective-sloth illustrations + new copy on 404/410 across all three 404 surfaces (client React, server brandPage, edge middleware).

**Architecture:** Hybrid — raster CDN images drive only the `lost` mood (404/410); every other code keeps its inline-SVG line-art. Each of the three runtimes hardcodes the same CDN base + three filenames (they can't share a constant) and picks a random variant per visit/request. Real 404 status + noindex preserved on server + edge.

**Tech Stack:** React 18 (Vitest), Node/Express (Jest), Vercel Edge Middleware.

## Global Constraints

- CDN base (exact): `https://company-assets.meeticulous.in/images/error`
- Three image filenames (exact): `sloth-tracks.png`, `sloth-think.png`, `sloth-glass.png`
- Images are NOT in the repo — code ships before they exist; a missing image renders an empty box, never an error.
- Only codes 404 and 410 become image-driven. All other codes untouched (copy + line-art).
- Edge (`middleware.js`) and server (`brandPage.js`) responses MUST keep `status 404` and `<meta name="robots" content="noindex">`.
- Random pick must be stable within a single React mount (lazy `useState` initializer, never bare `Math.random()` in render body).
- No new dependencies. No routing/prerender changes.
- Copy (verbatim):
  - 404 title: `This page pulled a vanishing act`
  - 404 body: `We searched high and low — magnifying glass and all — but this page isn't here. It may have moved, or it never existed.`
  - 410 title: `This one's gone for good`
  - 410 body: `We looked, but this page was permanently removed and isn't coming back.`
  - Edge title: `No host at this address`
  - Edge body: `We couldn't track anyone down at /{slug}. The link may be mistyped, or the profile has moved on.`
  - Edge CTA: `Explore hosts` → `https://meeticulous.com/explore`

## File Structure

- `client/src/config/errorCatalog.js` — MODIFY: add `ERROR_IMAGE_BASE`, `ERROR_IMAGE_VARIANTS`, `pickErrorImage()`; set 404/410 copy + `image: true`.
- `client/src/components/error/ErrorIllustration.jsx` — MODIFY: accept `image` prop; render `<img>` when set, else SVG.
- `client/src/pages/ErrorPage.jsx` — MODIFY: pass `entry.image` through to `ErrorLayout`.
- `client/src/components/error/ErrorLayout.jsx` — MODIFY: accept `image` prop, forward to `ErrorIllustration`.
- `client/src/__tests__/errorPages.test.jsx` — MODIFY: image-render assertions + updated 404 title.
- `server/utils/brandPage.js` — MODIFY: `brandPage()` accepts `image`; add `ERROR_IMAGE_BASE`/variants + `pickErrorImage()`; hero `<img>` CSS.
- `server/middleware/errorMiddleware.js` — MODIFY: on 404, pass random image + new copy.
- `server/tests/unit/brandPage.test.js` — MODIFY: image-present / image-absent assertions.
- `client/middleware.js` — MODIFY: rebrand the unknown-username 404 HTML with card + random image + new copy.

---

### Task 1: Client catalog — image helper + 404/410 copy

**Files:**
- Modify: `client/src/config/errorCatalog.js`
- Test: `client/src/__tests__/errorPages.test.jsx`

**Interfaces:**
- Produces: `ERROR_IMAGE_BASE` (string), `ERROR_IMAGE_VARIANTS` (string[]), `pickErrorImage()` → full absolute URL string. Catalog 404/410 entries gain `image: true`.

- [ ] **Step 1: Write the failing test** — append to `errorPages.test.jsx`:

```jsx
import { ERROR_IMAGE_BASE, ERROR_IMAGE_VARIANTS, pickErrorImage } from '../config/errorCatalog';

describe('error image variants', () => {
  it('exposes the CDN base and three variants', () => {
    expect(ERROR_IMAGE_BASE).toBe('https://company-assets.meeticulous.in/images/error');
    expect(ERROR_IMAGE_VARIANTS).toEqual(['sloth-tracks.png', 'sloth-think.png', 'sloth-glass.png']);
  });
  it('pickErrorImage returns a full URL from the variant set', () => {
    const url = pickErrorImage();
    expect(url.startsWith('https://company-assets.meeticulous.in/images/error/')).toBe(true);
    expect(ERROR_IMAGE_VARIANTS.some((v) => url.endsWith(v))).toBe(true);
  });
  it('marks 404 and 410 as image-driven', () => {
    expect(ERROR_CATALOG[404].image).toBe(true);
    expect(ERROR_CATALOG[410].image).toBe(true);
    expect(ERROR_CATALOG[500].image).toBeUndefined();
  });
  it('uses the new detective copy for 404', () => {
    expect(ERROR_CATALOG[404].title).toBe('This page pulled a vanishing act');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd client && npx vitest run src/__tests__/errorPages.test.jsx`
Expected: FAIL — `ERROR_IMAGE_BASE` undefined; old 404 title.

- [ ] **Step 3: Implement in `errorCatalog.js`** — add after the `ACTIONS` block:

```js
// Detective-sloth art for the `lost` mood (404/410). Hosted on the external CDN
// (not in-repo); a missing file just renders an empty box. One random variant
// per visit — see pickErrorImage.
export const ERROR_IMAGE_BASE = 'https://company-assets.meeticulous.in/images/error';
export const ERROR_IMAGE_VARIANTS = Object.freeze([
  'sloth-tracks.png',
  'sloth-think.png',
  'sloth-glass.png',
]);
export function pickErrorImage() {
  const i = Math.floor(Math.random() * ERROR_IMAGE_VARIANTS.length);
  return `${ERROR_IMAGE_BASE}/${ERROR_IMAGE_VARIANTS[i]}`;
}
```

Then update the 404 and 410 entries (replace title/message, add `image: true`):

```js
  404: {
    title: 'This page pulled a vanishing act',
    message: "We searched high and low — magnifying glass and all — but this page isn't here. It may have moved, or it never existed.",
    art: 'lost',
    image: true,
    cta: { label: 'Go Home', action: ACTIONS.HOME },
  },
```

```js
  410: {
    title: "This one's gone for good",
    message: 'We looked, but this page was permanently removed and isn’t coming back.',
    art: 'lost',
    image: true,
    cta: { label: 'Go Home', action: ACTIONS.HOME },
  },
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd client && npx vitest run src/__tests__/errorPages.test.jsx`
Expected: PASS (the existing "renders the 404 title" test also updated in Task 3 — if it fails on the old title string, that's expected and fixed there; run just the new `describe` if needed: add `-t "error image variants"`).

- [ ] **Step 5: Commit**

```bash
git add client/src/config/errorCatalog.js client/src/__tests__/errorPages.test.jsx
git commit -m "feat(errors): add CDN image helper + detective 404/410 copy"
```

---

### Task 2: Client illustration — render image or SVG

**Files:**
- Modify: `client/src/components/error/ErrorIllustration.jsx`
- Test: `client/src/__tests__/errorPages.test.jsx`

**Interfaces:**
- Consumes: `pickErrorImage` from `errorCatalog`.
- Produces: `<ErrorIllustration art={..} image={bool} />` — when `image` truthy renders `<img alt="" width height>` with a CDN src; else existing SVG.

- [ ] **Step 1: Write the failing test** — append:

```jsx
import { render as rtlRender } from '@testing-library/react';
import ErrorIllustration from '../components/error/ErrorIllustration';

describe('ErrorIllustration image mode', () => {
  it('renders a CDN <img> when image is set', () => {
    const { container } = rtlRender(<ErrorIllustration art="lost" image />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src').startsWith('https://company-assets.meeticulous.in/images/error/')).toBe(true);
    expect(img.getAttribute('alt')).toBe('');
  });
  it('renders the SVG (no img) when image is not set', () => {
    const { container } = rtlRender(<ErrorIllustration art="lost" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd client && npx vitest run src/__tests__/errorPages.test.jsx -t "ErrorIllustration image mode"`
Expected: FAIL — component ignores `image`, no `<img>`.

- [ ] **Step 3: Implement** — edit `ErrorIllustration.jsx`. Add import at top:

```jsx
import { useState } from 'react';
import { pickErrorImage } from '../../config/errorCatalog';
```

Replace the default export:

```jsx
export default function ErrorIllustration({ art, image = false }) {
  // Stable within a mount, fresh per visit — never pick in render body.
  const [src] = useState(() => (image ? pickErrorImage() : null));
  if (image) {
    return (
      <img
        src={src}
        alt=""
        width={SIZE}
        height={SIZE}
        loading="eager"
        className="bas-error-art"
      />
    );
  }
  return ART[art] || ART.confused;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd client && npx vitest run src/__tests__/errorPages.test.jsx -t "ErrorIllustration image mode"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/error/ErrorIllustration.jsx client/src/__tests__/errorPages.test.jsx
git commit -m "feat(errors): ErrorIllustration renders CDN image variant"
```

---

### Task 3: Client wiring — thread `image` through ErrorPage + ErrorLayout

**Files:**
- Modify: `client/src/pages/ErrorPage.jsx`
- Modify: `client/src/components/error/ErrorLayout.jsx`
- Test: `client/src/__tests__/errorPages.test.jsx`

**Interfaces:**
- Consumes: `entry.image` from catalog; `ErrorIllustration`'s `image` prop.
- Produces: end-to-end — `<ErrorPage code={404}/>` renders a CDN `<img>` and the new title.

- [ ] **Step 1: Update the failing test** — change the existing 404 assertion (line ~44) and add an image assertion:

```jsx
  it('renders the 404 title, eyebrow and CTA', () => {
    renderAt(<ErrorPage code={404} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('This page pulled a vanishing act');
    expect(screen.getByText('Error 404')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go Home' })).toBeInTheDocument();
  });

  it('renders a CDN image for the 404 page', () => {
    const { container } = renderAt(<ErrorPage code={404} />);
    const img = container.querySelector('img.bas-error-art');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src').startsWith('https://company-assets.meeticulous.in/images/error/')).toBe(true);
  });
```

Note: `container` — change that single test's `renderAt` call to capture it: `const { container } = renderAt(...)`. `renderAt` already returns render result.

- [ ] **Step 2: Run to verify it fails**

Run: `cd client && npx vitest run src/__tests__/errorPages.test.jsx`
Expected: FAIL — no `img.bas-error-art` yet (ErrorPage doesn't pass `image`).

- [ ] **Step 3: Implement** — `ErrorPage.jsx`, add `image={entry.image}` to the `<ErrorLayout>` (alongside `art={entry.art}`):

```jsx
      art={entry.art}
      image={entry.image}
```

`ErrorLayout.jsx` — accept `image` in the props destructure and forward it:

```jsx
  art,
  image,
```

```jsx
          <ErrorIllustration art={art} image={image} />
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd client && npx vitest run src/__tests__/errorPages.test.jsx`
Expected: PASS (full file).

- [ ] **Step 5: Client build gate**

Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/ErrorPage.jsx client/src/components/error/ErrorLayout.jsx client/src/__tests__/errorPages.test.jsx
git commit -m "feat(errors): wire image variant through ErrorPage to layout"
```

---

### Task 4: Server brandPage — optional hero image

**Files:**
- Modify: `server/utils/brandPage.js`
- Test: `server/tests/unit/brandPage.test.js`

**Interfaces:**
- Produces: `brandPage({ image })` renders a hero `<img>` (absolute src) above the heading when `image` is a non-empty string; omits it otherwise. New exports `ERROR_IMAGE_BASE`, `pickErrorImage()`.

- [ ] **Step 1: Write the failing test** — append to `brandPage.test.js`:

```js
const { pickErrorImage, ERROR_IMAGE_BASE } = require('../../utils/brandPage');

describe('brandPage hero image', () => {
  it('renders an <img> with the given absolute src when image is set', () => {
    const html = brandPage({ code: 404, heading: 'h', body: 'b', image: 'https://company-assets.meeticulous.in/images/error/sloth-glass.png' });
    expect(html).toContain('<img');
    expect(html).toContain('https://company-assets.meeticulous.in/images/error/sloth-glass.png');
  });
  it('renders no <img> when image is absent', () => {
    const html = brandPage({ code: 500, heading: 'h', body: 'b' });
    expect(html).not.toContain('<img');
  });
  it('pickErrorImage returns a full CDN url', () => {
    expect(pickErrorImage().startsWith(ERROR_IMAGE_BASE + '/')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npx jest tests/unit/brandPage.test.js`
Expected: FAIL — `pickErrorImage` not exported; no `<img>`.

- [ ] **Step 3: Implement** — `brandPage.js`. After the `SITE` const add:

```js
const ERROR_IMAGE_BASE = 'https://company-assets.meeticulous.in/images/error';
const ERROR_IMAGE_VARIANTS = ['sloth-tracks.png', 'sloth-think.png', 'sloth-glass.png'];
function pickErrorImage() {
  const i = Math.floor(Math.random() * ERROR_IMAGE_VARIANTS.length);
  return `${ERROR_IMAGE_BASE}/${ERROR_IMAGE_VARIANTS[i]}`;
}
```

Add hero CSS to `BRAND_CSS` (inside the template string, e.g. after the `.logo` rule):

```
  .hero{width:132px;height:132px;object-fit:contain;margin:0 auto 20px;display:block}
```

Update `brandPage()` to accept + render `image`:

```js
function brandPage({ code = '', title = 'Meeticulous', heading = '', body = '', ctaLabel = 'Go to Meeticulous', ctaHref = SITE, image = '' } = {}) {
  const inner =
    `${image ? `<img class="hero" src="${esc(image)}" alt="" width="132" height="132">` : ''}` +
    `${code ? `<div class="code">${esc(code)}</div>` : ''}` +
    `<h1>${esc(heading)}</h1>` +
    `<p>${esc(body)}</p>` +
    `<a class="btn" href="${esc(ctaHref)}">${esc(ctaLabel)}</a>`;
  return shell({ title, inner });
}
```

Extend `module.exports`:

```js
module.exports = { brandPage, statusPage, wantsBrandedHtml, pickErrorImage, ERROR_IMAGE_BASE };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd server && npx jest tests/unit/brandPage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/brandPage.js server/tests/unit/brandPage.test.js
git commit -m "feat(errors): brandPage supports optional hero image"
```

---

### Task 5: Server errorMiddleware — detective sloth on 404

**Files:**
- Modify: `server/middleware/errorMiddleware.js`
- Test: `server/tests/unit/brandPage.test.js` (add a middleware-focused case here to avoid a new file) — OR inline reasoning below.

**Interfaces:**
- Consumes: `brandPage`, `pickErrorImage` from `brandPage.js`.
- Produces: a 404 through the error handler yields HTML containing a CDN image + the new 404 copy; non-404 unchanged.

- [ ] **Step 1: Write the failing test** — append to `brandPage.test.js`:

```js
const errorHandler = require('../../middleware/errorMiddleware');

// Minimal Express res/req doubles.
const makeRes = () => {
  const res = { statusCode: 404, headers: {}, body: '' };
  res.status = (c) => { res.statusCode = c; return res; };
  res.type = () => res;
  res.send = (b) => { res.body = b; return res; };
  res.json = (o) => { res.body = JSON.stringify(o); return res; };
  return res;
};
const htmlReq = { originalUrl: '/nope', method: 'GET', path: '/nope', accepts: () => 'html' };

describe('errorMiddleware 404 branding', () => {
  it('renders a CDN image + vanishing-act copy on a browser 404', () => {
    const res = makeRes();
    errorHandler(Object.assign(new Error('x'), { expose: false }), htmlReq, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('company-assets.meeticulous.in/images/error/');
    expect(res.body).toContain('This page pulled a vanishing act');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npx jest tests/unit/brandPage.test.js -t "404 branding"`
Expected: FAIL — no image; heading still "Something went sideways".

- [ ] **Step 3: Implement** — `errorMiddleware.js`. Update the import and the `wantsBrandedHtml` block:

```js
const { brandPage, wantsBrandedHtml, pickErrorImage } = require('../utils/brandPage');
```

```js
  if (wantsBrandedHtml(req)) {
    // 404 gets the detective-sloth treatment matching the client + edge; other
    // codes keep the generic branded card.
    const is404 = statusCode === 404;
    return res.status(statusCode).type('html').send(brandPage({
      code: statusCode,
      title: is404 ? 'Page not found' : 'Error',
      heading: is404 ? 'This page pulled a vanishing act' : 'Something went sideways',
      body: is404
        ? "We searched high and low — magnifying glass and all — but this page isn't here. It may have moved, or it never existed."
        : message,
      image: is404 ? pickErrorImage() : '',
    }));
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd server && npx jest tests/unit/brandPage.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add server/middleware/errorMiddleware.js server/tests/unit/brandPage.test.js
git commit -m "feat(errors): detective sloth + new copy on server 404"
```

---

### Task 6: Edge middleware — branded username-404 card

**Files:**
- Modify: `client/middleware.js`
- Test: `client/src/__tests__/edgeMiddleware404.test.js` (new — pure string assertions on the returned HTML; no network).

**Interfaces:**
- Consumes: nothing new (self-contained inline HTML; random via `Math`).
- Produces: the `res.status === 404` branch returns a `Response` with `status 404`, `noindex`, one CDN image URL, the new copy, CTA to `/explore`, and the sanitized slug.

**Note:** the resolver `fetch` can't run in a unit test. Refactor the inline HTML into a small pure helper `renderProfile404Html(slug)` at the top of `middleware.js` and export it, so the test targets the helper directly. The middleware body calls the helper.

- [ ] **Step 1: Write the failing test** — create `client/src/__tests__/edgeMiddleware404.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderProfile404Html } from '../../middleware.js';

describe('edge profile-404 HTML', () => {
  it('is branded, noindex, and carries a CDN sloth image + new copy', () => {
    const html = renderProfile404Html('coolhost');
    expect(html).toContain('name="robots"');
    expect(html).toContain('noindex');
    expect(html).toContain('company-assets.meeticulous.in/images/error/');
    expect(html).toContain('No host at this address');
    expect(html).toContain('/coolhost');
    expect(html).toContain('/explore');
  });
  it('sanitizes the slug (no raw angle brackets injected)', () => {
    const html = renderProfile404Html('<script>x');
    expect(html).not.toContain('<script>x');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd client && npx vitest run src/__tests__/edgeMiddleware404.test.js`
Expected: FAIL — `renderProfile404Html` not exported.

- [ ] **Step 3: Implement** — `client/middleware.js`. Add near the top (after imports), exported:

```js
// Branded profile-404 card. Inlined here because the Vercel edge bundle can't
// import server/utils/brandPage.js (different runtime) — keep this visually in
// sync with brandPage.js by hand. Random detective-sloth variant per request.
const EDGE_ERROR_IMAGES = [
  'https://company-assets.meeticulous.in/images/error/sloth-tracks.png',
  'https://company-assets.meeticulous.in/images/error/sloth-think.png',
  'https://company-assets.meeticulous.in/images/error/sloth-glass.png',
];
export function renderProfile404Html(rawSlug) {
  const slug = String(rawSlug).replace(/[^a-z0-9._-]/gi, '');
  const img = EDGE_ERROR_IMAGES[Math.floor(Math.random() * EDGE_ERROR_IMAGES.length)];
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>No host at this address · Meeticulous</title>` +
    `<meta name="robots" content="noindex">` +
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&family=Poppins:wght@400;500&display=swap" rel="stylesheet">` +
    `<style>` +
    `:root{--orange:#FE5100;--ink:#141416;--muted:#5b5b62;--bg:#faf8f5;--card:#fff;--line:#ececec}` +
    `*{box-sizing:border-box}html,body{margin:0;height:100%}` +
    `body{background:var(--bg);color:var(--ink);font-family:'Poppins',system-ui,sans-serif;display:grid;place-items:center;padding:24px}` +
    `.card{background:var(--card);border:1px solid var(--line);border-radius:16px;max-width:460px;width:100%;padding:40px 32px;text-align:center;box-shadow:0 10px 40px rgba(20,20,22,.06)}` +
    `.hero{width:132px;height:132px;object-fit:contain;margin:0 auto 20px;display:block}` +
    `h1{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:24px;line-height:1.2;margin:0 0 12px}` +
    `p{color:var(--muted);font-size:15px;line-height:1.6;margin:0 0 28px}` +
    `a.btn{display:inline-block;background:var(--orange);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:12px}` +
    `@media (prefers-color-scheme:dark){:root{--ink:#f5f5f7;--muted:#a1a1aa;--bg:#0e0e10;--card:#17171a;--line:#26262b}}` +
    `</style></head>` +
    `<body><main class="card">` +
    `<img class="hero" src="${img}" alt="" width="132" height="132">` +
    `<h1>No host at this address</h1>` +
    `<p>We couldn't track anyone down at <strong>/${slug}</strong>. The link may be mistyped, or the profile has moved on.</p>` +
    `<a class="btn" href="https://meeticulous.com/explore">Explore hosts</a>` +
    `</main></body></html>`
  );
}
```

Replace the existing `res.status === 404` return block body so it uses the helper:

```js
    if (res.status === 404) {
      return new Response(renderProfile404Html(slug), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd client && npx vitest run src/__tests__/edgeMiddleware404.test.js`
Expected: PASS.

- [ ] **Step 5: Full client test + build gate**

Run: `cd client && npx vitest run && npm run build`
Expected: all pass (routeManifest/reserved checks included).

- [ ] **Step 6: Commit**

```bash
git add client/middleware.js client/src/__tests__/edgeMiddleware404.test.js
git commit -m "feat(errors): brand the edge profile-404 with detective sloth"
```

---

### Task 7: Full-suite verification + PR

**Files:** none (verification only).

- [ ] **Step 1: Server suite**

Run: `cd server && npm test`
Expected: pass (only pre-existing unrelated failures, if any — note them, don't fix).

- [ ] **Step 2: Client suite + build**

Run: `cd client && npx vitest run && npm run build`
Expected: pass.

- [ ] **Step 3: Manual preview spot-check**

Start client dev preview, hit `/404`, `/410`, and a random dead path (e.g. `/zzz-not-real`). Reload each 3–4× — confirm the sloth image slot rotates and the new copy shows. (Images 404 from CDN until uploaded — that's expected; the `<img>` element + src must be correct.)

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/error-page-sloth-art
gh pr create --title "feat(errors): detective-sloth 404 across all three surfaces" --body "..."
```

- [ ] **Step 5: STOP for user checkpoint before merge** (merge auto-deploys prod — user confirms).

## Self-Review

- **Spec coverage:** Surface #1 → Tasks 1–3; #2 → Tasks 4–5; #3 → Task 6; copy → Global Constraints + tasks; tests → each task + Task 7. ✅
- **Placeholders:** none — all code inline; PR body `"..."` filled at execution.
- **Type consistency:** `pickErrorImage`/`ERROR_IMAGE_BASE`/`ERROR_IMAGE_VARIANTS` consistent client + server; `image` prop/param name consistent across ErrorPage→ErrorLayout→ErrorIllustration and brandPage; `renderProfile404Html(slug)` single definition. ✅
- **Landmine:** `useHideChrome()` untouched (ErrorLayout structure preserved). Random uses lazy `useState`. ✅
