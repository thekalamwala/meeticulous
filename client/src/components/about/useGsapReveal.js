import { gsap, useGSAP, EASE } from "./gsapSetup";

/**
 * Scoped, premium scroll reveal for a grid/list of items.
 * - Items rise + settle with depth (y + scale + slight rotateX), staggered.
 * - Heading (optional `.js-head`) leads in first.
 * - Honors prefers-reduced-motion: animations only run under no-preference,
 *   and gsap.from leaves the natural (visible) final state otherwise.
 *
 * @param {React.RefObject} scope  ref to the section root
 * @param {string} itemSelector    scoped selector for the items (default ".js-item")
 */
export default function useGsapReveal(scope, itemSelector = ".js-item") {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (scope.current && scope.current.querySelector(".js-head")) {
          gsap.from(".js-head", {
            opacity: 0,
            y: 28,
            duration: 0.8,
            ease: EASE,
            scrollTrigger: { trigger: scope.current, start: "top 80%" },
          });
        }
        gsap.from(itemSelector, {
          opacity: 0,
          y: 64,
          scale: 0.96,
          rotateX: 8,
          transformOrigin: "50% 0%",
          duration: 0.9,
          ease: EASE,
          stagger: { each: 0.1, from: "start" },
          scrollTrigger: { trigger: scope.current, start: "top 72%" },
        });
      });
    },
    { scope }
  );
}
