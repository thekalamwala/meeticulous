import confetti from 'canvas-confetti';

// Brand-flavoured confetti burst. Two staggered cones give a fuller shape
// than a single call. Colours pulled from the primary/accent palette so the
// burst reads as "us", not stock confetti.
const COLORS = ['#2E1065', '#FF7A33', '#FFB380', '#FFE4D1', '#5B3AFF'];

export function fireCelebration() {
  const base = { spread: 70, ticks: 200, gravity: 0.9, decay: 0.94, colors: COLORS };
  confetti({ ...base, particleCount: 90, angle: 60,  origin: { x: 0,   y: 0.7 } });
  confetti({ ...base, particleCount: 90, angle: 120, origin: { x: 1,   y: 0.7 } });
  setTimeout(() => {
    confetti({ ...base, particleCount: 120, angle: 90, spread: 100, origin: { x: 0.5, y: 0.35 } });
  }, 150);
}
