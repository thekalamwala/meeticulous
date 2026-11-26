// Kept bottom sheet for Catalog screens on a phone (MOBILE_APP_UI §3.9):
// grab handle; swipe down, backdrop or Esc closes; page scroll locked while
// open; max 92dvh; safe-area footer. Phone only (sm:hidden) — desktop uses a
// menu or the Drawer. Motion: 260ms brand easing; reduced motion keeps the fade.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../components/dashboard/ui/v2';

const EASE = [0.22, 0.61, 0.36, 1];

export default function BottomSheet({ open, onClose, title, children, footer, className = '' }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', k);
    const t = setTimeout(() => ref.current?.focus(), 60);
    return () => { clearTimeout(t); document.body.style.overflow = prev; document.removeEventListener('keydown', k); };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="sheet-bd" className="fixed inset-0 z-[70] bg-ink/40 sm:hidden" aria-hidden="true" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
          <motion.div key="sheet" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
            className={cn('dash-v2 fixed inset-x-0 bottom-0 z-[71] flex max-h-[92dvh] flex-col rounded-t-[28px] bg-white pt-2 outline-none sm:hidden', className)}
            initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.26, ease: EASE }}
            drag={reduce ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 500) onClose(); }}>
            <div aria-hidden="true" className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300" />
            <div className="flex shrink-0 items-center justify-between px-5 pb-2">
              <h2 className="mb-0 font-display text-[20px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close"
                className="grid h-11 w-11 place-items-center rounded-[12px] text-muted transition-colors hover:bg-blush focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
                <X className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>
            <div className="dash-noscrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">{children}</div>
            {footer && <div className="shrink-0 border-t border-neutral-200 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
