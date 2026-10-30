import { Suspense, useEffect, useState } from 'react';
import { getBackground } from './registry';
import { tint } from './palette';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

// Owns the above-the-fold band (top 70% of fold) + fade-to-transparent mask.
export default function HostBackground({ typeKey, color = '#960D32', params = {} }) {
  const reduced = usePrefersReducedMotion();
  const entry = getBackground(typeKey);
  const Engine = entry?.Component;

  return (
    <div
      aria-hidden
      data-bg-band
      className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] overflow-hidden"
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
        maskImage: 'linear-gradient(to bottom, #000, transparent)',
      }}
    >
      {(!Engine || reduced) ? (
        <div
          data-bg-static
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${tint(color, 0.12)}, ${tint(color, 0.45)})` }}
        />
      ) : (
        <Suspense fallback={null}>
          <Engine color={color} params={{ ...(entry.defaultParams || {}), ...params }} />
        </Suspense>
      )}
    </div>
  );
}
