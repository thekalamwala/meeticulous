import { motion, useMotionValue, animate } from 'framer-motion';
import { cn } from './cn';

const ACTION_W = 72; // px per action button

function ActionButtons({ actions, side }) {
  return (
    <div className={cn('absolute inset-y-0 flex', side === 'right' ? 'right-0' : 'left-0')}>
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={a.onAction}
          style={{ width: ACTION_W, backgroundColor: a.color || '#ef4444' }}
          className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-white"
        >
          {a.icon && <a.icon className="h-5 w-5" />}
          {a.label}
        </button>
      ))}
    </div>
  );
}

// Swipe a row horizontally to reveal quick actions. ponytail: snap points are
// full-open / closed only; no partial-detent state. Good enough for row ops.
export function SwipeActions({ children, right = [], left = [], className = '' }) {
  const x = useMotionValue(0);
  const rightW = right.length * ACTION_W;
  const leftW = left.length * ACTION_W;

  const settle = () => {
    const cur = x.get();
    let to = 0;
    if (cur < -rightW / 2 && rightW) to = -rightW;
    else if (cur > leftW / 2 && leftW) to = leftW;
    animate(x, to, { type: 'spring', stiffness: 500, damping: 40 });
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {right.length > 0 && <ActionButtons actions={right} side="right" />}
      {left.length > 0 && <ActionButtons actions={left} side="left" />}
      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -rightW, right: leftW }}
        dragElastic={0.08}
        onDragEnd={settle}
        className="relative bg-white"
      >
        {children}
      </motion.div>
    </div>
  );
}

export default SwipeActions;
