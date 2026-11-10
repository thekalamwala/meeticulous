import { useEffect, useRef, useState } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import useIsMobile from '../../../hooks/useIsMobile';
import { useRefreshRunner } from './refreshContext';
import { cn } from './cn';

/* Native-style pull-to-refresh for the mobile dashboard/guest shells. Touch only
 * (< lg); on desktop it renders children untouched. The pull translates the page
 * content down and reveals a spinner; releasing past the threshold runs the
 * page's registered refetch (or a soft reload as a fallback).
 *
 * `scrollerRef` is the scroll container to read scrollTop from. Omit it when the
 * window scrolls (Overview / guest shells); pass the <main> ref when the shell
 * scrolls inside a container (host DashboardLayout). */

const THRESHOLD = 70;   // px of pull (post-damping) that triggers a refresh
const MAX = 110;        // max visual pull
const DAMP = 0.5;       // rubber-band: content moves half the finger distance

export function PullToRefresh({ onRefresh, scrollerRef, children }) {
  const runner = useRefreshRunner();
  const isMobile = useIsMobile('(max-width: 1023px)');
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => { pullRef.current = pull; }, [pull]);
  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);

  useEffect(() => {
    if (!isMobile) return undefined;
    const scrollTop = () => (scrollerRef?.current ? scrollerRef.current.scrollTop : window.scrollY);

    const onStart = (e) => {
      if (refreshingRef.current) return;
      startY.current = scrollTop() <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e) => {
      if (startY.current == null || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && scrollTop() <= 0) {
        e.preventDefault(); // own the overscroll so the browser's native PTR stays out
        setPull(Math.min(dy * DAMP, MAX));
      } else if (dy <= 0) {
        startY.current = null;
        setPull(0);
      }
    };
    const onEnd = () => {
      if (refreshingRef.current) return;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        Promise.resolve((onRefresh || runner?.run)?.())
          .catch(() => {})
          .finally(() => { setRefreshing(false); setPull(0); });
      } else {
        setPull(0);
      }
    };

    // touchmove must be non-passive to preventDefault the overscroll.
    const target = scrollerRef?.current || window;
    target.addEventListener('touchstart', onStart, { passive: true });
    target.addEventListener('touchmove', onMove, { passive: false });
    target.addEventListener('touchend', onEnd, { passive: true });
    target.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      target.removeEventListener('touchstart', onStart);
      target.removeEventListener('touchmove', onMove);
      target.removeEventListener('touchend', onEnd);
      target.removeEventListener('touchcancel', onEnd);
    };
  }, [isMobile, scrollerRef, onRefresh, runner]);

  if (!isMobile) return children;

  const settling = startY.current == null; // animate back when not actively dragging
  const ready = pull >= THRESHOLD;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
        style={{ transform: `translateY(${pull - 40}px)`, opacity: Math.min(pull / THRESHOLD, 1), transition: settling ? 'opacity .2s' : 'none' }}
        aria-hidden={!refreshing}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full border border-maroon/10 bg-white text-maroon shadow-sm">
          {refreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.2} />
          ) : (
            <ArrowDown className={cn('h-5 w-5 transition-transform', ready && 'rotate-180')} strokeWidth={2.2} />
          )}
        </span>
      </div>
      <div style={{ transform: `translateY(${pull}px)`, transition: settling ? 'transform .2s' : 'none' }}>
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
