/**
 * ipGuard.js — early ban-enforcement + offense-tracking middleware.
 *
 *   ipGuard         : runs near the top of the chain (after trust proxy, before the
 *                     rate limiters). 403s any banned IP in O(1) from the in-memory
 *                     cache. Allowlist-wins is enforced inside ipBlocklist.isBlocked.
 *   offenseTracker  : watches responses; a 429 (rate-limit rejection) feeds the
 *                     general auto-ban counter via res.on('finish').
 *
 * Both are no-ops when the feature is disabled (IP_BLOCK_ENABLED=false) or under
 * load-test mode, and ipGuard fails OPEN on any internal error — a broken blocklist
 * must never take the site down.
 */

const crypto = require('crypto');
const config = require('../config/ipBlockConfig');
const { isLoadTestMode } = require('../config/loadTestMode');
const { isOpenAccess } = require('../config/openAccessWindow');
const { getClientIp } = require('../lib/clientIp');
const ipBlocklist = require('../lib/ipBlocklist');

// Paths that must NEVER be IP-blocked:
//   - the Razorpay webhook is HMAC-verified; a 403 here would silently break
//     payment reconciliation.
//   - the health probe must stay reachable for Render/UptimeRobot.
//   - /sitemap and /api/blogs are public, read-only SEO content that the Vercel
//     prerender fetches at build time; a banned build IP 403ing here fails the
//     whole deploy ("[prerender] blog posts unresolvable (HTTP 403)"). They carry
//     no private data, so exempting them is safe — and offenseTracker skips them
//     too, so the prerender's fetch burst can't auto-ban the build runner IP in
//     the first place (the AWS→Render fetch bypasses Cloudflare, so it has no
//     cf-connecting-ip header and keys on the raw build IP).
const EXEMPT_PREFIXES = ['/api/payment/webhook', '/health', '/prerender', '/sitemap', '/api/blogs'];

// A path is exempt when it equals a prefix OR continues it at a real boundary.
// The boundary set must include '.' and '-' because the actual routes are
// `/sitemap.xml`, `/sitemap-hosts.xml`, `/sitemap-services-2.xml`, … — matching
// only '/' or '?' (the old bug) left EVERY real sitemap file NON-exempt, so a
// banned build IP still 403'd them and killed the deploy.
function isExempt(req) {
  const p = (req && (req.path || req.url)) || '';
  return EXEMPT_PREFIXES.some((e) =>
    p === e || p.startsWith(e + '/') || p.startsWith(e + '.') || p.startsWith(e + '-') || p.startsWith(e + '?'));
}

// GET /api/host/:username and GET /api/host/:username/:slug are the public host
// profile + service detail reads (hostController.getHostProfile / getServiceBySlug)
// — no auth, no private data. Google's Web Rendering Service re-fetches these at
// runtime when it hydrates a prerendered host/service page; if that fetch trips a
// 403 (or 429, see offenseTracker below) the page's WRS render fails and Google
// drops it from search (same failure mode #1006/#1008 fixed client-side for
// transient errors — this closes the server side for these two routes, mirroring
// the existing /api/blogs exemption above).
//
// Deliberately narrower than a blanket '/api/host' prefix: the OTHER routes under
// /api/host/* (search, availability, categories, username, services/:id) are either
// auth-gated dashboard reads or writes and must keep full IP-ban protection, so
// only the two-segment public-detail shape is matched, and only for GET.
const HOST_PUBLIC_READ_RESERVED = new Set(['search', 'availability', 'categories', 'username', 'services']);
function isPublicHostRead(req) {
  if (!req || req.method !== 'GET') return false;
  const p = String((req && (req.path || req.url)) || '').split('?')[0];
  const m = /^\/api\/host\/([^/]+)(?:\/([^/]+))?\/?$/.exec(p);
  return !!m && !HOST_PUBLIC_READ_RESERVED.has(m[1]);
}

// A request carrying a VALID admin JWT is an already-authenticated admin. They
// are still rate-limited (429s are returned), but must never be counted toward
// an auto-ban: the admin panel fires several API calls per page load, so normal
// use could otherwise trip the offense threshold and lock an admin out of their
// own dashboard. Attackers can't forge a valid admin token, and failed logins
// carry no token, so brute-force protection is unaffected. Lazy require so the
// auth service (and its JWT secret) only loads when a 429 actually fires.
function isAuthenticatedAdmin(req) {
  const h = req && req.headers && req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return false;
  try {
    const { jwtVerify } = require('../services/adminAuthService');
    const payload = jwtVerify(h.slice(7));
    return !!payload && payload.type === 'admin';
  } catch (_) {
    return false;
  }
}

// The Vercel prerender build bakes host/service/profession pages by fetching many
// PUBLIC pages fast from ONE IP. That burst 429s the API, offenseTracker auto-bans
// the build IP, and every dynamic page then 403s → renders the branded ErrorPage →
// ships as the bare SPA shell to crawlers (the platform-wide soft_404 we hit).
//
// We CANNOT path-exempt these: the pages read /api/host/:username(/:slug),
// /api/reviews/:username, /api/products/host/:username, /api/services-directory and
// public /api/vendors badges — and /api/host also holds AUTHED writes
// (/api/host/services, /api/host/availability) that must stay ban-enforced. So we
// exempt the BUILD BY IDENTITY, exactly like the admin exemption above: a shared
// secret it sends in `x-prerender-token`, set only on the Vercel build env + this
// server. Unset → no exemption (fails safe to today's behaviour). A timing-safe
// compare, and it never bypasses authMiddleware, so a leaked/guessed token still
// can't write — worst case it lets one IP skip the read-path rate-ban.
function isPrerenderBuild(req) {
  const token = process.env.PRERENDER_BUILD_TOKEN;
  if (!token) return false;
  const sent = req && req.headers && req.headers['x-prerender-token'];
  if (typeof sent !== 'string' || sent.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(token));
  } catch (_) {
    return false;
  }
}

function ipGuard(req, res, next) {
  try {
    if (!config.enabled) return next();
    if (isLoadTestMode()) return next();
    if (isOpenAccess()) return next();  // launch/event window — don't block any IP
    if (isExempt(req) || isPublicHostRead(req)) return next();
    if (isPrerenderBuild(req)) return next();  // trusted build runner — never ban it
    if (ipBlocklist.isBlocked(getClientIp(req))) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    return next();
  } catch (e) {
    // Fail-open.
    console.error('[ipGuard] error (failing open):', e.message);
    return next();
  }
}

function offenseTracker(req, res, next) {
  if (config.enabled && !isLoadTestMode() && !isOpenAccess()) {
    res.on('finish', () => {
      // A 429 means a rate limiter rejected this request → count it toward an
      // auto-ban. Fire-and-forget; the recorder swallows its own errors.
      // Skip exempt paths (sitemap/blogs/health/webhook) and the public host/service
      // detail reads: the prerender build and Google's WRS both burst these, and
      // counting their 429s is exactly what auto-banned the build IP and broke
      // deploys. Authenticated admins and the identified prerender build are
      // exempt too (still rate-limited, never auto-banned).
      if (res.statusCode === 429 && !isExempt(req) && !isPublicHostRead(req)
          && !isAuthenticatedAdmin(req) && !isPrerenderBuild(req)) {
        Promise.resolve(ipBlocklist.recordRateLimitViolation(getClientIp(req))).catch(() => {});
      }
    });
  }
  next();
}

module.exports = { ipGuard, offenseTracker, isExempt, isPublicHostRead, isPrerenderBuild, getClientIp };
