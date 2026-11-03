import confetti from 'canvas-confetti';

// Brand palette only — no purple/orange (Loop & Slot). maroon · rose · pink ·
// marigold · blush.
const BRAND = ['#960D32', '#E0506F', '#FF9FB0', '#F6C35A', '#FFE4EA'];

// Custom particle shapes (built once). shapeFromPath normalises the path box.
//   ribbon — tall thin strip that flutters down like a streamer
//   petal  — teardrop, the brand's falling-petal motif
let RIBBON, PETAL, SPARKLE;
try {
  RIBBON = confetti.shapeFromPath({ path: 'M0 0 L7 0 L7 30 L0 30 Z' });
  PETAL = confetti.shapeFromPath({ path: 'M6 0 C10 7 10 17 6 24 C2 17 2 7 6 0 Z' });
  SPARKLE = confetti.shapeFromText({ text: '✨', scalar: 2 });
} catch { /* older canvas-confetti without custom shapes — fall back to built-ins */ }

// Celebration for a real publish: an opening burst, ribbons + petals + sparkles
// drifting down, then a short firework finale. ponytail: wrapped so a confetti
// hiccup can never break the "You're live" screen.
export function fireCelebration() {
  try {
    const reduce = typeof matchMedia !== 'undefined'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const petalShapes = PETAL ? ['circle', 'square', PETAL] : ['circle', 'square'];

    // 1. Opening burst from both lower corners.
    const burst = { spread: 75, ticks: 220, gravity: 0.9, decay: 0.93, colors: BRAND, shapes: petalShapes };
    confetti({ ...burst, particleCount: reduce ? 40 : 80, angle: 60, origin: { x: 0, y: 0.7 } });
    confetti({ ...burst, particleCount: reduce ? 40 : 80, angle: 120, origin: { x: 1, y: 0.7 } });

    if (reduce) return; // one calm burst, no sustained motion

    // 2. Ribbons + sparkles fluttering down from the top.
    setTimeout(() => {
      confetti({
        colors: BRAND, shapes: RIBBON ? [RIBBON] : ['square'], particleCount: 40,
        spread: 120, startVelocity: 35, gravity: 0.6, decay: 0.92, ticks: 320,
        scalar: 1.3, angle: 270, origin: { x: 0.5, y: 0 },
      });
      confetti({
        colors: ['#F6C35A', '#FF9FB0'], shapes: SPARKLE ? [SPARKLE] : ['star'], particleCount: 14,
        spread: 100, startVelocity: 28, gravity: 0.7, ticks: 260, origin: { x: 0.5, y: 0.2 },
      });
    }, 150);

    // 3. Short firework finale — random-origin bursts for ~1.8s.
    const end = Date.now() + 1800;
    (function fireworks() {
      confetti({
        colors: BRAND, shapes: ['star', 'circle'], particleCount: 24, spread: 360,
        startVelocity: 26, gravity: 1, ticks: 160, scalar: 0.9,
        origin: { x: Math.random(), y: Math.random() * 0.5 },
      });
      if (Date.now() < end) setTimeout(fireworks, 280);
    })();
  } catch { /* never let a celebration break the page */ }
}
