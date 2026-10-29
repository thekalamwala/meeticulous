import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import SlideShell from './SlideShell';
import SlideBackground from './SlideBackground';

const EASE = [0.22, 1, 0.36, 1];
// Direction-aware morph: the outgoing slide fades + drifts + settles while the
// incoming one rises in and scales up — a soft "magic move" rather than a hard cut.
const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 56 : -56, scale: 0.965 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40, scale: 1.02 }),
};

export default function Deck({ slides, index, direction, hostCtx, onSwipe }) {
  const { key, title, Component, eyebrow, bg } = slides[index];
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="absolute inset-0"
      drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15}
      onDragEnd={(e, info) => { if (info.offset.x < -80) onSwipe(1); else if (info.offset.x > 80) onSwipe(-1); }}
    >
      {/* background morph — geometric pattern cross-dissolves between chapters, no drift */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`bg-${key}`}
          className="absolute inset-0"
          style={{ zIndex: 0 }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.55, ease: 'linear' }}
        >
          <SlideBackground pattern={bg?.pattern} accent={bg?.accent} uid={key} />
        </motion.div>
      </AnimatePresence>

      {/* slide morph */}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={key}
          custom={direction}
          variants={slideVariants}
          initial={reduce ? false : 'enter'}
          animate="center"
          exit={reduce ? undefined : 'exit'}
          transition={{ duration: reduce ? 0 : 0.42, ease: EASE }}
          className="absolute inset-0"
          style={{ zIndex: 1 }}
          role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}: ${title}`}
        >
          <SlideShell eyebrow={eyebrow}>
            <Component hostCtx={hostCtx} />
          </SlideShell>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
