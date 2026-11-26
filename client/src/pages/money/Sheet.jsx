// Money detail surface: the Drawer side panel on desktop, a bottom sheet on a
// phone (MOBILE_APP_UI §3.9). Same shape as the Bookings sheet (sd/kept-bookings):
// grab handle drags it down, a flick / backdrop / Esc closes it, body scroll locks,
// max 92dvh, footer clears the home indicator.
// ponytail: page-local copy, lift into ui/v2.jsx once the Kept pages have merged.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { Drawer, cn } from '../../components/dashboard/ui/v2';

const DESKTOP = '(min-width: 1024px)';
export const useIsDesktop = () => {
  const [is, setIs] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP);
    if (!mq) return undefined;
    const on = () => setIs(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return is;
};

export const EASE = [0.22, 0.61, 0.36, 1]; // brand easing, no bounce
const ring = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';

const BottomSheet = ({ open, onClose, title, footer, children, bodyClassName = '' }) => {
  const drag = useDragControls();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  const from = reduce ? { opacity: 0 } : { y: '100%' };
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="sheet-backdrop" className="fixed inset-0 z-[100] bg-ink/45" aria-hidden="true" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.section key="sheet" role="dialog" aria-modal="true" aria-label={title}
            className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[32px] bg-white shadow-[var(--shadow-lg)]"
            initial={from} animate={{ y: 0, opacity: 1 }} exit={{ ...from, transition: { duration: 0.18, ease: EASE } }}
            transition={{ duration: 0.26, ease: EASE }}
            drag="y" dragControls={drag} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, { offset, velocity }) => { if (offset.y > 110 || velocity.y > 500) onClose(); }}>
            <header onPointerDown={(e) => drag.start(e)} className="shrink-0 cursor-grab touch-none px-5 pb-3 pt-2.5">
              <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-neutral-300" />
              <div className="flex items-center gap-3">
                <h2 className="mb-0 min-w-0 flex-1 truncate font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
                <button type="button" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Close"
                  className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-cream text-muted transition-transform duration-100 active:scale-95', ring)}>
                  <X className="h-5 w-5" strokeWidth={2.2} />
                </button>
              </div>
            </header>
            <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4', bodyClassName)}>{children}</div>
            {footer && <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{footer}</footer>}
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export const Sheet = (props) => (useIsDesktop() ? <Drawer {...props} /> : <BottomSheet {...props} />);
