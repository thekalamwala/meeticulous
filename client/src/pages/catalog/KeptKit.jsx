// Kept building blocks for the Catalog's type pages (Products, Courses,
// Discounts, Memberships). Each page keeps its own state, API calls and
// handlers; these only give it the Kept shell, so the five pages read as one
// family with the Catalog list:
//   KeptHeader   back to Catalog, large title, desktop action
//   PinnedAction the phone's thumb-zone action, above the tab bar
//   KeptList/Row grouped rows: full-row tap, photo or type tile, each fact on
//                its own truncating line, a switch on the right
//   KeptEditor   the item editor: a pushed full screen on a phone, a side panel
//                on desktop (the v2 Drawer), Save pinned in its footer, filled
//                Kept inputs inside (FieldStyle)
//   KeptEmpty / KeptError / KeptSkeleton  honest states
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { Drawer, PageHeading, InsightBand, Toggle, cn } from '../../components/dashboard/ui/v2';
import { ErrorState, Skeleton, FieldStyle } from '../../components/dashboard/ui';

export const press = 'transition-[transform,background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 touch-manipulation select-none [-webkit-touch-callout:none]';
export const ring = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
export const control = `rounded-[12px] ${ring} ${press}`;
export const primaryBtn = cn(control, 'inline-flex h-11 items-center justify-center gap-2 bg-maroon px-5 text-[14px] font-semibold text-white hover:bg-maroon-dark disabled:opacity-60');
export const quietBtn = cn(control, 'inline-flex h-11 items-center justify-center gap-2 bg-cream px-4 text-[14px] font-semibold text-maroon hover:bg-blush disabled:opacity-60');
const serif = 'font-serif font-normal italic text-pink';
const bandBtn = 'inline-flex h-11 items-center gap-2 rounded-[12px] bg-white px-5 text-[14px] font-semibold text-maroon transition hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink';

/** Page wrapper: room under the last card for the pinned phone action. */
export const KeptPage = ({ children, pinned = true }) => (
  <div className={cn('flex flex-col gap-6', pinned && 'pb-28 sm:pb-0')}>{children}</div>
);

export const KeptHeader = ({ title, sub, action }) => (
  <div className="flex flex-col gap-1">
    <Link to="/dashboard/catalog" className={cn('-ml-2 inline-flex h-10 w-fit items-center gap-1 px-2 text-[14px] font-semibold text-muted hover:bg-blush hover:text-maroon', control)}>
      <ChevronLeft className="h-5 w-5" strokeWidth={2.4} /> Catalog
    </Link>
    <PageHeading title={title} sub={sub} action={action ? <span className="hidden sm:block">{action}</span> : null} />
  </div>
);

/** Phone thumb-zone action above the tab bar, clear of its raised centre
 *  button. Portalled: transformed shell wrappers would pin it to themselves. */
export const PinnedAction = ({ show = true, children }) => (show ? createPortal(
  <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+76px)] z-30 flex gap-2 bg-cream/90 px-4 pb-9 pt-2 backdrop-blur-md sm:hidden">
    {children}
  </div>,
  document.body,
) : null);
export const pinnedBtn = cn(control, 'flex h-12 flex-1 items-center justify-center gap-2 bg-maroon text-[15px] font-semibold text-white active:bg-maroon-dark disabled:opacity-60');

export const KeptBand = ({ eyebrow, title, human, sub, mascot, action }) => (
  <InsightBand compact mascot={mascot} className="sm:py-7" eyebrow={eyebrow}
    title={<>{title} {human && <em className={serif}>{human}</em>}</>}
    sub={sub} actions={action ? <button type="button" onClick={action.onClick} className={bandBtn}>{action.icon}{action.label}</button> : null} />
);

/* ── Rows ──────────────────────────────────────────────────────────────── */
export const KeptList = ({ label, head, children }) => (
  <section aria-label={label} className="overflow-hidden rounded-[24px] bg-white">
    {head && <header className="flex items-center gap-2 border-b border-neutral-200 py-2.5 pl-5 pr-2.5 sm:pl-6">{head}</header>}
    <ul className="divide-y divide-neutral-200">{children}</ul>
  </section>
);

export const RowThumb = ({ image, icon: Icon, glyph, className = 'h-14 w-14 sm:h-12 sm:w-12' }) => {
  const [broken, setBroken] = useState(false);
  if (image && !broken) return <img src={image} alt="" loading="lazy" onError={() => setBroken(true)} className={cn('shrink-0 rounded-[14px] object-cover', className)} />;
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-[14px] bg-blush text-maroon', className)}>
      {glyph ? <span className="font-display text-[15px] font-extrabold">{glyph}</span> : Icon ? <Icon className="h-5 w-5" strokeWidth={2} /> : null}
    </span>
  );
};

