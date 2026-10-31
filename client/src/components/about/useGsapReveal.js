import { gsap, useGSAP, EASE } from "./gsapSetup";

/**
 * Scoped, premium scroll reveal for a grid/list of items.
 * - Items rise + settle with depth (y + scale + slight rotateX), staggered.
 * - Heading (optional `.js-head`) leads in first.
 * - Honors prefers-reduced-motion: animations only run under no-preference,
 *   so the natural (visible) state is what reduced-motion users get.
 *
 * fromTo (not from) with an explicit visible end state, and clearProps when
 * done: gsap.from reads the element's *current* state as the destination, so
 * if it re-runs while a reveal is mid-flight (React re-mount, dev hot reload) it
 * can lock items half-faded/shrunk/offset — e.g. one card in a row sitting lower
 * and smaller than its neighbours. An explicit end + cleared inline styles means
 * items always finish in their real CSS position.
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
          gsap.fromTo(
            ".js-head",
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: EASE,
              clearProps: "opacity,transform",
              scrollTrigger: { trigger: scope.current, start: "top 80%" },
            }
          );
        }
        gsap.fromTo(
          itemSelector,
          { opacity: 0, y: 64, scale: 0.96, rotateX: 8, transformOrigin: "50% 0%" },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            rotateX: 0,
            duration: 0.9,
            ease: EASE,
            stagger: { each: 0.1, from: "start" },
            clearProps: "opacity,transform,transformOrigin",
            scrollTrigger: { trigger: scope.current, start: "top 72%" },
          }
        );
      });
    },
    { scope }
  );
}
