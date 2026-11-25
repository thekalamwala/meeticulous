// Insights (Kept) — the few pieces the four tabs share. Page-local on purpose:
// sibling pages are being redesigned in parallel, so nothing here touches ui/v2.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { cn } from '../../components/dashboard/ui/v2';

export const serif = 'font-serif font-normal italic text-pink';
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* Band actions — same shapes as Today's band buttons (TodayV2 keeps its own copy). */
const bandBtn = 'inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink';
export const BandLink = ({ to, ghost = false, children }) => (
  <Link to={to} className={cn(bandBtn, ghost
    ? 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60'
    : 'bg-white text-maroon hover:bg-pink-100')}>{children}</Link>
);

export const linkBtn = 'inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[13.5px] font-semibold text-maroon transition hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';

/* "2026-10" → "Oct" (or "Oct 25" when the series crosses a year). */
export const monthLabel = (ym, withYear = false) => {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString('en-IN', withYear ? { month: 'short', year: '2-digit' } : { month: 'short' });
};
export const monthLong = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
/* 0 → "12 am", 15 → "3 pm". */
export const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;

/* Load one endpoint: null while loading, false on error, the payload when done. */
export const useInsight = (fetcher, key = '') => {
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    setData(null);
    fetcher().then((r) => setData(r?.data || {})).catch(() => setData(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); }, [load]);
  return [data, load];
};

export const Loading = () => (
  <div className="flex flex-col gap-4 sm:gap-5" aria-busy="true" aria-label="Loading">
    <Skeleton className="h-[200px] rounded-[28px] sm:rounded-[32px]" />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[112px] rounded-[20px]" />)}
    </div>
    <Skeleton className="h-[280px] rounded-[24px]" />
  </div>
);

export const Failed = ({ what, onRetry }) => (
  <div className="rounded-[24px] bg-white">
    <ErrorState title={`We couldn't load your ${what}.`}
      message="Your bookings and money are safe. This is a problem showing them. Try again." onRetry={onRetry} />
  </div>
);

/* Notice (Kept): a white card, a blush icon chip, one sentence. */
export const Notice = ({ icon: Icon, children }) => (
  <div className="flex items-start gap-3 rounded-[24px] bg-white p-4 sm:p-5">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-blush text-maroon"><Icon className="h-[18px] w-[18px]" strokeWidth={2.2} /></span>
    <p className="mb-0 self-center text-[14px] text-ink">{children}</p>
  </div>
);

/* A big figure with a caption — for panels that state two or three numbers. */
export const Fact = ({ label, value, hint, tone }) => (
  <div className="min-w-0 rounded-[16px] bg-cream px-4 py-3">
    <p className="mb-0 truncate text-[13px] text-muted">{label}</p>
    <p className={cn('mb-0 mt-1 font-display text-[22px] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-[24px]', tone || 'text-ink')}>{value}</p>
    {hint && <p className="mb-0 mt-1.5 truncate text-[12.5px] text-faint">{hint}</p>}
  </div>
);

/* Pro preview — the block's layout as grey ghost shapes. A locked block never
 * renders a number, not even a zero: the server sent none. The ask lives in the
 * band, so this carries a lock tag and one sentence, no second button. */
export const Ghost = ({ title, line, shape = 'bars' }) => (
  <section aria-label={`${title} — on Pro`} className="relative overflow-hidden rounded-[24px] bg-white p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="mb-0 font-display text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[20px]">{title}</h2>
        <p className="mb-0 mt-1 text-[13px] text-faint">{line}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-blush px-2.5 py-0.5 text-[12px] font-semibold text-maroon">
        <Lock className="h-3 w-3" strokeWidth={2.6} /> Pro
      </span>
    </div>
    <div aria-hidden="true" className="mt-5">
      {shape === 'bars' && (
        <div className="flex h-[132px] items-end gap-2">
          {[38, 62, 45, 84, 56, 30, 70].map((h, i) => <span key={i} className="flex-1 rounded-t-[6px] bg-neutral-100" style={{ height: `${h}%` }} />)}
        </div>
      )}
      {shape === 'figures' && (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-[16px] bg-cream px-4 py-3">
              <span className="block h-3 w-20 rounded-full bg-neutral-200/80" />
              <span className="mt-3 block h-6 w-24 rounded-[8px] bg-neutral-200/80" />
            </div>
          ))}
        </div>
      )}
      {shape === 'rows' && (
        <ul className="flex flex-col gap-3">
          {[0.9, 0.7, 0.5].map((w, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="h-9 w-9 shrink-0 rounded-full bg-neutral-100" />
              <span className="h-3 flex-1 rounded-full bg-neutral-100" style={{ maxWidth: `${w * 100}%` }} />
              <span className="h-3 w-14 shrink-0 rounded-full bg-neutral-100" />
            </li>
          ))}
        </ul>
      )}
    </div>
  </section>
);
