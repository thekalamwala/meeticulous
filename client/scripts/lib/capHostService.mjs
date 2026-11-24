/**
 * capHostService — bound the host/service prerender list so a growing catalog
 * can never push the Vercel build past its 45-minute hard cap (the build is
 * killed and NOTHING ships). Today the catalog is tiny (≈15 host/service + 50
 * profession routes), so the default cap is a no-op; this is insurance for when
 * verified hosts scale into the thousands.
 *
 * Profession pages (/services/:slug — high SEO value, bounded set) are ALWAYS
 * kept and returned FIRST, so if the prerender's wall-clock budget drops routes
 * from the tail, what it sheds is the lowest-priority host/service pages, not the
 * professions. Host/service <loc>s arrive in sitemap priority order, so slicing
 * keeps the highest-priority ones. Dropped routes serve the SPA fallback until
 * the next deploy — a partial prerender, never a failed build.
 *
 * ponytail: fixed cap + priority-order slice; tune PRERENDER_HOST_CAP — raise it
 * if the builder has headroom, lower it if builds approach 45 min.
 */
export function capHostService(professionPaths, hostServicePaths, cap) {
  const kept = cap > 0 ? hostServicePaths.slice(0, cap) : hostServicePaths;
  return {
    routes: [...professionPaths, ...kept],
    dropped: hostServicePaths.length - kept.length,
  };
}
