import { motion, useReducedMotion } from "framer-motion";

/**
 * Calm fade-up reveal on scroll-into-view.
 * Subtle by design: 24px rise, 0.98 → 1 scale, soft easing, no bounce.
 * Use `as` to change the rendered tag, `delay` for stagger.
 */
const EASE = [0.22, 1, 0.36, 1];

export default function Reveal({
  children,
  as = "div",
  delay = 0,
  y = 24,
  className = "",
  once = true,
  amount = 0.25,
  instant = false,
  ...rest
}) {
  const MotionTag = motion[as] || motion.div;
  // Respect prefers-reduced-motion: render the final state immediately so content
  // never animates AND never gets stranded at opacity:0 for these users.
  // `instant` does the same on purpose for above-the-fold content (the hero):
  // the fade's `initial:{opacity:0}` re-hides the already-prerendered hero on
  // hydration, so the LCP element only paints when the animation ends (~2.4s
  // render delay). instant renders the final state from first paint — no re-hide.
  const reduce = useReducedMotion();
  const skip = reduce || instant;
  return (
    <MotionTag
      className={className}
      initial={skip ? false : { opacity: 0, y, scale: 0.985 }}
      whileInView={skip ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once, amount }}
      transition={skip ? { duration: 0 } : { duration: 0.7, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
