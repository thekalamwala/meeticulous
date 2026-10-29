// ───────────────────────────────────────────────────────────────────────────
// Lazy Noto Sans subset loader for the preloader greetings.
//
// Google Fonts `text=` returns a subset containing ONLY the requested glyphs, so
// even CJK ("你好", "こんにちは") costs a few KB instead of megabytes. Injected
// once, on first preloader mount — never on pages that don't use the preloader.
// ───────────────────────────────────────────────────────────────────────────
import { resolveGreetings, fontSubsets } from './greetings';

let injected = false;

export function ensureGreetingFonts() {
  if (injected || typeof document === 'undefined') return;
  injected = true;

  // Union across every variant so a single injection covers all greetings.
  const all = [...resolveGreetings({ variant: 'homepage' }), ...resolveGreetings({ variant: 'profile' })];
  const subsets = fontSubsets(all);

  subsets.forEach(({ family, text }) => {
    const href =
      'https://fonts.googleapis.com/css2' +
      `?family=${encodeURIComponent(family)}:wght@600` +
      `&text=${encodeURIComponent(text)}` +
      '&display=swap';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.preloaderFont = family;
    // ponytail: media="print" makes the fetch non-render-blocking (Lighthouse
    // flagged these as blocking FCP/LCP); flip to "all" on load so the glyphs
    // still apply. display=swap already shows a fallback until it lands.
    link.media = 'print';
    link.onload = () => { link.media = 'all'; };
    document.head.appendChild(link);
  });
}
