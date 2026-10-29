import { lazy } from 'react';

/**
 * Drop-in replacement for React.lazy that survives two real-world failure modes
 * of route-level code splitting:
 *
 *   1. Transient network blips while fetching a chunk → retry a couple of times
 *      with a short backoff before giving up.
 *   2. Stale chunk after a deploy → the open tab references old hash-named JS
 *      files (e.g. /assets/Earnings-OLDHASH.js) that Vercel has already purged,
 *      so the dynamic import() 404s forever. A retry can't fix that — only a
 *      full page reload pulls a fresh index.html with the current hashes. We do
 *      that ONCE, guarded by sessionStorage so we never loop.
 *
 * If both the retries and the one-shot reload fail, the rejection propagates to
 * the nearest ErrorBoundary instead of unmounting the tree into a white screen.
 */

const RELOAD_FLAG = 'bas:chunk-reload';

// Matches the messages browsers throw when a dynamically-imported module can't
// be fetched/evaluated. Kept broad on purpose — wording differs across engines.
function isChunkLoadError(err) {
  const msg = (err && (err.message || String(err))) || '';
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /'?text\/html'? is not a valid JavaScript MIME type/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {() => Promise<{ default: React.ComponentType<any> }>} factory
 * @param {number} retries  transient-failure retries before escalating
 */
export default function lazyWithRetry(factory, retries = 2) {
  return lazy(async () => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const mod = await factory();
        // Success — clear the reload guard so future stale-chunk events can
        // trigger their own one-shot reload.
        sessionStorage.removeItem(RELOAD_FLAG);
        return mod;
      } catch (err) {
        const last = attempt === retries;

        if (!last && !isChunkLoadError(err)) {
          // Non-chunk error (e.g. a real bug in the module) — don't waste
          // retries, hand it straight to the ErrorBoundary.
          throw err;
        }

        if (last) {
          // Stale-chunk after deploy: one full reload pulls the new build.
          if (isChunkLoadError(err) && !sessionStorage.getItem(RELOAD_FLAG)) {
            sessionStorage.setItem(RELOAD_FLAG, '1');
            window.location.reload();
            // Hang this promise — the reload tears the page down anyway, so we
            // must NOT resolve/reject (that would flash the ErrorBoundary first).
            return new Promise(() => {});
          }
          throw err;
        }

        // Transient: brief backoff, then retry.
        await delay(300 * (attempt + 1));
      }
    }
    // Unreachable — the loop either returns or throws.
    throw new Error('lazyWithRetry: exhausted retries');
  });
}
