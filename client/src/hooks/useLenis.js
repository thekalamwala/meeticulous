import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Premium smooth scrolling via Lenis.
 * Mounts once on the page that calls it; cleans up on unmount.
 * Respects prefers-reduced-motion (skips entirely).
 */
export default function useLenis() {
  useEffect(() => {
    // Touch-primary devices skip it too: Lenis leaves touch scrolling native
    // (syncTouch is off), so on phones it smoothed nothing while its per-frame
    // rAF loop kept the main thread busy — measured as the top bootup cost on
    // mobile Lighthouse.
    if (
      typeof window !== "undefined" &&
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        window.matchMedia("(hover: none) and (pointer: coarse)").matches)
    ) {
      return undefined;
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });

    let rafId;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      // Belt-and-suspenders: Lenis toggles classes on <html> that flip body/#root to
      // `height: auto` (index.css). If any survive destroy() (version quirks), they leak
      // a broken scroll height onto the NEXT route (e.g. /lp scrolls past the footer into
      // dead space). Explicitly strip them so non-Lenis pages scroll cleanly.
      document.documentElement.classList.remove(
        'lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped',
      );
    };
  }, []);
}
