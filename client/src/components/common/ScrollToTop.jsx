import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scroll management between routes.
 *
 * React Router v6 does NOT restore/reset scroll between routes, so navigating
 * from a link near the bottom of one page lands the next page already scrolled
 * down (it looks like you arrive at the footer). This mounts once inside the
 * Router and fixes it app-wide.
 *
 * Behaviour (Principle #5 — don't break history, enhance it):
 * - PUSH / REPLACE (a normal link click) → scroll to the top.
 * - POP (browser Back/Forward) → restore the position the user left that
 *   entry at, so Back feels instant instead of dumping them at the top.
 * - An in-page #hash link still scrolls to its anchor (never yanked to top).
 * - useLayoutEffect runs before paint, so there's no visible jump.
 *
 * ponytail: naive window-scroll restore keyed by history entry. If the target
 * page fetches data after mount, the document may be shorter than the saved
 * offset at restore time and the browser clamps (under-restores). Good enough —
 * strictly better than always-top. Upgrade path if it bites: restore again once
 * content height settles (ResizeObserver on the scroll container).
 */

// Module-level so the map survives ScrollToTop remounts within a session.
const positions = new Map();

export default function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const navType = useNavigationType(); // PUSH | POP | REPLACE

  // Take over from the browser's own (route-unaware) restoration.
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Drop the one-shot cache-bust param added by RouteErrorBoundary's reload once
  // we've successfully loaded, so it doesn't linger in the URL (shared links,
  // analytics pageviews). replaceState avoids a navigation / history entry.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("_rl")) {
        url.searchParams.delete("_rl");
        window.history.replaceState(
          window.history.state,
          "",
          url.pathname + url.search + url.hash
        );
      }
    } catch {
      /* URL/history unavailable — harmless to skip */
    }
  }, []);

  // Continuously record the current entry's scroll offset.
  useEffect(() => {
    const save = () => positions.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [key]);

  useLayoutEffect(() => {
    if (hash) {
      // Cross-page #hash links: RR v6 won't scroll to the anchor on its own.
      // Try now (element is in the DOM post-render); rAF retries once in case
      // the target mounts a frame later (motion/reveal wrappers).
      const id = decodeURIComponent(hash.slice(1));
      const toAnchor = () => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView();
        return !!el;
      };
      if (!toAnchor()) requestAnimationFrame(toAnchor);
      return;
    }

    if (navType === "POP") {
      const y = positions.get(key);
      if (y != null) {
        window.scrollTo(0, y);
        return;
      }
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, hash, key, navType]);

  return null;
}
