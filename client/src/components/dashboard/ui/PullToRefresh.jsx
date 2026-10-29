import { useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const THRESHOLD = 72;

// Pull down at the top of the wrapped scroll area to refresh.
// ponytail: naive touch-drag, assumes the wrapped content is the scroll
// container. Upgrade to scroll-parent detection if a screen nests scrollers.
export function PullToRefresh({ onRefresh, children, className = '' }) {
  const y = useMotionValue(0);
  const startY = useRef(null);
  const scrollRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    }
  };
  const onTouchMove = (e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) y.set(Math.min(dy * 0.5, THRESHOLD * 1.5));
  };
  const onTouchEnd = async () => {
    if (startY.current == null) return;
    const pulled = y.get();
    startY.current = null;
    if (pulled >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      animate(y, THRESHOLD, { duration: 0.1 });
      try { await onRefresh(); } finally {
        setRefreshing(false);
        animate(y, 0, { type: 'spring', stiffness: 400, damping: 40 });
      }
    } else {
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 40 });
    }
  };

  return (
    <div className={className} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <motion.div style={{ height: y }} className="flex items-end justify-center overflow-hidden">
        <Loader2 className={`mb-2 h-5 w-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
      </motion.div>
      <div ref={scrollRef} className="overflow-y-auto">{children}</div>
    </div>
  );
}

export default PullToRefresh;
