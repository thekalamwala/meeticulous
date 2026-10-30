// ───────────────────────────────────────────────────────────────────────────
// Brand preloader — greeting data + resolver.
//
// Single source of truth for the multilingual welcome. Each greeting carries the
// Noto Sans family it needs (Inter Tight covers only Latin), so the preloader can
// lazy-load just the glyph subsets it actually shows. Extend FESTIVALS / regional
// sets here later WITHOUT touching <BrandPreloader>.
// ───────────────────────────────────────────────────────────────────────────

// `font: null` → rendered in the page font (Inter Tight). Otherwise a Noto Sans
// family that is subset-loaded on demand (see fontLoader.js).
export const GREETINGS = [
  { lang: 'Hindi',     text: 'नमस्ते',          font: 'Noto Sans Devanagari' },
  { lang: 'Bengali',   text: 'নমস্কার',         font: 'Noto Sans Bengali' },
  { lang: 'Tamil',     text: 'வணக்கம்',         font: 'Noto Sans Tamil' },
  { lang: 'Telugu',    text: 'నమస్కారం',        font: 'Noto Sans Telugu' },
  { lang: 'Kannada',   text: 'ನಮಸ್ಕಾರ',         font: 'Noto Sans Kannada' },
  { lang: 'Malayalam', text: 'നമസ്കാരം',        font: 'Noto Sans Malayalam' },
  { lang: 'Marathi',   text: 'नमस्कार',         font: 'Noto Sans Devanagari' },
  { lang: 'Gujarati',  text: 'નમસ્તે',          font: 'Noto Sans Gujarati' },
  { lang: 'Punjabi',   text: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',   font: 'Noto Sans Gurmukhi' },
  { lang: 'Odia',      text: 'ନମସ୍କାର',         font: 'Noto Sans Oriya' },
  { lang: 'Spanish',   text: 'Hola',            font: null },
  { lang: 'French',    text: 'Bonjour',         font: null },
  { lang: 'Japanese',  text: 'こんにちは',        font: 'Noto Sans JP' },
  { lang: 'Chinese',   text: '你好',             font: 'Noto Sans SC' },
  { lang: 'English',   text: 'Hello',           font: null },
];

// Display order: lead Indian, weave in foreign, END on English so the handoff to
// the "Meeticulous" lockup reads naturally. Indices into GREETINGS.
const DEFAULT_ORDER = [0, 2, 10, 3, 1, 12, 5, 4, 7, 11, 9, 6, 13, 8, 14];

// Festival / seasonal / campaign overrides land here later, e.g.
//   { match: ({ month, day }) => month === 10, greetings: [...] }  // Diwali
export const FESTIVALS = [];

/**
 * Resolve the greeting sequence for a given context. Future-proof seam: pass
 * festival/region/locale/user and branch here — callers never change.
 *
 * @returns {Array<{lang,text,font}>}
 */
export function resolveGreetings({ variant = 'homepage' } = {}) {
  // (festival/regional/locale resolution slots in here in the future)
  const seq = DEFAULT_ORDER.map((i) => GREETINGS[i]).filter(Boolean);
  // Profile variant: same welcome — the personal touch ("name") is layered by
  // the component's brand phase, not by swapping greetings.
  return seq;
}

// Unique Noto families used by a greeting list, with the union of characters each
// needs — lets the loader request the smallest possible subset per family.
export function fontSubsets(greetings) {
  const map = new Map();
  greetings.forEach((g) => {
    if (!g.font) return;
    const chars = map.get(g.font) || new Set();
    for (const ch of g.text) chars.add(ch);
    map.set(g.font, chars);
  });
  return [...map.entries()].map(([family, set]) => ({ family, text: [...set].join('') }));
}