/** One record: full-row tap opens it; `trailing` holds the switch / actions. */
export const KeptRow = ({ thumb, title, detail, price, note, onOpen, trailing, children }) => (
  <li className="flex items-center gap-2 pl-4 pr-2 sm:pl-5 sm:pr-3">
    <button type="button" onClick={onOpen} disabled={!onOpen}
      className={cn('flex min-w-0 flex-1 items-center gap-3 py-3 text-left', ring, onOpen && press, onOpen && 'rounded-[12px] hover:bg-pink-50/60')}>
      {thumb}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14.5px] font-semibold text-ink sm:text-[15.5px]">{title}</span>
        {detail && <span className="truncate text-[12.5px] text-muted sm:text-[13.5px]">{detail}</span>}
        {price && (
          <span className="truncate text-[13px] font-semibold tabular-nums text-maroon sm:text-[14px]">
            {price}{note && <span className="font-normal text-faint"> · {note}</span>}
          </span>
        )}
        {children}
      </span>
    </button>
    {trailing && <span className="flex shrink-0 items-center gap-1">{trailing}</span>}
  </li>
);

/** The visible / active switch, inside a 44px target. */
export const RowSwitch = ({ checked, onChange, label, busy, word }) => (
  <span className="flex items-center gap-2">
    {word && <span aria-hidden="true" className="hidden text-[13px] font-semibold text-muted sm:inline">{word}</span>}
    <span className="grid h-11 w-12 place-items-center">
      <Toggle checked={checked} onChange={onChange} disabled={busy} label={label} />
    </span>
  </span>
);

export const IconAction = ({ icon: Icon = Trash2, label, onClick, danger = false }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className={cn(control, 'grid h-11 w-11 place-items-center text-faint', danger ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-blush hover:text-maroon')}>
    <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
  </button>
);

/* ── Editor ────────────────────────────────────────────────────────────── */
/** Phone: a pushed full screen (the Drawer at full width slides in from the
 *  right). Desktop: the Drawer side panel. Save is pinned in the footer and
 *  submits the form by id, so it works from outside the scrolling body. */
export const KeptEditor = ({ open, onClose, title, subtitle, formId, saving, saveLabel, onDelete, deleteLabel = 'Delete', children }) => (
  <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle} width="sm:w-[520px]"
    footer={(
      <div className="flex items-center gap-2">
        {onDelete && (
          <button type="button" onClick={onDelete} className={cn(control, 'mr-auto inline-flex h-11 items-center gap-1.5 px-3 text-[14px] font-semibold text-rose-700 hover:bg-rose-50')}>
            <Trash2 className="h-4 w-4" strokeWidth={2.2} /> {deleteLabel}
          </button>
        )}
        <button type="button" onClick={onClose} className={cn(quietBtn, !onDelete && 'ml-auto')}>Cancel</button>
        <button type="submit" form={formId} disabled={saving} className={cn(primaryBtn, 'min-w-[132px]')}>{saving ? 'Saving…' : saveLabel}</button>
      </div>
    )}>
    <FieldStyle.Provider value="filled">
      <div className="[&_label]:text-ink">{children}</div>
    </FieldStyle.Provider>
  </Drawer>
);

/* ── States ────────────────────────────────────────────────────────────── */
export const KeptEmpty = ({ icon: Icon, title, sub, action }) => (
  <div className="flex flex-col items-center gap-3 rounded-[24px] bg-white px-6 py-12 text-center">
    {Icon && <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-blush text-maroon"><Icon className="h-6 w-6" strokeWidth={2} /></span>}
    <p className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{title}</p>
    {sub && <p className="mb-0 max-w-sm text-[14px] text-muted">{sub}</p>}
    {action}
  </div>
);

export const KeptError = ({ what, onRetry }) => (
  <div className="rounded-[24px] bg-white">
    <ErrorState title={`We couldn't load your ${what}.`} message={`Your ${what} are safe. This is a problem showing them. Try again.`} onRetry={onRetry} />
  </div>
);

export const KeptSkeleton = ({ rows = 3 }) => (
  <ul aria-hidden="true" className="divide-y divide-neutral-200 overflow-hidden rounded-[24px] bg-white">
    {Array.from({ length: rows }, (_, i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <Skeleton className="h-14 w-14 !rounded-[14px] sm:h-12 sm:w-12" />
        <span className="flex flex-1 flex-col gap-2"><Skeleton className="h-3.5 w-40 max-w-full" /><Skeleton className="h-3 w-28" /></span>
        <Skeleton className="h-6 w-9 !rounded-full" />
      </li>
    ))}
  </ul>
);

/** A white card section with a title, for non-list content (program details, members). */
export const KeptCard = ({ title, sub, action, children, className = '' }) => (
  <section className={cn('rounded-[24px] bg-white p-5 sm:p-6', className)}>
    {(title || action) && (
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {title && <h2 className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink sm:text-[20px]">{title}</h2>}
          {sub && <p className="mb-0 mt-1 text-[13px] text-faint">{sub}</p>}
        </div>
        {action}
      </header>
    )}
    {children}
  </section>
);
