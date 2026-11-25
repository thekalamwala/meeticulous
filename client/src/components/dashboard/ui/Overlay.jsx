import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './cn';

function useLockBody(open) {
  useEffect(() => {
    if (!open) return undefined;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    // Pad by the scrollbar width so hiding it doesn't shift the page right.
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [open]);
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
}

const MODAL_SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

// Right-side drawer widths (used when `drawer` is set).
const DRAWER_SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md', className = '', drawer = false }) {
  useLockBody(open);
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            'fixed inset-0 z-[100] flex',
            drawer ? 'justify-end' : 'items-end justify-center p-0 sm:items-center sm:p-4',
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={drawer ? { x: '100%' } : { y: 24, opacity: 0, scale: 0.98 }}
            animate={drawer ? { x: 0 } : { y: 0, opacity: 1, scale: 1 }}
            exit={drawer ? { x: '100%' } : { y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cn(
              'relative bg-white dash-elev-3',
              drawer
                ? cn('flex h-full w-full flex-col rounded-l-2xl', DRAWER_SIZES[size] || DRAWER_SIZES.lg)
                : cn('w-full rounded-t-xl sm:rounded-xl', MODAL_SIZES[size]),
              className,
            )}
          >
            {/* Mobile grabber — signals a draggable native sheet (centered modal only). */}
            {!drawer && <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-neutral-300 sm:hidden" aria-hidden="true" />}
            {(title || onClose) && (
              <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-4">
                <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className={cn('overflow-y-auto px-5 py-4', drawer ? 'flex-1' : 'max-h-[70vh]')}>{children}</div>
            {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-100 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Sheet({ open, onClose, title, children, side = 'bottom', className = '' }) {
  useLockBody(open);
  useEscape(open, onClose);
  const isBottom = side === 'bottom';
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={isBottom ? { y: '100%' } : { x: '100%' }}
            animate={isBottom ? { y: 0 } : { x: 0 }}
            exit={isBottom ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className={cn(
              'absolute bg-white dash-elev-3',
              isBottom ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl' : 'inset-y-0 right-0 w-[88%] max-w-sm',
              className,
            )}
          >
            {isBottom && <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-neutral-300" />}
            {title && <div className="px-5 pb-2 pt-3 text-base font-semibold text-neutral-900">{title}</div>}
            <div
              className="dash-noscrollbar overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
              style={{ maxHeight: isBottom ? '78vh' : '100%' }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default Modal;
