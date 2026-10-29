import { useCallback, useEffect, useState } from 'react';

export function keyToIndex(slides, key) { return slides.findIndex((s) => s.key === key); }
export function clampIndex(n, len) { return Math.max(0, Math.min(len - 1, n)); }

export function useDeckNav(slides) {
  const initial = () => {
    const key = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '');
    const i = keyToIndex(slides, key);
    return i >= 0 ? i : 0;
  };
  const [index, setIndex] = useState(initial);

  const go = useCallback((i) => {
    const clamped = clampIndex(i, slides.length);
    setIndex(clamped);
    const key = slides[clamped]?.key;
    if (key && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${key}`);
    }
  }, [slides]);

  const next = useCallback(() => setIndex((i) => { const n = clampIndex(i + 1, slides.length); const k = slides[n]?.key; if (k) window.history.replaceState(null, '', `#${k}`); return n; }), [slides]);
  const prev = useCallback(() => setIndex((i) => { const n = clampIndex(i - 1, slides.length); const k = slides[n]?.key; if (k) window.history.replaceState(null, '', `#${k}`); return n; }), [slides]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const interactive = t && (['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
      if (interactive && (e.key === ' ' || e.key === 'Spacebar')) return; // let Space activate focused controls
      if (['ArrowRight', ' ', 'Spacebar', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
    };
    window.addEventListener('keydown', onKey);
    const onHash = () => { const i = keyToIndex(slides, window.location.hash.replace('#', '')); if (i >= 0) setIndex(i); };
    window.addEventListener('hashchange', onHash);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('hashchange', onHash); };
  }, [next, prev, go, slides]);

  return { index, next, prev, go };
}
