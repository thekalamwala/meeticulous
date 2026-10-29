// Vercel Edge Middleware — three jobs:
//
// 1. BOT PRERENDER: detect social scrapers / non-JS crawlers and proxy them to
//    the server-side /prerender endpoint, which serves a lightweight HTML page
//    with correct <title>, OG tags, canonical, and JSON-LD from the DB. This
//    makes shared links on Twitter/LinkedIn/Slack show real metadata, and gives
//    non-JS search bots actual content.
//
// 2. USERNAME REDIRECT: for OLD/changed usernames, issue a 301 to the current
//    username (like Facebook/GitHub). The SPA can't emit real 301s.
//
// 3. USERNAME 404: a slug the resolver has NEVER seen returns a real 404
//    instead of the 200 SPA shell. Without this every dead/mistyped profile
//    URL is a soft-404 that stays indexed forever (2026-07-19 audit). Only an
//    explicit 404 from the resolver triggers it — network errors still fail
//    open to the SPA. /:username/:slug service URLs are NOT covered (the
//    resolver only knows usernames); acceptable: the profile 404 is the bulk.
//
// Requirements:
//   - Env var API_ORIGIN = your API base WITHOUT trailing /api
//     (e.g. https://book-a-sloth.onrender.com). Falls back to the live API origin.
//
// Fail-open: any error simply continues to the SPA.

import { RESERVED_FIRST_SEGMENTS } from './src/config/reservedSegments.js';
import { VANITY_SLUGS, VANITY_TARGET } from './src/config/vanityRedirects.js';

const API_ORIGIN = process.env.API_ORIGIN || 'https://book-a-sloth.onrender.com';

const SKIP = new Set(RESERVED_FIRST_SEGMENTS);

// Branded profile-404 card. Inlined here because the Vercel edge bundle can't
// import server/utils/brandPage.js (different runtime) — keep this visually in
// sync with brandPage.js by hand. Random detective-sloth variant per request.
const EDGE_ERROR_IMAGES = [
  'https://company-assets.meeticulous.in/images/error/sloth-tracks.png',
  'https://company-assets.meeticulous.in/images/error/sloth-think.png',
  'https://company-assets.meeticulous.in/images/error/sloth-glass.png',
];
export function renderProfile404Html(rawSlug) {
  const slug = String(rawSlug).replace(/[^a-z0-9._-]/g, '');
  const img = EDGE_ERROR_IMAGES[Math.floor(Math.random() * EDGE_ERROR_IMAGES.length)];
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>No host at this address · Book A Sloth</title>` +
    `<meta name="robots" content="noindex">` +
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&family=Poppins:wght@400;500&display=swap" rel="stylesheet">` +
    `<style>` +
    `:root{--orange:#FE5100;--ink:#141416;--muted:#5b5b62;--bg:#fff;--card:#fff;--line:#ececec}` +
    `*{box-sizing:border-box}html,body{margin:0;height:100%}` +
    `body{background:var(--bg);color:var(--ink);font-family:'Poppins',system-ui,sans-serif;display:grid;place-items:center;padding:24px}` +
    `.card{background:var(--card);border:1px solid var(--line);border-radius:16px;max-width:460px;width:100%;padding:40px 32px;text-align:center;box-shadow:0 10px 40px rgba(20,20,22,.06)}` +
    `.hero{width:132px;height:132px;object-fit:contain;margin:0 auto 20px;display:block}` +
    `h1{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:24px;line-height:1.2;margin:0 0 12px}` +
    `p{color:var(--muted);font-size:15px;line-height:1.6;margin:0 0 28px}` +
    `a.btn{display:inline-block;background:var(--orange);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:12px}` +
    // Always white — the white-bg sloth art would box out on a dark card.
    `</style></head>` +
    `<body><main class="card">` +
    `<img class="hero" src="${img}" alt="" width="132" height="132">` +
    `<h1>No host at this address</h1>` +
    `<p>We couldn't track anyone down at <strong>/${slug}</strong>. The link may be mistyped, or the profile has moved on.</p>` +
    `<a class="btn" href="https://meeticulous.com/explore">Explore hosts</a>` +
    `</main></body></html>`
  );
}

// Bot User-Agent patterns — social scrapers + major non-JS crawlers.
// Intentionally does NOT include Googlebot (renders JS fine) to avoid
// double-serving and cache-busting for the world's most important crawler.
const BOT_UA_RE = /Twitterbot|facebookexternalhit|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|PinterestBot|Embedly|Quora Link Preview|Showyoubot|outbrain|vkShare|W3C_Validator|Baiduspider\/render|Sogou|YandexBot|PerplexityBot|ClaudeBot|GPTBot|Google-Extended|ia_archiver/i;

export const config = {
  matcher: ['/((?!api/|assets/|_next/|favicon|.*\\.).*)'],
};

function isBot(request) {
  const ua = request.headers.get('user-agent') || '';
  return BOT_UA_RE.test(ua);
}

async function fetchPrerender(pathname) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${API_ORIGIN}/prerender${pathname}`, {
      headers: { accept: 'text/html' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120, s-maxage=300',
        'X-Prerender': 'true',
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);

  // ── Vanity easter-egg slugs → canonical profile ───────────────────────────
  // A real edge redirect (humans + bots), BEFORE the resolver — otherwise these
  // 404 like any unknown username and the SPA never boots. The in-app HostProfile
  // redirect only covers client-side navigation; this covers direct hits/shares.
  // 302 (not 301): the target is a config value that may change, so don't let
  // browsers cache it permanently.
  if (segments.length === 1 && VANITY_SLUGS.has(segments[0].toLowerCase())) {
    url.pathname = `/${VANITY_TARGET}`;
    return Response.redirect(url.toString(), 302);
  }

  // ── Bot prerender for dynamic profile/service routes ──────────────────────
  // /:username (1 segment, not a reserved route)
  // /:username/:serviceSlug (2 segments, not a reserved route)
  if (isBot(request) && segments.length >= 1 && segments.length <= 2) {
    const first = segments[0].toLowerCase();
    if (!SKIP.has(first)) {
      const prerenderResponse = await fetchPrerender(url.pathname);
      if (prerenderResponse) return prerenderResponse;
      // Fall through to SPA on prerender failure
    }
  }

  // ── Username redirect (human + bot traffic) ───────────────────────────────
  if (segments.length !== 1) return;

  const slug = segments[0].toLowerCase();
  if (SKIP.has(slug)) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    let res;
    try {
      res = await fetch(`${API_ORIGIN}/api/username/resolve/${encodeURIComponent(slug)}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (res.status === 404) {
      // Resolver is explicit: this username never existed. Real 404, noindex —
      // humans get a link out, crawlers drop the URL instead of indexing the
      // 200 homepage shell.
      return new Response(renderProfile404Html(slug), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });
    }
    if (!res.ok) return;
    const data = await res.json();
    if (data.found && data.current && data.current !== slug) {
      url.pathname = `/${data.current}`;
      return Response.redirect(url.toString(), 301);
    }
  } catch (_) {
    // fail open
  }
}
