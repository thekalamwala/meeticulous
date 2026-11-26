// KeptSheet — the Kept bottom sheet (phone) / dialog (desktop).
//
// Phone: rises from the bottom with a grab handle; swipe the handle or header
// down, tap the backdrop or press Esc to close. Page scroll is locked while open,
// height caps at 92dvh and the footer pads for the home indicator.
// Desktop (lg+): the same content as a centred 32px-radius dialog.
//
// The drag starts only from the handle/header (dragControls), so scrolling a long
// form inside the sheet never gets mistaken for a swipe-to-close.
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import useIsMobile from '../../../hooks/useIsMobile';
import { cn } from './cn';

const EASE = [0.22, 0.61, 0.36, 1];

export default function KeptSheet({ open, onClose, title, sub, children, footer, className = '' }) {
  const phone = useIsMobile('(max-width: 1023px)');
  const reduce = useReducedMotion();
  const drag = useDragControls();
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.focus(), 60);
    return () => { clearTimeout(t); document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const motionProps = phone
    ? {
      initial: reduce ? { opacity: 0 } : { y: '100%' },
      animate: reduce ? { opacity: 1 } : { y: 0 },
      exit: reduce ? { opacity: 0 } : { y: '100%' },
      transition: { duration: 0.26, ease: EASE },
      drag: 'y', dragListener: false, dragControls: drag,
      dragConstraints: { top: 0, bottom: 0 }, dragElastic: { top: 0, bottom: 0.6 },
      onDragEnd: (_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onClose(); },
    }
    : {
      initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 },
      animate: { opacity: 1, scale: 1 },
      exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 },
      transition: { duration: 0.18, ease: EASE },
    };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="dash fixed inset-0 z-[80] flex items-end justify-center lg:items-center lg:p-6">
          <motion.div key="bg" aria-hidden="true" className="absolute inset-0 bg-ink/40" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
          <motion.div key="sheet" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className={cn('relative flex max-h-[92dvh] w-full flex-col bg-white outline-none',
              'rounded-t-[28px] lg:max-h-[86dvh] lg:max-w-[560px] lg:rounded-[32px] lg:shadow-[var(--shadow-lg)]', className)}
            {...motionProps}>
            <div className="shrink-0 touch-none select-none pt-2 lg:pt-0" onPointerDown={(e) => phone && drag.start(e)}>
              <div aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-neutral-300 lg:hidden" />
              <div className="flex items-start gap-3 px-5 pb-3 pt-3 lg:px-6 lg:pt-6">
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="mb-0 font-display text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink lg:text-[22px]">{title}</h2>
                  {sub && <p className="mb-0 mt-1 text-[13px] text-muted lg:text-[14px]">{sub}</p>}
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                  className="-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-muted transition-colors hover:bg-blush hover:text-maroon focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
                  <X className="h-5 w-5" strokeWidth={2.2} />
                </button>
              </div>
            </div>
            <div className="dash-noscrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 lg:px-6">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-neutral-200/70 px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 lg:px-6 lg:pb-5">{footer}</div>
            )}
            {!footer && <div aria-hidden="true" className="h-[env(safe-area-inset-bottom,0px)] shrink-0" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
