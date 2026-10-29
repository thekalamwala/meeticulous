import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsapSetup";

/**
 * Page-level motion driver for the About page.
 * - Wires Lenis smooth-scroll into GSAP's ticker and ScrollTrigger.update
 *   (the official GSAP <-> Lenis integration) for buttery scrubbed scenes.
 * - Skips entirely under prefers-reduced-motion (native scroll, no smoothing).
 * - Refreshes ScrollTrigger once fonts/images settle so pinned scenes measure right.
 */
export default function useAboutMotion() {
  useEffect(() => {
    // Skip smooth-scroll wiring under jsdom (tests) — Lenis + rAF add no value there.
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
      return undefined;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Still refresh once so any non-scrubbed reveals measure correctly.
      const id = window.setTimeout(() => ScrollTrigger.refresh(), 300);
      return () => window.clearTimeout(id);
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Re-measure after first paint + once more after assets settle.
    const r1 = window.setTimeout(() => ScrollTrigger.refresh(), 200);
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);

    return () => {
      window.clearTimeout(r1);
      window.removeEventListener("load", onLoad);
      gsap.ticker.remove(tick);
      lenis.destroy();
      // Strip Lenis html classes so the next route scrolls cleanly (see useLenis.js).
      document.documentElement.classList.remove(
        "lenis",
        "lenis-smooth",
        "lenis-scrolling",
        "lenis-stopped"
      );
    };
  }, []);
}
