// ─────────────────────────────────────────────────────────────────────────────
// Dashboard v2 — shared UI kit.
//
// The production primitives the Host Lab redesign needs that the base kit
// (index.js) does not already have, promoted here as the ONE source of truth so
// every graduated section (Clients, Today, Bookings, Money, …) shares them and
// nothing drifts. Pure presentational — no API, no mock data, no app state.
//
// Base-kit pieces (Button, Card, Modal, SegmentedControl, DataTable, Textarea,
// EmptyState, ErrorState, Skeleton, fmtMoney) are still imported from '../ui'
// where they fit; this file only adds what was missing, ported from the lab's
// labUi.jsx verbatim so the look is identical.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TrendingDown, TrendingUp, X } from 'lucide-react';
import { cn } from './cn';

export { cn };

/* ── Money + number formatting ─────────────────────────────────────────── */
export const inr = (n, opts = {}) => {
  const v = Number(n) || 0;
  if (opts.compact && Math.abs(v) >= 1000) {
    if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.00$/, '')}Cr`;
    if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.00$/, '')}L`;
    return `₹${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: opts.decimals ? 2 : 0, minimumFractionDigits: opts.decimals ? 2 : 0 })}`;
};
export const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;

/* ── Dates ─────────────────────────────────────────────────────────────── */
const d = (iso) => new Date(iso);
export const fmtDay = (iso) => (iso ? d(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');
export const fmtDayFull = (iso) => (iso ? d(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');
export const fmtTime = (iso) =>
  iso ? d(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '') : '—';
export const relDay = (iso) => {
  if (!iso) return '—';
  const dd = new Date(iso);
  const t = new Date();
  const days = Math.round((dd.setHours(0, 0, 0, 0) - t.setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days < 0 ? `${-days} days ago` : `In ${days} days`;
};
export const initialsOf = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

/* ── Avatar ────────────────────────────────────────────────────────────── */
export const Avatar = ({ name, size = 'h-8 w-8 text-[10.5px]' }) => (
  <span className={cn('grid shrink-0 place-items-center rounded-full bg-blush font-bold text-maroon', size)} aria-hidden="true">
    {initialsOf(name)}
  </span>
);

/* ── useLast — hold the last non-null value so content doesn't blank mid-exit. */
export const useLast = (value) => {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return value ?? ref.current;
};

/* ── Drawer — right-side peek, animated, no scroll lock (Linear-style). ─── */
export const Drawer = ({ open, onClose, title, subtitle, children, width = 'sm:w-[480px]' }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="drawer-backdrop" className="fixed inset-0 z-[100] bg-ink/35"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose} aria-hidden="true" />
          <motion.aside key="drawer-panel" role="dialog" aria-modal="true" aria-label={title}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn('fixed inset-y-0 right-0 z-[101] flex w-full flex-col border-l-2 border-neutral-200 bg-white dash-elev-3', width)}>
            <header className="flex shrink-0 items-start gap-2 border-b-2 border-neutral-200 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <h2 className="mb-0 truncate font-display text-[13.5px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 truncate text-[11px] font-medium text-ink/50">{subtitle}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-xs text-ink/45 transition hover:bg-blush hover:text-maroon">
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/* ── Panel — the one card shape. ───────────────────────────────────────── */
export const Panel = ({ title, subtitle, action, children, className = '', flush = false }) => (
  // Outer table/list container capped at 8px — the big Loop & Slot radius read
  // as off on these full-width data panels (founder call, 2026-11-18).
  <section className={cn('overflow-hidden rounded-[8px] border-2 border-neutral-200 bg-white', className)}>
    {(title || action) && (
      <header className="flex flex-wrap items-center justify-between gap-1.5 border-b-2 border-neutral-200 px-3 py-2">
        <div className="min-w-0">
          {title && <h2 className="mb-0 font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-[10.5px] font-medium text-ink/50">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    <div className={flush ? '' : 'p-3'}>{children}</div>
  </section>
);

/* ── PageHeading — a section's top heading. ────────────────────────────── */
export const PageHeading = ({ title, sub, action }) => (
  <header className="flex flex-wrap items-end justify-between gap-2">
    <div className="min-w-0">
      <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">{title}</h1>
      {sub && <p className="mt-0.5 text-[12px] font-medium text-ink/55">{sub}</p>}
    </div>
    {action}
  </header>
);

/* ── SubNav — in-section sub-page tabs over REAL routes. ───────────────────
 * Money/Schedule/Bookings graduate to one page + this nav; each tab is a real
 * URL (the old routes), so bookmarks and deep links keep working. */
export const SubNav = ({ items }) => (
  <nav aria-label="Sub-pages" className="flex gap-1 overflow-x-auto rounded-full border-2 border-neutral-200 bg-white p-1 dash-noscrollbar">
    {items.map((it) => (
      <NavLink key={it.to} to={it.to} end={it.end}
        className={({ isActive }) => cn(
          'shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
          isActive ? 'bg-maroon text-white' : 'text-ink/55 hover:bg-blush hover:text-maroon')}>
        {it.label}
      </NavLink>
    ))}
  </nav>
);

/* ── Tile — the one stat shape. ────────────────────────────────────────── */
export const Tile = ({ label, value, delta, deltaLabel, hint, onClick, accent = false, spark, more, children }) => {
  const Tag = onClick ? 'button' : 'div';
  const up = delta != null && delta >= 0;
  const footer = delta != null || hint || more;
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={cn('flex min-w-0 flex-col rounded-md border-2 p-2.5 text-left transition',
        accent ? 'border-maroon bg-maroon text-white' : 'border-neutral-200 bg-white',
        onClick && 'hover:border-maroon/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose')}>
      <div className="flex items-start justify-between gap-1.5">
        <span className={cn('truncate text-[10px] font-bold uppercase tracking-[0.07em]', accent ? 'text-white/70' : 'text-ink/45')}>{label}</span>
        {spark && <span className="mt-px shrink-0 opacity-90">{spark}</span>}
      </div>
      <span className={cn('mt-1 font-display text-[17px] font-extrabold leading-none tracking-[-0.035em]', accent ? 'text-white' : 'text-ink')}>{value}</span>
      {footer && (
        <div className={cn('mt-2 flex items-center gap-1.5 border-t pt-1.5 text-[10.5px] font-semibold', accent ? 'border-white/20' : 'border-neutral-200')}>
          {delta != null && (
            <span className={cn('inline-flex shrink-0 items-center gap-0.5', accent ? 'text-white/85' : up ? 'text-success-fg' : 'text-error-fg')}>
              {up ? <TrendingUp className="h-3 w-3" strokeWidth={2.6} /> : <TrendingDown className="h-3 w-3" strokeWidth={2.6} />}
              {up ? '+' : ''}{delta}%
            </span>
          )}
          <span className={cn('truncate font-medium', accent ? 'text-white/65' : 'text-ink/45')}>{delta != null ? deltaLabel || 'vs last period' : hint}</span>
          {more && <span className={cn('ml-auto shrink-0 font-bold', accent ? 'text-white' : 'text-maroon')}>{more} →</span>}
        </div>
      )}
      {children}
    </Tag>
  );
};

/* ── StatusPill — state always carries a word, never colour alone. ─────── */
const STATUS_WORD = {
  confirmed: ['Confirmed', 'bg-maroon-100 text-maroon-700'],
  pending: ['Needs confirming', 'bg-warning-bg text-warning-fg'],
  completed: ['Done', 'bg-success-bg text-success-fg'],
  cancelled: ['Cancelled', 'bg-neutral-100 text-ink/55'],
  no_show: ['No-show', 'bg-error-bg text-error-fg'],
  paid: ['Paid', 'bg-success-bg text-success-fg'],
  unpaid: ['Unpaid', 'bg-warning-bg text-warning-fg'],
  refunded: ['Refunded', 'bg-neutral-100 text-ink/55'],
  processed: ['Settled', 'bg-success-bg text-success-fg'],
  in_transit: ['In transit', 'bg-warning-bg text-warning-fg'],
  active: ['Active', 'bg-success-bg text-success-fg'],
  inactive: ['Hidden', 'bg-neutral-100 text-ink/55'],
  expired: ['Expired', 'bg-error-bg text-error-fg'],
  used_up: ['Used up', 'bg-error-bg text-error-fg'],
};
export const StatusPill = ({ status, children }) => {
  const [word, cls] = STATUS_WORD[status] || [children || status, 'bg-neutral-100 text-ink/55'];
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold', cls)}>{children || word}</span>;
};

/* ── Toggle ────────────────────────────────────────────────────────────── */
export const Toggle = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn('relative h-6 w-9 shrink-0 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
      checked ? 'border-maroon bg-maroon' : 'border-neutral-300 bg-neutral-100', disabled && 'cursor-not-allowed opacity-45')}>
    <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
  </button>
);

/* ── Charts — single-series, one brand hue. ────────────────────────────── */
export const BarChart = ({ data, valueKey = 'revenue', labelKey = 'month', format = (v) => inr(v, { compact: true }), height = 180 }) => {
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map((x) => x[valueKey]), 1);
  const ticks = [max, max / 2, 0];
  const maxIdx = data.findIndex((x) => x[valueKey] === max);
  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex shrink-0 flex-col justify-between py-0.5 text-right text-[9.5px] font-semibold tabular-nums text-ink/35" style={{ height }}>
          {ticks.map((t) => <span key={t}>{format(t)}</span>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((t) => <span key={t} className="h-px w-full bg-neutral-200/70" />)}
          </div>
          <div className="relative flex items-end gap-[2px]" style={{ height }}>
            {data.map((x, i) => {
              const h = Math.max((x[valueKey] / max) * 100, 1.5);
              const on = hover === i;
              return (
                <button key={x[labelKey]} type="button"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  aria-label={`${x[labelKey]}: ${format(x[valueKey])}`}
                  className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none">
                  <span className={cn('w-full max-w-[26px] rounded-t transition-colors', on ? 'bg-maroon-dark' : 'bg-maroon')}
                    style={{ height: `${h}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                  {i === maxIdx && !on && (
                    <span className="pointer-events-none absolute -top-4 whitespace-nowrap text-[9.5px] font-bold text-ink/55">{format(x[valueKey])}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-[2px]">
            {data.map((x) => <span key={x[labelKey]} className="flex-1 text-center text-[9.5px] font-semibold text-ink/40">{x[labelKey]}</span>)}
          </div>
          {hover != null && (
            <div className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[10.5px] font-semibold text-white"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
              {data[hover][labelKey]} · {format(data[hover][valueKey])}
              {data[hover].bookings != null && <span className="text-white/60"> · {data[hover].bookings} bookings</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Sparkline = ({ values, width = 62, height = 20 }) => {
  const pts = useMemo(() => {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    return values.map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 3) - 1.5}`).join(' ');
  }, [values, width, height]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend" className="shrink-0">
      <polyline points={pts} fill="none" stroke="#960D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const RankedBars = ({ rows, valueKey = 'views', labelKey = 'label', format = (v) => v.toLocaleString('en-IN'), secondary }) => {
  const max = Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r[labelKey]}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[11.5px] font-semibold text-ink/80">{r[labelKey]}</span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink">
              {format(r[valueKey])}{secondary && <span className="ml-1.5 font-medium text-ink/45">{secondary(r)}</span>}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-maroon" style={{ width: `${(r[valueKey] / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};
