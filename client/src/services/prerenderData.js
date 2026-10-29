// API responses the prerender baked into this page's HTML
// (<script id="__bas_data" type="application/json">, written by scripts/prerender.mjs).
//
// Lets a data page (blog post, host profile, service) render its real content on
// the FIRST render instead of a spinner: no footer jump (blog CLS was 1.4) and
// content paints as soon as the route's JS runs, not after an API round trip.
// Pages still refetch in the background (stale-while-revalidate), so a build-time
// copy is replaced within a request. (hydrateRoot was tried and dropped: a
// browser snapshot has no SSR Suspense markers, so lazy routes never hydrate.)
//
// Never seed availability/slots — those must be live (prerender.mjs LIVE_ONLY_API).
let data;

function all() {
  if (data === undefined) {
    try {
      data = JSON.parse(document.getElementById('__bas_data')?.textContent || 'null') || {};
    } catch {
      data = {};
    }
  }
  return data;
}

// `path` is the API path as api.js requests it, e.g. `/blogs/my-post`.
export function prerendered(path) {
  if (typeof document === 'undefined') return undefined;
  return all()[path];
}
