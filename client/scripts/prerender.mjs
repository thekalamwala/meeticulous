/**
 * prerender.mjs — Post-build static prerender for marketing routes + blog posts.
 *
 * Renders each route in PRERENDER_ROUTES (plus every published /blog/:slug, which
 * blogRoutes() pulls from the API at build time) using Puppeteer against the built SPA,
 * captures the final HTML (with Seo.jsx-injected meta/OG/JSON-LD), and writes
 * it as the static .html for that path. Vercel serves these directly to social
 * scrapers and non-JS crawlers.
 *
 * Run: node scripts/prerender.mjs (after vite build)
 * Requires: puppeteer (devDependency)
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';
import { FEATURES } from '../src/pages/features/featureData.js';
import { HELP_SLUGS } from '../src/content/helpDocsList.js';
import { MOMENTS } from '../src/data/moments.js';
import { GLOSSARY_SLUGS } from '../src/data/glossaryData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

// The SPA fallback served for every route WITHOUT its own prerendered file
// (vercel.json rewrites them to /spa-shell.html). It must be the BARE vite
// shell: the prerender overwrites dist/index.html with the fully-rendered
// homepage, and serving THAT as the fallback stamped `canonical=/` + homepage
// JSON-LD on every unrendered route's raw HTML (the 2026-07-19 audit's top
// finding). Copy the bare shell aside BEFORE any rendering — and before the
// preview-deploy early-exit below, because previews skip rendering but still
// need the fallback file to exist or the rewrite 404s every route.
writeFileSync(join(DIST, 'spa-shell.html'), readFileSync(join(DIST, 'index.html')));
console.log('[prerender] bare shell → dist/spa-shell.html (SPA fallback)');

// Preview deploys already get the real regression gates from vercel-build
// (vitest, then the vite build). The prerendered HTML only matters for what
// PRODUCTION serves to crawlers and link scrapers — rendering all ~77 routes
// on every PR preview was minutes of pure waste per push.
if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
  console.log(`[prerender] ${process.env.VERCEL_ENV} deploy — skipped (prerender is production-only)`);
  process.exit(0);
}
const PORT = 4173;
const ORIGIN = `http://localhost:${PORT}`;

const DEFAULT_TITLE = 'Book A Sloth — booked & paid at 0% commission';

// 15s was enough locally and timed out on a cold Vercel builder. A first pass at
// 30s runs 4-wide; anything that misses is retried serially at 60s on a now-idle
// builder (see the two passes below). The retry number is generous on purpose:
// by then nothing else competes for the builder, so a failure there is a
// genuinely broken page, not an unlucky one.
const NAV_TIMEOUT_MS = 30000;
const RETRY_TIMEOUT_MS = 60000;

// Vercel kills a build at 45 minutes and ships NOTHING (the 2026-10-10 release
// failed twice that way: ~300 routes vs a slow free-tier API). Past this budget
// the pool stops starting new routes and the run ships what it has — routes not
// reached keep serving the SPA fallback until the next deploy. A partial
// prerender beats no deploy. Routes are ordered static → blog → host/service, so
// what gets dropped first is the long tail of host/service pages.
// ponytail: wall-clock budget, not per-route accounting; ~13 min headroom covers
// install + vite build + upload. Override with PRERENDER_BUDGET_MS.
const BUDGET_MS = Number(process.env.PRERENDER_BUDGET_MS) || 30 * 60 * 1000;
const STARTED_AT = Date.now();
const overBudget = () => Date.now() - STARTED_AT > BUDGET_MS;

// One proxied API call must not hang a page past its nav timeout.
const API_FETCH_TIMEOUT_MS = 15000;

// Images/fonts never change the serialized HTML, but downloading them holds
// `networkidle0` open on every page. Answer them instantly instead of aborting:
// an aborted <img> fires onError, and some components swap in a fallback on
// error — which WOULD change the baked HTML.
const BLANK_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const PRERENDER_ROUTES = [
  '/',
  '/pricing',
  '/enterprise',
  '/about',
  '/help',
  '/help/docs',
  ...HELP_SLUGS.map((s) => `/help/docs/${s}`),
  '/contact',
  '/support',
  '/blog',
  '/careers',
  '/changelog',
  '/privacy',
  '/terms',
  '/refund',
  '/guest-terms',
  '/host-agreement',
  '/host-fees',
  '/earnings-calculator',
  '/tools',
  '/templates',
  '/tools/no-show-cost-calculator',
  '/tools/gst-calculator',
  '/glossary',
  ...GLOSSARY_SLUGS.map((s) => `/glossary/${s}`),
  '/press',
  '/stats',
  '/wall-of-love',
  // SEO discovery hubs — crawlable directories that link every /for/* profession
  // page and /compare/* competitor page (which hide the global nav). Prerender so the
  // internal links land in static HTML for non-JS crawlers.
  '/solutions',
  '/compare',
  '/appointment-booking-software',
  // Marketing/event pages with bespoke OG cards — prerender so social scrapers
  // (which don't run JS) get the card + real title, not the default og:image.
  '/how-it-works',
  '/become-a-host',
  '/opening',
  '/inaugurators',
  // KEEP IN SYNC with careersContent.js `jobs` slugs (it imports lucide-react,
  // so this node script can't import it the way it does featureData/helpDocsList).
  // Without prerender, a job page's raw HTML has no JobPosting JSON-LD at all.
  '/careers/digital-marketeer',
  '/careers/mern-stack-developer',
  '/careers/sales-associate',
  '/services',
  '/explore',
  // Moments archive + each moment. Imported from the static data file (pure ESM,
  // no lucide) so this list never drifts as moments are added.
  '/moments',
  ...MOMENTS.map((m) => `/moments/${m.slug}`),
  '/for/astrologers',
  '/for/architects',
  '/for/dentists',
  '/for/sports-turf',
  '/for/coworking-spaces',
  '/for/driving-schools',
  '/for/conference-halls',
  '/for/photo-studios',
  '/for/coaches',
  '/for/content-creators',
  '/for/educators',
  '/for/musicians',
  '/for/language-teachers',
  '/for/lawyers',
  '/for/chartered-accountants',
  '/for/doctors',
  '/for/therapists',
  '/for/yoga-instructors',
  '/for/business-consultant',
  '/for/pediatricians',
  '/for/gynecologists',
  '/for/dermatologists',
  '/for/physiotherapists',
  '/for/ent-specialists',
  '/for/ophthalmologists',
  '/for/nutritionists',
  '/for/life-coaches',
  '/for/spa',
  '/for/veterinarians',
  '/for/salon',
  '/for/freelancers',
  '/for/fitness',
  '/for/tutors',
  '/for/photographers',
  '/for/events',
  '/for/agencies',
  '/compare/calendly-alternative',
  '/compare/topmate-alternative',
  '/compare/setmore-alternative',
  '/compare/acuity-alternative',
  '/compare/simplybook-alternative',
  '/compare/zoho-bookings-alternative',
  ...FEATURES.map((f) => `/features/${f.slug}`),
];

/**
 * Blog posts live in the DB, so their routes can't be a static list — ask the
 * same public API the SPA uses.
 *
 * On Vercel an unreachable API is FATAL. This function is fail-open by nature,
 * and a silent fallback there would ship a "successful" deploy that quietly
 * dropped every blog post from the prerender — the exact failure we spent a night
 * chasing, wearing a green tick. Locally it stays a warning: a dev without the API
 * running still wants a build.
 */
