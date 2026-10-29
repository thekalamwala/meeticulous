/**
 * sitemapCache.js — tiny in-process TTL cache for rendered sitemap XML.
 *
 * This is the SPA-stack equivalent of Next.js ISR / revalidatePath: crawlers
 * hit the sitemap often, but the DB only changes on a handful of mutations
 * (service create/update/delete/toggle, profile-URL change, vendor verify).
 * So we cache the rendered XML with a TTL and call bust() from those mutation
 * points for instant invalidation. Mirrors the FreeBusy cache pattern already
 * used in this codebase.
 *
 * Single-instance only — fine for the current Render deployment. A multi-node
 * future would swap this for a shared store; the TTL alone still bounds
 * staleness to SITEMAP_CACHE_TTL_MS.
 */

const createSitemapCache = ({ ttlMs, now = Date.now } = {}) => {
  const store = new Map(); // key -> { value, expires }

  const get = (key) => {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (now() > hit.expires) {
      store.delete(key);
      return undefined;
    }
    return hit.value;
  };

  return {
    get,
    has: (key) => get(key) !== undefined,
    set: (key, value) => { store.set(key, { value, expires: now() + ttlMs }); },
    bust: () => store.clear(),
  };
};

// Shared singleton used by the controller + mutation hooks. TTL configurable;
// default 1h (crawlers re-poll the sitemap far more often than the DB changes).
const SITEMAP_CACHE_TTL_MS = Number(process.env.SITEMAP_CACHE_TTL_MS) || 60 * 60 * 1000;
const sitemapCache = createSitemapCache({ ttlMs: SITEMAP_CACHE_TTL_MS });

// Imported by every mutation point so a single require gives the bust handle
// without pulling in the controller.
const bustSitemapCache = () => sitemapCache.bust();

module.exports = { createSitemapCache, sitemapCache, bustSitemapCache, SITEMAP_CACHE_TTL_MS };
