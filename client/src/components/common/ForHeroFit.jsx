import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Fits the hero of every /for/* landing page inside one screen on desktop.
 *
 * The 30+ profession landings each hand-build their hero (different paddings,
 * headline sizes, image frames), so on a short laptop screen (1366×768) almost
 * all of them ran past the fold. Rather than hand-tune each page, this mounts
 * once inside the Router and, on /for/* routes at lg+ widths:
 * - finds the hero block = the child of the hero <section> that holds the <h1>
 *   (headline + image split; a benefit strip below it is left alone),
 * - scales it with CSS `zoom` just enough that its bottom lands inside the
 *   viewport. `zoom` (unlike transform) reflows, so nothing overlaps and the
 *   section background still spans the full width.
 *
 * Never scales up, never below MIN_ZOOM (stays readable), never on phones/
 * tablets (< 1024px, where the heroes stack and scrolling is expected).
 * Re-fits on resize and when the page's async content settles.
 */

const MIN_ZOOM = 0.7;
const BOTTOM_GAP = 24; // breathing room between the hero and the fold
const MIN_TOP_PAD = 24; // the hero's top padding is only trimmed down to this
const LG = 1024;

function heroBlock() {
  const h1 = document.querySelector("main h1, h1");
  const section = h1?.closest("section");
  if (!section) return null;
  let el = h1;
  while (el.parentElement && el.parentElement !== section) el = el.parentElement;
  return el.parentElement === section ? el : null;
}

function reset(block) {
  block.style.zoom = "";
  if (block.parentElement) block.parentElement.style.paddingTop = "";
}

function fit(block) {
  const section = block.parentElement;
  block.style.zoom = "";
  section.style.paddingTop = "";
  if (window.innerWidth < LG) return;
  // Bottom of the hero block at scroll 0. getBoundingClientRect already reports
  // the zoomed box, so it can be re-read after each change.
  const overflow = () => {
    const r = block.getBoundingClientRect();
    return r.bottom + window.scrollY - (window.innerHeight - BOTTOM_GAP);
  };
  // Smaller text re-wraps, so one ratio isn't exact — tighten a few times.
  for (let i = 0; i < 3; i += 1) {
    const over = overflow();
    if (over <= 0) return;
    const h = block.getBoundingClientRect().height;
    const current = parseFloat(block.style.zoom || "1");
    const next = Math.max(MIN_ZOOM, Math.floor(current * ((h - over) / h) * 100) / 100);
    if (next === current) break;
    block.style.zoom = String(next);
  }
  // Still over at the minimum zoom: give back some of the section's top padding.
  const over = overflow();
  if (over > 0) {
    const pad = parseFloat(getComputedStyle(section).paddingTop) || 0;
    section.style.paddingTop = `${Math.max(MIN_TOP_PAD, pad - over)}px`;
  }
}

export default function ForHeroFit() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!pathname.startsWith("/for/")) return undefined;
    let block = null;
    let timer = 0;
    // Debounced with a timer, not rAF: rAF is paused in background tabs, which
    // would leave a tab opened behind the current one un-fitted.
    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = heroBlock();
        if (block && block !== next) reset(block);
        block = next;
        if (block) fit(block);
      }, 50);
    };

    run();
    // Lazy pages render the hero after this effect; fonts/images shift heights.
    const mo = new MutationObserver(run);
    mo.observe(document.body, { childList: true, subtree: true });
    const stop = setTimeout(() => mo.disconnect(), 4000);
    window.addEventListener("resize", run);
    document.fonts?.ready.then(run);

    return () => {
      clearTimeout(timer);
      clearTimeout(stop);
      mo.disconnect();
      window.removeEventListener("resize", run);
      if (block) reset(block);
    };
  }, [pathname]);

  return null;
}
