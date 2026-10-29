# Prerender Marketing Routes — Design Spec

_2026-07-06 · Phase 3A of SEO/AEO/GEO plan_

## Problem

SPA renders all HTML client-side. Social scrapers (Twitter/FB/LinkedIn) and non-JS crawlers see only static `index.html` fallback OG tags — same title/image for every shared link.

## Solution

Post-build Puppeteer script renders ~17 marketing routes against the built SPA, captures final HTML (with Seo.jsx-injected meta/OG/JSON-LD), writes static `.html` files. Vercel serves these directly.

## Routes

```js
const PRERENDER_ROUTES = [
  '/',
  '/pricing',
  '/about',
  '/help',
  '/contact',
  '/support',
  '/blog',
  '/careers',
  '/changelog',
  '/privacy',
  '/terms',
  '/refund',
  '/badges',
  '/services',
  '/explore',
  '/lp/calendly-alternative',
  '/lp/topmate-vs-bookasloth',
];
```

## Architecture

1. `vite build` → `dist/` (unchanged)
2. `node scripts/prerender.mjs`:
   - Starts local static server on `dist/` (port 4173)
   - Launches Puppeteer headless
   - For each route: navigate → wait networkidle0 → capture outerHTML → write `dist/<path>/index.html`
   - Homepage → `dist/index.html` (overwrite)
3. Vercel serves static files before rewrite rules — prerendered HTML served without hitting catch-all

## Wait Strategy

- `waitUntil: 'networkidle0'`
- Additional: wait for `document.title` to differ from default OR 3s timeout
- Seo.jsx fires in useEffect on mount — networkidle0 covers it

## File Changes

| File | Type |
|---|---|
| `client/scripts/prerender.mjs` | NEW |
| `client/package.json` | Modify build script, add puppeteer devDep |

## Error Handling

- Per-route failure → warn + skip, build succeeds
- Full script failure → build succeeds (SPA fallback)
- Non-blocking enhancement

## Hydration

Using `createRoot().render()` (not hydrateRoot). React replaces prerendered content on boot. No hydration mismatch risk. Marketing pages load fast enough that flash is imperceptible.

## Not In Scope (Phase 3A)

- hydrateRoot migration — unnecessary complexity for marketing pages

---

# Phase 3B — Dynamic Route Prerender (Bot Traffic)

_Added 2026-07-06_

## Problem

Dynamic routes (/:username, /:username/:slug) still invisible to social scrapers. Admin can edit SEO metadata via SeoDrawer but changes only take effect for JS-executing crawlers.

## Solution

Server-side meta-tag endpoint + Vercel edge middleware bot detection.

## Architecture

```
Bot visits /:username/:slug
    ↓
Vercel Edge Middleware (middleware.js)
    ↓ detects bot User-Agent
    ↓
Fetches GET API_ORIGIN/prerender/:username/:slug
    ↓
Express prerenderController.js
    ↓ reuses buildHostProfile / buildPublicServiceByProfileAndSlug
    ↓
Returns minimal HTML with <title>, OG, canonical, JSON-LD
    ↓
Edge returns HTML to bot (X-Prerender: true header)
```

Regular users bypass this entirely — they get the SPA as before.

## Bot Detection

Matches: Twitterbot, facebookexternalhit, LinkedInBot, Slackbot, Discordbot, WhatsApp, TelegramBot, Applebot, PinterestBot, PerplexityBot, ClaudeBot, GPTBot, Google-Extended, YandexBot.

Intentionally excludes Googlebot (renders JS fine — no need to double-serve).

## Admin SEO Control

Admin SeoDrawer writes `seo_title`, `seo_description`, `og_title`, `og_description`, `seo_image`, `is_indexable` to DB. The prerender controller reads from DB on every request (response-cached 120s). Admin edits reflected within 2 minutes — no redeploy needed.

## File Changes

| File | Type |
|---|---|
| `server/controllers/prerenderController.js` | NEW |
| `server/routes/prerenderRoutes.js` | NEW |
| `server/server.js` | Mount prerender route |
| `server/controllers/hostController.js` | Export buildHostProfile |
| `server/controllers/serviceController.js` | Export buildPublicServiceByProfileAndSlug |
| `client/middleware.js` | Add bot detection + prerender proxy |

## Caching

- `Cache-Control: public, max-age=120, s-maxage=300` on prerender responses
- Reuses existing server-side responseCache (buildHostProfile = 120s TTL)
- Admin edit → cache busts on next profile/service mutation (existing bust logic)

## Fail-Open

- Edge middleware: 3s timeout on prerender fetch; on failure → SPA fallback
- Server: any error → 500 (edge ignores non-200, serves SPA)
- Zero risk of breaking the site for real users
