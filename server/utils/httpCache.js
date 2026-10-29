/**
 * httpCache.js — set Cache-Control on public, anonymous, cacheable GET
 * responses. Only call this on success payloads that contain NO per-user data.
 *
 * `max-age`   — browsers cache repeat views for TTL (immediate win; the API is
 *               served direct from Render today, so this is the effect that
 *               actually lands right now).
 * `s-maxage`  — shared/CDN caches (Vercel edge, Cloudflare) honor this. No CDN
 *               fronts /api yet, so it's future-proofing: the day one is added,
 *               these endpoints are already cacheable at the edge.
 * `stale-while-revalidate` — a shared cache may serve slightly-stale content
 *               while it refreshes in the background, so a TTL expiry never
 *               blocks a request on origin.
 *
 * Express already emits a weak ETag for JSON bodies, so conditional revalidation
 * (304 Not Modified) works alongside this for free.
 */
function setPublicCache(res, maxAgeSec, { swr = maxAgeSec } = {}) {
  res.set(
    'Cache-Control',
    `public, max-age=${maxAgeSec}, s-maxage=${maxAgeSec}, stale-while-revalidate=${swr}`,
  );
}

module.exports = { setPublicCache };
