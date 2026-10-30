/**
 * ConfettiStorm.jsx — the celebration (canvas-confetti).
 *
 * Timing (founder spec): 6s total. First 3s = full, steady rate + amount; next 3s
 * = same but tapering down (fewer, slower) to a calm stop. Skipped entirely under
 * prefers-reduced-motion.
 *
 * Brand colours: sloth orange + gold + greens + violet.
 */
import { useEffect } from 'react';
import confetti from 'canvas-confetti';

const COLORS = ['#960D32', '#f59e0b', '#10b981', '#FF9FB0', '#ffd166', '#ffffff'];
const FULL_MS = 3000;   // steady phase
const TOTAL_MS = 6000;  // then taper to zero

export default function ConfettiStorm() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const fire = (opts) => confetti({ colors: COLORS, disableForReducedMotion: true, ...opts });

    // opening bang
    fire({ particleCount: 140, spread: 95, startVelocity: 52, origin: { y: 0.55 } });

    const start = performance.now();
    let raf;
    let last = 0;
    const tick = (now) => {
      const elapsed = now - start;
      if (elapsed >= TOTAL_MS) { return; }
      // emit every ~140ms
      if (now - last >= 140) {
        last = now;
        // steady for first 3s, then linearly ramp to 0 over the next 3s
        const p = elapsed < FULL_MS ? 1 : Math.max(0, 1 - (elapsed - FULL_MS) / (TOTAL_MS - FULL_MS));
        const count = Math.max(1, Math.round(7 * p));
        const vel = 22 + 28 * p; // slows as it tapers
        fire({ particleCount: count, angle: 60, spread: 62, startVelocity: vel, origin: { x: 0, y: 0.5 } });
        fire({ particleCount: count, angle: 120, spread: 62, startVelocity: vel, origin: { x: 1, y: 0.5 } });
        fire({ particleCount: count, angle: 90, spread: 80, startVelocity: vel * 0.9, origin: { x: 0.5, y: 0.35 } });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); confetti.reset(); };
  }, []);

  return null;
}
