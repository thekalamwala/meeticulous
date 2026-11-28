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
//     (e.g. https://<your-api>.onrender.com). Falls back to the live API origin.
//
// Fail-open: any error simply continues to the SPA.

import { RESERVED_FIRST_SEGMENTS } from './src/config/reservedSegments.js';
import { VANITY_SLUGS, VANITY_TARGET } from './src/config/vanityRedirects.js';

const API_ORIGIN = process.env.API_ORIGIN || 'https://meeticulous-api.onrender.com';

const SKIP = new Set(RESERVED_FIRST_SEGMENTS);

// Branded profile-404 card. Inlined here because the Vercel edge bundle can't
// import server/utils/brandPage.js (different runtime) — keep this visually in
// sync with brandPage.js by hand.
export function renderProfile404Html(rawSlug) {
  const slug = String(rawSlug).replace(/[^a-z0-9._-]/g, '');
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>No host at this address · Meeticulous</title>` +
    `<meta name="robots" content="noindex">` +
    `<link rel="preconnect" href="https://fonts.googleapis.com">` +
    `<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">` +
    `<style>` +
    `:root{--orange:#FE5100;--ink:#141416;--muted:#5b5b62;--bg:#fff;--card:#fff;--line:#ececec}` +
    `*{box-sizing:border-box}html,body{margin:0;height:100%}` +
    `body{background:var(--bg);color:var(--ink);font-family:'Poppins',system-ui,sans-serif;display:grid;place-items:center;padding:24px}` +
    `.card{background:var(--card);border:1px solid var(--line);border-radius:16px;max-width:460px;width:100%;padding:40px 32px;text-align:center;box-shadow:0 10px 40px rgba(20,20,22,.06)}` +
    `h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:24px;line-height:1.2;margin:0 0 12px}` +
    `p{color:var(--muted);font-size:15px;line-height:1.6;margin:0 0 28px}` +
    `a.btn{display:inline-block;background:var(--orange);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:12px}` +
    // Always white — the white-bg error art would box out on a dark card.
    `</style></head>` +
    `<body><main class="card">` +
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

// Community crawlers: Googlebot/Bing included HERE ONLY (see the /community branch in route()).
const SEARCH_BOT_RE = /Googlebot|bingbot/i;

// passStatus (community only): hand crawlers the prerender's real 301/404/410 instead of
// falling through to the 200 SPA shell, and don't follow the 301 (redirect: 'manual') —
// following it would fetch the public page and serve that as "prerender" HTML. Profiles keep
// the old behaviour (non-200 -> null -> SPA / username resolver).
async function fetchPrerender(pathname, { passStatus = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${API_ORIGIN}/prerender${pathname}`, {
      headers: { accept: 'text/html' },
      signal: controller.signal,
      ...(passStatus ? { redirect: 'manual' } : {}),
    });
    if (passStatus && [301, 404, 410].includes(res.status)) {
      const headers = { 'Cache-Control': res.headers.get('cache-control') || 'public, max-age=60', 'X-Prerender': 'true' };
      if (res.status === 301) {
        const location = res.headers.get('location');
        return location ? new Response(null, { status: 301, headers: { ...headers, Location: location } }) : null;
      }
      return new Response(await res.text(), { status: res.status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
    }
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

// ── Pricing country cookie ──────────────────────────────────────────────────
// The API lives on Render and never sees Vercel's geo header, so the edge hands
// the visitor's country to the SPA as `mt_cc` (read by src/lib/pricingRegion.js
// to show INR vs USD Pro pricing). Display only — never trusted for charging.
// Set only when the request continues to the SPA, and only when it changed.
function withCountryCookie(request) {
  const cc = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return;
  if ((request.headers.get('cookie') || '').includes(`mt_cc=${cc}`)) return;
  return new Response(null, {
    headers: {
      'x-middleware-next': '1',
      'set-cookie': `mt_cc=${cc}; Path=/; Max-Age=86400; SameSite=Lax; Secure`,
    },
  });
}

export default async function middleware(request) {
  return (await route(request)) ?? withCountryCookie(request);
}

async function route(request) {
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

  // ── Community: crawlers get server HTML, Googlebot included ──────────────
  // Unlike profiles, Googlebot/bingbot are routed here too: community posts are created
  // after deploy, so build-time prerender can't cover them, and the server HTML carries
  // the same content a person sees (title, body, author, replies) — dynamic rendering,
  // not cloaking. Runs before the SKIP/bot logic below ('community' is in SKIP).
  // Prerender failure (timeout/5xx) falls through to the SPA.
  if (segments[0] === 'community') {
    const ua = request.headers.get('user-agent') || '';
    if (BOT_UA_RE.test(ua) || SEARCH_BOT_RE.test(ua)) {
      const prerenderResponse = await fetchPrerender(url.pathname, { passStatus: true });
      if (prerenderResponse) return prerenderResponse;
    }
  }

  const first = (segments[0] || '').toLowerCase();
  const hostPath = segments.length >= 1 && !SKIP.has(first);
  const ua = request.headers.get('user-agent') || '';
  const bot = BOT_UA_RE.test(ua);
  const crawler = bot || SEARCH_BOT_RE.test(ua);

  // ── Old catalog URLs → the canonical slug URL in ONE hop ──────────────────
  // /:username/product|course/:key (key = slug, old id or legacy slug; username
  // may be a renamed one): the prerender endpoint resolves all of it and answers
  // a 301 straight to /:current/products|courses/<slug>. The query is kept
  // (emailed ?dl= links). If the API is unreachable, fall back to the plain path
  // rewrite (the page then finishes the job); a 404 is passed to crawlers only.
  if (hostPath && segments.length === 3 && (segments[1] === 'product' || segments[1] === 'course')) {
    const resolved = await fetchPrerender(url.pathname, { passStatus: true });
    if (resolved && resolved.status === 301) return withSearch(resolved, url.search);
    if (resolved && resolved.status === 404 && crawler) return resolved;
    url.pathname = `/${segments[0]}/${segments[1]}s/${segments[2]}`;
    return Response.redirect(url.toString(), 301);
  }

  // ── Renamed host: crawlers get ONE 301 for everything under the profile ───
  // /old/<service>, /old/products|courses/<slug>, /old/membership … → /new/…
  // (the single-segment profile is handled below, for everyone). People are
  // redirected by the SPA (RenamedHostRedirect / HostProfile), which avoids an
  // extra API round trip on every human page view.
  if (hostPath && segments.length >= 2 && crawler) {
    const r = await resolveUsername(first);
    if (r && r.found && r.current && r.current.toLowerCase() !== first) {
      url.pathname = `/${[r.current, ...segments.slice(1)].join('/')}`;
      return Response.redirect(url.toString(), 301);
    }
  }

  // ── Catalog items: /:username/products|courses/:slug ──────────────────────
  // On the new URLs crawlers get the prerender's real status: social/AI bots the
  // shell (or its 301/404); Googlebot/bingbot ONLY a 301/404 — a 200 falls
  // through to the baked page.
  if (hostPath && segments.length === 3 && (segments[1] === 'products' || segments[1] === 'courses')) {
    if (crawler) {
      const prerenderResponse = await fetchPrerender(url.pathname, { passStatus: true });
      if (prerenderResponse && (bot || prerenderResponse.status !== 200)) return prerenderResponse;
    }
    return;
  }

  // ── Bot prerender for dynamic profile/service routes ──────────────────────
  // /:username (1 segment, not a reserved route)
  // /:username/:serviceSlug (2 segments, not a reserved route)
  if (bot && hostPath && segments.length <= 2) {
    const prerenderResponse = await fetchPrerender(url.pathname);
    if (prerenderResponse) return prerenderResponse;
    // Fall through to SPA on prerender failure
  }

  // ── Username redirect (human + bot traffic) ───────────────────────────────
  if (segments.length !== 1 || !hostPath) return;

  const slug = first;
  const r = await resolveUsername(slug);
  if (!r) return; // fail open
  if (r.notFound) {
    // Resolver is explicit: this username never existed. Real 404, noindex —
    // humans get a link out, crawlers drop the URL instead of indexing the
    // 200 homepage shell.
    return new Response(renderProfile404Html(slug), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  }
  if (r.found && r.current && r.current !== slug) {
    url.pathname = `/${r.current}`;
    return Response.redirect(url.toString(), 301);
  }
}

// GET /api/username/resolve/:slug → { found, current } | { notFound: true } | null
// (null = network error / timeout / 5xx: callers fail open).
async function resolveUsername(slug) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${API_ORIGIN}/api/username/resolve/${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// A 301 from the prerender keeps the request's query string (?dl=…).
function withSearch(res, search) {
  const location = res.headers.get('location');
  if (!search || !location || location.includes('?')) return res;
  const headers = new Headers(res.headers);
  headers.set('Location', `${location}${search}`);
  return new Response(null, { status: 301, headers });
}
