// Grow — the section shell every Grow tab renders inside, plus the few Kept
// pieces the tabs share (band buttons, bottom sheet, pinned thumb-zone bar).
//
// Phone (below lg) is an app screen, not the desktop page shrunk
// (design-system/MOBILE_APP_UI.md): a large title, one row of tab chips that
// sticks under the 56px top bar, and sheets that rise from the bottom.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import { markLinkShared } from '../../services/api';
import { Drawer, PageHeading, cn } from '../../components/dashboard/ui/v2';
import { activeGrowTab, growTabs, pageUrl } from './growModel';

/* Copy the public booking link. Ticks the setup checklist's "share" step with the
 * same localStorage key + share signal Today and GoLiveChecklist use. */
export const SHARE_KEY = 'mt_golive_link_shared';
export const readShared = () => { try { return localStorage.getItem(SHARE_KEY) === '1'; } catch { return false; } };
export const useCopyPageLink = (username, onCopied) => useCallback(async () => {
  const url = pageUrl(username);
  if (!url) { toast.error('Set your username first.'); return; }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Booking link copied');
    try { localStorage.setItem(SHARE_KEY, '1'); } catch { /* non-persistent is fine */ }
    markLinkShared();
    onCopied?.();
  } catch {
    toast.error('Could not copy your link.');
  }
}, [username, onCopied]);

export const ring = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
export const card = 'rounded-[24px] bg-white';
export const serif = 'font-serif font-normal italic text-pink';
// Links used as controls: no iOS long-press callout, no text selection on tap.
export const tappable = 'select-none [-webkit-touch-callout:none]';