// Fetch with a few retries + backoff. A single transient hiccup (a rate-limit
// 429, a network blip, a cold API) at build time otherwise fails the WHOLE Vercel
// deploy, because the blog/sitemap fetches are fatal on Vercel. Retrying turns a
// blip into a self-heal; a genuinely-down API still throws after the last attempt.
async function fetchWithRetry(url, { attempts = 3, timeoutMs = 15000 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        const backoff = 1500 * i;
        console.warn(`[prerender] ${url} failed (${err.message}); retry ${i}/${attempts - 1} in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastErr;
}

async function blogRoutes() {
  // This is a standalone node process, so Vite has not put .env into process.env
  // for us — loadEnv reads the .env files AND real env vars (how Vercel sets it).
  const env = loadEnv(process.env.NODE_ENV || 'production', join(__dirname, '..'), '');
  const base = (env.VITE_API_URL || process.env.VITE_API_URL || '').replace(/\/+$/, '');
  if (!base) {
    if (process.env.VERCEL) throw new Error('VITE_API_URL unset — cannot resolve blog posts');
    console.warn('[prerender] VITE_API_URL unset — skipping blog posts');
    return [];
  }
  try {
    const res = await fetchWithRetry(`${base}/blogs`);
    const { posts } = await res.json();
    const routes = (posts || []).map((p) => p && p.slug).filter(Boolean).map((s) => `/blog/${s}`);
    console.log(`[prerender] ${routes.length} blog posts from ${base}`);

    // A published post without its generated card ships the generic site-wide
    // og:image — invisible to humans, identical to a good deploy in the logs,
    // and exactly how the two 2026-07-18 posts went out with the wrong card.
    // Same philosophy as the render-failure guard below: fail the PROD build
    // loudly with the fix in the message, warn-only everywhere else.
    const missingCards = (posts || []).filter((p) => p && p.slug && !p.ogImage).map((p) => p.slug);
    if (missingCards.length > 0) {
      const msg = `${missingCards.length} published post(s) have no og_image card: ${missingCards.join(', ')}. ` +
        'Run `npm run build:no-prerender && node --env-file=../server/.env.production scripts/generateBlogOgImages.mjs`, then redeploy.';
      if (process.env.VERCEL) throw new Error(msg);
      console.warn(`[prerender] WARNING: ${msg}`);
    }
    return routes;
  } catch (err) {
    if (process.env.VERCEL) throw new Error(`blog posts unresolvable (${err.message})`);
    console.warn(`[prerender] blog posts skipped (${err.message}) — static routes still render`);
    return [];
  }
}

/**
 * Host profiles (/:username) and service pages (/:username/:slug) live in the DB
 * and vastly outnumber the static marketing routes, so — like blog posts — their
 * routes can't be a hardcoded list. They ARE already enumerated by the public
 * sitemap (root-mounted on the same Express server, NOT under /api), which applies
 * the exact indexability rules we want: only verified, non-banned, is_indexable
 * hosts/services appear. Reusing it means the prerender list stays in lockstep with
 * what we tell Google to crawl — a banned or de-indexed host silently drops from
 * both at once — and we add zero new server surface.
 *
 * We fetch the sitemap INDEX, pick the host + service sub-sitemaps (handles their
 * pagination for free), then pull every <loc> and reduce it to a path. Same
 * fail-open/closed posture as blogRoutes(): on Vercel an unreachable/broken sitemap
 * is FATAL (shipping a "green" build that quietly dropped the entire product
 * catalog from prerender is the exact trap we keep falling into), a warning locally.
 */
async function hostServiceRoutes() {
  const env = loadEnv(process.env.NODE_ENV || 'production', join(__dirname, '..'), '');
  const apiBase = (env.VITE_API_URL || process.env.VITE_API_URL || '').replace(/\/+$/, '');
  if (!apiBase) {
    if (process.env.VERCEL) throw new Error('VITE_API_URL unset — cannot resolve host/service routes');
    console.warn('[prerender] VITE_API_URL unset — skipping host/service routes');
    return [];
  }
  // Sitemaps are root-mounted (server.js: `app.use(sitemapRoutes)`, no /api), so
  // strip the /api segment VITE_API_URL carries for the JSON endpoints.
  const origin = apiBase.replace(/\/api$/, '');
  const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  try {
    const indexRes = await fetchWithRetry(`${origin}/sitemap.xml`);
    // Host + service + profession sub-sitemaps; pages/blog are handled by
    // PRERENDER_ROUTES + blogRoutes already. Professions (/services/:slug) are
    // DB-driven and can't be a hardcoded list — without prerender they shipped an
    // empty SPA shell to Google (soft_404) for all 47 sitemap URLs. Fetch each by
    // its OWN path off our reachable origin (the <loc> carries the public SITE_URL
    // domain, which may route through Vercel — the path is all we need).
    const subPaths = locs(await indexRes.text())
      .map((u) => new URL(u).pathname)
      .filter((p) => /\/sitemap-(hosts|services|professions)/.test(p));

    const routes = [];
    for (const sub of subPaths) {
      const res = await fetchWithRetry(`${origin}${sub}`);
      for (const u of locs(await res.text())) routes.push(new URL(u).pathname);
    }
    console.log(`[prerender] ${routes.length} host/service routes from ${subPaths.length} sub-sitemap(s)`);
    return routes;
  } catch (err) {
    if (process.env.VERCEL) throw new Error(`host/service routes unresolvable (${err.message})`);
    console.warn(`[prerender] host/service routes skipped (${err.message}) — static routes still render`);
    return [];
  }
}

/**
 * Vercel's build image ships no Chrome and none of its system libraries, so a
 * downloaded Chrome installs fine and then dies on launch:
 *
 *   Failed to launch the browser process: Code: 127
 *   chrome: error while loading shared libraries: libnspr4.so: cannot open shared object file
 *
 * That is why the prerender silently produced nothing there for weeks, and no
 * amount of fixing the *download* helped. @sparticuz/chromium is a Chromium build
 * that carries its own libraries and points LD_LIBRARY_PATH at them, which is the
 * standard answer for this environment. Pinned to 148 to match puppeteer's own
 * Chrome major — a protocol mismatch between the two is a genuinely confusing bug.
 *
 * Locally we use puppeteer's normal Chrome: sparticuz ships a Linux binary and is
 * useless on a dev machine.
 */
async function launchOptions() {
  if (!process.env.VERCEL) {
    return { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  }
  const chromium = (await import('@sparticuz/chromium')).default;
  const executablePath = await chromium.executablePath();
  console.log(`[prerender] Vercel — @sparticuz/chromium at ${executablePath}`);
  return { args: chromium.args, executablePath, headless: chromium.headless };
}

function createStaticServer() {
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
    '.txt': 'text/plain',
  };

  // SPA fallback is the BARE shell (spa-shell.html), never dist/index.html:
  // once the '/' route has rendered, index.html is the full homepage with its
  // JSON-LD baked in — and every route rendered after it through that fallback
  // captured the homepage's SoftwareApplication/WebSite blocks alongside its
  // own (found by the 2026-07-19 rich-results validation, live on all 67
  // prerendered pages). Seo.jsx can't remove them: it only cleans up nodes it
  // created at runtime, not ones baked into the served HTML.
  // Every page pulls the same JS/CSS chunks; a sync disk read per request (4 tabs
  // × ~30 assets × ~300 pages) blocks the event loop that also answers the
  // request interception. Read each file once. This also keeps '/' (and a deferred
  // retry of it) rendering from the BARE index.html, not the homepage the first
  // pass already wrote over it.
  const files = new Map();
  const read = (p) => {
    if (!files.has(p)) files.set(p, readFileSync(p));
    return files.get(p);
  };

  return createServer((req, res) => {
    let filePath = join(DIST, req.url === '/' ? 'index.html' : req.url);

    if (!existsSync(filePath)) {
      filePath = join(DIST, 'spa-shell.html');
    }

    const ext = '.' + filePath.split('.').pop();
    const contentType = mime[ext] || 'application/octet-stream';

    try {
      const content = read(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      const fallback = readFileSync(join(DIST, 'spa-shell.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fallback);
    }
  });
}

async function prerender() {
  const puppeteer = await import('puppeteer');

  // Dedup: professions sub-sitemap also carries the /services root already in PRERENDER_ROUTES.
  const routes = [...new Set([...PRERENDER_ROUTES, ...(await blogRoutes()), ...(await hostServiceRoutes())])];

  // The app's absolute API base (…/api). Prerender runs on localhost:4173, which
  // the API's CORS allowlist rejects, so every in-browser fetch (getBlogBySlug,
  // getProfessionServices) is blocked → the page bakes its notfound/error fallback
  // (blog posts redirected to /blog, poisoning the canonical of all 8 posts). We
  // proxy those calls through node (no CORS) below so real content renders.
  const buildEnv = loadEnv(process.env.NODE_ENV || 'production', join(__dirname, '..'), '');
  const API_BASE = (buildEnv.VITE_API_URL || process.env.VITE_API_URL || '').replace(/\/+$/, '');

  // Shared secret that tells the API's ipGuard "this is the trusted build runner —
  // don't rate-ban it" (server/middleware/ipGuard.js isPrerenderBuild). Without it,
  // baking the ~168 host/service/profession pages bursts the API from one IP, trips
  // the 100/min limiter, auto-bans the build IP, and every dynamic page ships as the
  // bare SPA shell (soft_404). NOT a VITE_ var — build/server only, never bundled.
  const PRERENDER_TOKEN = buildEnv.PRERENDER_BUILD_TOKEN || process.env.PRERENDER_BUILD_TOKEN || '';
  console.log(`[prerender] build token: ${PRERENDER_TOKEN
    ? 'configured'
    : 'MISSING — dynamic pages may self-ban; set PRERENDER_BUILD_TOKEN on the build env (must match the API server)'}`);

  // Critical CSS: inline the rules each snapshot's DOM actually uses and load the
  // full stylesheet non-blocking (media="print" → onload swap, <noscript> fallback).
  // The 38 KiB index CSS was ~33 KiB unused on the homepage and blocked first paint
  // ~1s on mobile Lighthouse. Only prerendered pages get this — spa-shell.html and
  // non-prerendered routes keep the normal blocking <link>. NOTE: the onload swap is
  // an inline handler; an enforced CSP without 'unsafe-inline' in script-src would
  // strand the full CSS at media="print" (CSP is report-only + unsafe-inline today).
  const { default: Beasties } = await import('beasties');
  const beasties = new Beasties({ path: DIST, publicPath: '/', preload: 'media', inlineFonts: true, logLevel: 'warn' });
  // SERIALIZED on purpose: beasties is not safe for concurrent process() calls —
  // with the pool rendering 4 pages at once, pages got ANOTHER page's critical CSS
  // (prod homepage shipped /pricing's: no hero rules → unstyled first paint).
  // Separate instances don't help (shared state). ~250 ms/page, overlaps with
  // the other workers' browser time.
  let beastiesQueue = Promise.resolve();
  const inlineCritical = (html) => {
    const run = beastiesQueue.then(() => beasties.process(html)).catch((e) => {
      console.warn(`[prerender] critical CSS skipped: ${e.message}`);
      return html;
    });
    beastiesQueue = run;
    return run;
  };

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[prerender] Static server on ${ORIGIN}`);

  const browser = await puppeteer.default.launch(await launchOptions());

  let rendered = 0;
  let failed = 0;
  const errorBaked = []; // routes whose render came back as the branded ErrorPage
  const skipped = []; // routes not started because the time budget ran out

  // Build-scoped cache of proxied API GETs. ~300 pages ask for the same plans /
  // categories / stats over and over (~800 fetches a run, the load that used to
  // rate-ban the build IP); the data can't meaningfully change inside one build.
  // Only successes are kept, so a failed call is refetched by the next page.
  // Never baked into #__bas_data: slot/availability answers must be live. Matched
  // by endpoint, not substring — /slot/ also hits every "book-a-SLOTH" slug.
  const LIVE_ONLY_API = /^\/bookings\/|\/availability(\/|\?|$)/;
  const apiCache = new Map(); // url → Promise<{ status, contentType, body }>
  const fetchApi = (url) => {
    if (!apiCache.has(url)) {
      const t0 = Date.now();
      const p = fetch(url, {
        signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
        headers: {
          Accept: 'application/json',
          // Identify this as the trusted build runner so ipGuard won't rate-ban
          // the burst (server/middleware/ipGuard.js isPrerenderBuild).
          ...(PRERENDER_TOKEN ? { 'x-prerender-token': PRERENDER_TOKEN } : {}),
        },
      }).then(async (r) => {
        const out = { status: r.status, contentType: r.headers.get('content-type') || 'application/json', body: Buffer.from(await r.arrayBuffer()) };
        if (!r.ok) apiCache.delete(url);
        // Diagnostics: the 2026-10-10 builds stalled on API-backed pages only on
        // Vercel's builder, never locally. Name the slow/failing calls in the log.
        const ms = Date.now() - t0;
        if (ms > 3000 || !r.ok) console.warn(`[prerender] api ${r.status} ${ms}ms ${url.replace(API_BASE, '')}`);
        return out;
      });
      p.catch((err) => {
        apiCache.delete(url);
        console.warn(`[prerender] api FAILED ${Date.now() - t0}ms ${url.replace(API_BASE, '')}: ${err.message}`);
      });
      apiCache.set(url, p);
    }
    return apiCache.get(url);
  };

  const renderOnce = async (route, navTimeout = NAV_TIMEOUT_MS) => {
    const page = await browser.newPage();
    try {
      // Block analytics/tracking requests — avoids phantom pageviews and speeds up render
      await page.setRequestInterception(true);
      // In-flight requests, so a nav timeout can say what it was waiting on.
      // Per-URL counts too: a page can also miss networkidle0 by never going quiet
      // for 500ms (polling / retry loops) with nothing actually hanging.
      const inFlight = new Map();
      const seen = new Map();
      // API path → JSON body served to THIS page; baked into the HTML as
      // #__bas_data so the page's first client render has its data (see
      // src/services/prerenderData.js). Live-only data (slots/availability) skipped.
      const served = {};
      page.on('requestfinished', (req) => {
        // Any single request this slow is a third party stalling the build — name it.
        const ms = Date.now() - (inFlight.get(req) || Date.now());
        if (ms > 5000) console.warn(`[prerender] slow ${req.resourceType()} ${ms}ms on ${route}: ${req.url().slice(0, 120)}`);
        inFlight.delete(req);
      });
      page.on('requestfailed', (req) => inFlight.delete(req));
      page.on('request', async (req) => {
        const url = req.url();
        inFlight.set(req, Date.now());
        const k = url.split('?')[0].slice(0, 100);
        seen.set(k, (seen.get(k) || 0) + 1);
        if (url.includes('posthog') || url.includes('clarity') || url.includes('google-analytics') || url.includes('facebook')) {
          return req.abort();
        }
        const type = req.resourceType();
        if (type === 'image') return req.respond({ status: 200, contentType: 'image/gif', body: BLANK_GIF });
        if (type === 'font' || type === 'media') return req.respond({ status: 200, body: '' });
        // Preloader greeting fonts (fontLoader.js: 11 Noto subsets per page) —
        // stripped from the baked HTML anyway (see data-preloader-font below), and
        // from Vercel's builder these Google requests were taking ~30s on 2026-10-10,
        // holding every host profile page past the nav timeout. Answer instantly.
        if (url.startsWith('https://fonts.googleapis.com/')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
        // Proxy the app's API through node (no CORS) so data-driven pages render
        // real content instead of their CORS-blocked notfound fallback. GET-only:
        // prerendered pages never POST. ponytail: on any proxy error, fall back to
        // the browser's own (blocked) request — no worse than before this fix.
        if (API_BASE && url.startsWith(API_BASE) && req.method() === 'GET') {
          try {
            const r = await fetchApi(url);
            const path = url.slice(API_BASE.length);
            if (r.status === 200 && r.contentType.includes('json') && !LIVE_ONLY_API.test(path)) {
              try { served[path] = JSON.parse(r.body.toString('utf-8')); } catch { /* not JSON after all */ }
            }
            return req.respond({
              status: r.status,
              headers: { 'content-type': r.contentType, 'access-control-allow-origin': '*' },
              body: r.body,
            });
          } catch {
            return req.continue();
          }
        }
        return req.continue();
      });

      try {
        await page.goto(`${ORIGIN}${route}`, { waitUntil: 'networkidle0', timeout: navTimeout });
      } catch (err) {
        const now = Date.now();
        const open = [...inFlight].map(([r, t]) => `${r.resourceType()} ${Math.round((now - t) / 1000)}s ${r.url().slice(0, 120)}`);
        const total = [...seen.values()].reduce((a, b) => a + b, 0);
        const top = [...seen].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u, n]) => `${n}x ${u}`);
        err.message += (open.length ? ` | still open: ${open.join(' ; ')}` : ' | nothing in flight')
          + ` | ${total} requests, most repeated: ${top.join(' ; ')}`;
        throw err;
      }

      // Wait for Seo.jsx useEffect to fire (title changes from default)
      await page.waitForFunction(
        (defaultTitle) => document.title !== defaultTitle,
        { timeout: 3000 },
        DEFAULT_TITLE,
      ).catch(() => {
        // Some pages keep default title — that's fine
      });

      // NOTE: a fail-loud "empty render" guard for /blog and /services lived here
      // (#979) but was reverted — the prerender build's own IP gets rate-limited by
      // the API after the ~800 fetches a full run makes, so /services (rendered
      // last) fetched empty and the guard hard-failed EVERY build, freezing all
      // deploys. Re-add only alongside a build-fetch reliability fix (proxy
      // retry/backoff, throttle, or a build-IP allowlist on the API). See #979.

      // Strip runtime-injected external scripts (PostHog, analytics, etc.)
      // that got captured during render — they'll reload on hydration anyway.
      // `<` escaped so a "</script>" inside any string can't close the tag early.
      const seed = JSON.stringify(served).replace(/</g, '\\u003c');
      if (seed.length > 300_000) console.warn(`[prerender] ${route}: __bas_data is ${Math.round(seed.length / 1024)} KB`);
      await page.evaluate((seedJson) => {
        document.querySelectorAll('script[src*="posthog"], script[src*="clarity"], script[src*="google"]').forEach(el => el.remove());
        const s = document.createElement('script');
        s.type = 'application/json';
        s.id = '__bas_data';
        s.textContent = seedJson;
        document.head.appendChild(s);
        // fontLoader.js injects the preloader greeting subsets as media="print"
        // (non-blocking) and flips them to media="all" once loaded. By snapshot
        // time they are "all", so serializing baked ~12 render-blocking Google
        // Fonts stylesheets into every static page (~1.2s of blocked render).
        // They re-inject on hydration, so dropping them here is lossless.
        document.querySelectorAll('link[data-preloader-font]').forEach(el => el.remove());
      }, seed);

      const html = await page.content();

      // A page whose data fetch failed mid-render shows the branded ErrorPage
      // (ErrorLayout's root .bas-error). Serializing THAT bakes a permanent 500
      // for a route the sitemap says is live — real users load fine, but crawlers
      // only ever see the frozen error and mark it soft-404 (the service-page
      // soft_404 cluster). Refuse to bake it: throw so the pool defers it to the
      // serial pass (a transient build-fetch blip usually clears on the idle
      // retry); a persistent one is handled after the loop — the poisoned file is
      // never written either way, so the route serves its live fallback, not a 500.
      if (/class="[^"]*\bbas-error\b/.test(html)) {
        const e = new Error('rendered the branded ErrorPage (build-time data fetch failed) — not baking a 500');
        e.errorBake = true;
        throw e;
      }

      // Write to dist/<route>/index.html (or dist/index.html for /)
      let outPath;
      if (route === '/') {
        outPath = join(DIST, 'index.html');
      } else {
        const dir = join(DIST, route.slice(1));
        mkdirSync(dir, { recursive: true });
        outPath = join(dir, 'index.html');
      }

      writeFileSync(outPath, await inlineCritical(html), 'utf-8');
      return outPath;
    } finally {
      // Always close, including on a timeout — an orphaned page holds memory for
      // the rest of the run, and there are 77 of them.
      await page.close().catch(() => {});
    }
  };

  // First pass, 4-wide. Routes are independent and most of a route's wall clock
  // is `networkidle0` waiting on its own requests — overlapped across a pool that
  // wait mostly disappears. NO in-place retry: a timeout here is almost always
  // the 4 tabs saturating the ~4-vCPU builder (and/or a backend the page fetches
  // from being cold), and an immediate retry just re-enters the same jam — which
  // is exactly how a run of adjacent /lp/ routes failed a deploy. Defer the
  // stragglers to the serial pass below instead.
  // ponytail: fixed pool of 4, sized for the ~4-vCPU Vercel builder — lower it
  // first if prerender starts OOMing there, raise it if the builder grows.
  const POOL = 4;
  const deferred = [];
  const queue = [...routes];
  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (queue.length > 0) {
        if (overBudget()) {
          skipped.push(...queue.splice(0));
          break;
        }
        const route = queue.shift();
        try {
          const outPath = await renderOnce(route);
          rendered++;
          console.log(`[prerender] ${route} → ${outPath.replace(DIST, 'dist')}`);
        } catch (err) {
          console.warn(`[prerender] defer ${route}: ${err.message}`);
          deferred.push(route);
        }
      }
    }),
  );

  // Second pass: the deferred stragglers, one at a time on a now-idle builder
  // (pool drained, any cold backend long since warm) with a longer timeout.
  // Usually empty. A route that fails HERE is a real, reproducible failure and
  // stops the release. Counters stay exact: one event loop, no data races.
  if (deferred.length > 0) {
    console.log(`[prerender] serial retry of ${deferred.length} deferred: ${deferred.join(', ')}`);
    for (const route of deferred) {
      if (overBudget()) {
        skipped.push(route);
        continue;
      }
      try {
        const outPath = await renderOnce(route, RETRY_TIMEOUT_MS);
        rendered++;
        console.log(`[prerender] ${route} → ${outPath.replace(DIST, 'dist')} (deferred retry)`);
      } catch (err) {
        if (err.errorBake) {
          // Persistent error-bake: leave it UNBAKED (no file written) so the route
          // serves its live fallback instead of a frozen 500. Not counted as a hard
          // render failure — see the reverted empty-content guard (#979) that froze
          // every deploy; we do not repeat that unless explicitly opted in below.
          errorBaked.push(route);
          console.error(`[prerender] ERROR-BAKE ${route}: left unbaked (would have shipped a 500)`);
        } else {
          failed++;
          console.error(`[prerender] FAIL ${route}: ${err.message}`);
        }
      }
    }
  }

  await browser.close();
  server.close();

  const mins = ((Date.now() - STARTED_AT) / 60000).toFixed(1);
  console.log(`[prerender] Done in ${mins} min: ${rendered} rendered, ${failed} failed, ${errorBaked.length} error-baked, ${skipped.length} over budget (${routes.length} routes, ${apiCache.size} distinct API calls)`);

  // Over budget is NOT a failure: those routes serve the SPA fallback until the
  // next deploy, which beats Vercel killing the whole build at 45 min. Loud, so a
  // budget that is routinely hit gets noticed (move the build off Vercel's clock).
  if (skipped.length > 0) {
    console.error(`[prerender] TIME BUDGET (${BUDGET_MS / 60000} min) hit — ${skipped.length} route(s) left unbaked: ${skipped.join(', ')}`);
  }

  // Routes that came back as the ErrorPage were NOT written, so they fall back to
  // the live page instead of shipping a frozen 500 to crawlers. Surface them loudly
  // (this is how the soft_404 cluster hid for weeks). Opt in to hard-failing the
  // build on them with PRERENDER_FAIL_ON_ERROR_BAKE=1 once build-fetch is reliable.
  if (errorBaked.length > 0) {
    console.error(`[prerender] ${errorBaked.length} route(s) rendered as the ErrorPage and were left unbaked (serving live fallback): ${errorBaked.join(', ')}`);
    if (process.env.PRERENDER_FAIL_ON_ERROR_BAKE === '1') {
      console.error('[prerender] FAILED: PRERENDER_FAIL_ON_ERROR_BAKE is set — refusing to ship with error-baked routes.');
      process.exit(1);
    }
  }

  // A route that failed to render ships as the bare SPA shell: 200 OK, no title,
  // no og:image, no JSON-LD. Crawlers and WhatsApp see nothing. That is invisible
  // to humans and is precisely how this went unnoticed for weeks, so it fails the
  // build rather than deploying quietly.
  //
  // Deliberately NOT a check for exactly 77: the count is 43 static + however many
  // posts are published, so it moves every time you publish. "Nothing failed" is
  // the invariant that actually matters and it does not need maintaining.
  if (failed > 0) {
    console.error(`[prerender] FAILED: ${failed} of ${routes.length} route(s) did not render — refusing to ship a partially-rendered build.`);
    process.exit(1);
  }
}

prerender().catch((err) => {
  console.error('[prerender] FAILED:', err.message);
  process.exit(1);
});