/* ── Band buttons — same shapes as Today's band. ─────────────────────────── */
const bandBtn = cn('inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold transition', ring);
export const BandPrimary = ({ children, to, ...p }) => (to
  ? <Link to={to} className={cn(bandBtn, tappable, 'bg-white text-maroon hover:bg-pink-100')}>{children}</Link>
  : <button type="button" className={cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100')} {...p}>{children}</button>);
export const BandGhost = ({ children, href, ...p }) => (href
  ? <a href={href} target="_blank" rel="noreferrer" className={cn(bandBtn, tappable, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')}>{children}</a>
  : <button type="button" className={cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')} {...p}>{children}</button>);

/* ── Tabs — real links over the old routes. ─────────────────────────────── */
const GrowTabs = ({ tabs, active }) => {
  const rowRef = useRef(null);
  // Phone: the chip row scrolls sideways; bring the current tab into view.
  useEffect(() => {
    const el = rowRef.current?.querySelector('[aria-current="page"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [active]);
  return (
    <nav aria-label="Grow" ref={rowRef}
      className="dash-noscrollbar flex max-w-full gap-1 overflow-x-auto rounded-[14px] bg-white p-1 lg:w-fit">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link key={t.key} to={t.to} aria-current={on ? 'page' : undefined}
            className={cn('inline-flex h-10 shrink-0 items-center rounded-[10px] px-4 text-[13px] font-semibold transition-colors duration-150 lg:h-9 lg:text-[13.5px]', ring, tappable,
              on ? 'bg-maroon text-white' : 'text-muted hover:bg-blush hover:text-maroon active:bg-blush')}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default function GrowShell({ sub, action, children }) {
  const { pathname } = useLocation();
  const { flags } = useFeatureFlags();
  const tabs = growTabs(flags);
  const active = activeGrowTab(pathname, tabs);
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="hidden lg:block">
        <PageHeading title="Grow" sub={sub} action={action} />
      </div>
      {/* Phone: large title with the tab's one action beside it. */}
      <header className="flex items-center justify-between gap-3 lg:hidden">
        <div className="min-w-0">
          <h1 className="mb-0 font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon">Grow</h1>
          {sub && <p className="mb-0 mt-1 text-[13px] text-muted">{sub}</p>}
        </div>
        {action}
      </header>
      {/* Sticky under the 56px top bar on a phone, so switching tabs is always one tap. */}
      <div className="sticky top-14 z-20 -mx-4 bg-cream/95 px-4 py-1 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <GrowTabs tabs={tabs} active={active} />
      </div>
      {children}
    </div>
  );
}

/* ── Sheet — bottom sheet on a phone, the side Drawer on desktop. ─────────
 * MOBILE_APP_UI 3.9: grabber; drag the handle down (or flick), backdrop or Esc
 * closes; body scroll locked; max 92dvh; footer in the thumb zone. */
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

const EASE = [0.22, 0.61, 0.36, 1]; // brand easing, no bounce
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
          <motion.div key="grow-sheet-backdrop" className="fixed inset-0 z-[100] bg-ink/45" aria-hidden="true" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.section key="grow-sheet" role="dialog" aria-modal="true" aria-label={title}
            className="dash-v2 fixed inset-x-0 bottom-0 z-[101] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[32px] bg-white shadow-[var(--shadow-lg)]"
            initial={from} animate={{ y: 0, opacity: 1 }} exit={{ ...from, transition: { duration: 0.18, ease: EASE } }}
            transition={{ duration: 0.26, ease: EASE }}
            drag="y" dragControls={drag} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, { offset, velocity }) => { if (offset.y > 110 || velocity.y > 500) onClose(); }}>
            <header onPointerDown={(e) => drag.start(e)} className="shrink-0 cursor-grab touch-none px-5 pb-3 pt-2.5">
              <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-neutral-300" />
              <div className="flex items-center gap-3">
                <h2 className="mb-0 min-w-0 flex-1 truncate font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
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

/* ── PinnedBar — the screen's one main action, in the thumb zone. ─────────
 * Portalled to <body> so it sits OUTSIDE the shell's PullToRefresh (inside it,
 * the bar scrolled with the page — Clients hit this). Phone only: it rests on
 * the bottom tab bar (77px + safe area), clear of the raised Grow button. */
export const PinnedBar = ({ children, show = true }) => createPortal(
  <AnimatePresence>
    {show && (
      <motion.div key="grow-pinned" className="dash-v2 fixed inset-x-0 bottom-[calc(77px+env(safe-area-inset-bottom,0px))] z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
        {children}
      </motion.div>
    )}
  </AnimatePresence>,
  document.body,
);

/* ── Empty — an honest empty state with the green sprout (Grow / first steps). */
export const Empty = ({ title, body, action, compact = false }) => (
  <div className={cn('flex flex-col items-center px-5 text-center', compact ? 'py-6' : 'py-10')}>
    <img src="/about/mascot-green.png" alt="" aria-hidden="true" className={cn('object-contain', compact ? 'h-16 w-16' : 'h-24 w-24')} />
    <p className="mb-0 mt-3 font-display text-[17px] font-bold tracking-[-0.02em] text-ink lg:text-[18px]">{title}</p>
    {body && <p className="mb-0 mt-1 max-w-[40ch] text-[13.5px] text-muted lg:text-[14px]">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ── CardHead — a card's title row (18/20px), optional action on the right. */
export const CardHead = ({ title, sub, action, id }) => (
  <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
    <div className="min-w-0">
      <h2 id={id} className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink lg:text-[20px]">{title}</h2>
      {sub && <p className="mb-0 mt-1 text-[13px] text-muted lg:text-[14px]">{sub}</p>}
    </div>
    {action}
  </div>
);

export const press = 'transition active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100';
const btn = cn('inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-45', press, ring);
export const btnPrimary = cn(btn, 'bg-maroon text-white hover:bg-maroon-dark');
export const btnSoft = cn(btn, 'bg-blush text-maroon hover:bg-pink-100');
export const btnDanger = cn(btn, 'bg-error-bg text-error-fg hover:bg-error-bg/80');
export const input = 'w-full rounded-[16px] border border-neutral-200 bg-white px-3.5 text-[16px] text-ink placeholder:text-faint outline-none transition focus:border-maroon focus:ring-[3px] focus:ring-rose/40 lg:text-[15px]';
export const rowBase = cn('flex min-h-[56px] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-pink-50 active:bg-pink-50 sm:px-6', tappable, ring);

/* ── Field — label above, hint below; inputs stay 16px on a phone. */
export const Field = ({ label, hint, htmlFor, children, count }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink lg:text-[14px]">{label}</label>
      {count}
    </div>
    {children}
    {hint && <p className="mb-0 text-[12px] text-muted lg:text-[12.5px]">{hint}</p>}
  </div>
);
