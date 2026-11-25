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
export const Avatar = ({ name, size = 'h-9 w-9 text-[12px]' }) => (
  <span className={cn('grid shrink-0 place-items-center rounded-full bg-blush font-semibold text-maroon', size)} aria-hidden="true">
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
            className={cn('fixed inset-y-0 right-0 z-[101] flex w-full flex-col bg-white dash-elev-3', width)}>
            <header className="flex shrink-0 items-start gap-3 border-b border-neutral-200 px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="mb-0 truncate font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 truncate text-[13px] text-faint">{subtitle}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-blush hover:text-maroon focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
                <X className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/* ── Panel — the one card shape. ───────────────────────────────────────── */
// Kept (founder-approved 2026-11-25): a card is a white surface on the cream page,
// with no border and the kit's 24px card radius. The earlier 8px cap (2026-11-18)
// was a reaction to big corners on 2px-BORDERED panels; with the border gone the
// big radius reads right. `flush` panels (lists, tables) keep one hairline under
// the header so rows don't touch the title.
export const Panel = ({ title, subtitle, action, children, className = '', flush = false }) => {
  const head = title || action;
  return (
    <section className={cn('overflow-hidden rounded-[24px] bg-white', className)}>
      {head && (
        <header className={cn('flex flex-wrap items-start justify-between gap-2 px-5 pt-5 sm:px-6',
          flush ? 'border-b border-neutral-200 pb-4' : 'pb-0')}>
          <div className="min-w-0">
            {title && <h2 className="mb-0 font-display text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[20px]">{title}</h2>}
            {subtitle && <p className="mt-1 text-[13px] text-faint">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? '' : cn('px-5 pb-5 sm:px-6 sm:pb-6', head ? 'pt-4' : 'pt-5 sm:pt-6')}>{children}</div>
    </section>
  );
};

/* ── PageHeading — a section's top heading. ────────────────────────────── */
export const PageHeading = ({ title, sub, action }) => (
  <header className="flex flex-wrap items-end justify-between gap-3 pb-1">
    <div className="min-w-0">
      <h1 className="mb-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon sm:text-[34px]">{title}</h1>
      {sub && <p className="mt-1.5 text-[14px] text-muted sm:text-[15px]">{sub}</p>}
    </div>
    {action}
  </header>
);

/* ── SubNav — in-section sub-page tabs over REAL routes. ───────────────────
 * Money/Schedule/Bookings graduate to one page + this nav; each tab is a real
 * URL (the old routes), so bookmarks and deep links keep working. */
export const SubNav = ({ items }) => (
  <nav aria-label="Sub-pages" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 dash-noscrollbar">
    {items.map((it) => (
      <NavLink key={it.to} to={it.to} end={it.end}
        className={({ isActive }) => cn(
          'shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
          isActive ? 'bg-maroon text-white' : 'text-muted hover:bg-blush hover:text-maroon')}>
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
      className={cn('flex min-w-0 flex-col rounded-[20px] bg-white p-4 text-left transition sm:p-5',
        // Featured = a maroon ring, never a filled maroon tile: the filled tile was
        // the loudest thing on the page even when its value was ₹0 (Kept audit).
        accent && 'ring-2 ring-inset ring-maroon',
        onClick && 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose')}>
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-muted">{label}</span>
        {spark && <span className="mt-px shrink-0">{spark}</span>}
      </div>
      {/* tabular-nums: a tile's value is a figure — money, a count, a percentage —
          and tiles sit in a row, so proportional digits make neighbouring values
          jitter against each other and shift width as they refresh. Harmless on
          the few tiles whose value is a word: it only affects digits. */}
      <span className="mt-2 font-display text-[24px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink sm:text-[28px]">{value}</span>
      {footer && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px]">
          {delta != null && (
            <span className={cn('inline-flex shrink-0 items-center gap-0.5 font-semibold', up ? 'text-success-fg' : 'text-error-fg')}>
              {up ? <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.4} /> : <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.4} />}
              {up ? '+' : ''}{delta}%
            </span>
          )}
          <span className="truncate text-faint">{delta != null ? deltaLabel || 'vs last period' : hint}</span>
          {more && <span className="ml-auto shrink-0 font-semibold text-maroon">{more} →</span>}
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
export const StatusPill = ({ status, children, icon: Icon }) => {
  const [word, cls] = STATUS_WORD[status] || [children || status, 'bg-neutral-100 text-ink/55'];
  return <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', cls)}>{Icon && <Icon className="h-3 w-3" strokeWidth={2.6} />}{children || word}</span>;
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
        <div className="flex shrink-0 flex-col justify-between py-0.5 text-right text-[11px] tabular-nums text-faint" style={{ height }}>
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
                    <span className="pointer-events-none absolute -top-5 whitespace-nowrap text-[11px] font-semibold text-ink">{format(x[valueKey])}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-[2px]">
            {data.map((x) => <span key={x[labelKey]} className="flex-1 text-center text-[11.5px] text-faint">{x[labelKey]}</span>)}
          </div>
          {hover != null && (
            <div className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[12px] bg-ink px-3 py-2 text-[12px] font-semibold text-white"
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
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r[labelKey]}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[14px] font-medium text-ink">{r[labelKey]}</span>
            <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-ink">
              {format(r[valueKey])}{secondary && <span className="ml-1.5 font-normal text-faint">{secondary(r)}</span>}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-maroon" style={{ width: `${(r[valueKey] / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

/* ── SourceDonut — interactive donut for a categorical split (where bookings
 * came from). Single-hue maroon ramp — tints of the brand hue, never a rainbow.
 * Hover/tap a slice or legend row to focus it: the hole reads that source's
 * count, share and name; tap again to clear. Donut + legend sit side-by-side on
 * a wide panel, wrap to a column when narrow (stack), so one component serves
 * both layouts. Ported verbatim from the lab's labUi.jsx. ─────────────────── */
const DONUT_RAMP = ['#960D32', '#B83651', '#E0506F', '#F27D93', '#FF9FB0', '#C8B0B8'];

export const SourceDonut = ({ rows, valueKey = 'bookings', labelKey = 'label', stack = false }) => {
  const [active, setActive] = useState(null);
  const [hover, setHover] = useState(null);
  const shown = hover ?? active;
  const toggle = (i) => setActive((p) => (p === i ? null : i));

  const total = rows.reduce((s, r) => s + (r[valueKey] || 0), 0) || 1;
  const SIZE = 150; const SW = 22; const GROW = 5; const GAP = 2.5;
  // Leave room for the active ring's extra width so it never clips the viewBox.
  const R = (SIZE - SW - GROW) / 2 - 1;
  const C = 2 * Math.PI * R;

  let cum = 0;
  const segs = rows.map((r, i) => {
    const frac = (r[valueKey] || 0) / total;
    const seg = { i, frac, offset: cum, color: DONUT_RAMP[i % DONUT_RAMP.length], row: r };
    cum += frac;
    return seg;
  });
  const sel = shown == null ? null : segs[shown];

  return (
    <div className={cn('flex items-center justify-center', stack ? 'flex-col gap-3' : 'flex-wrap gap-x-5 gap-y-3')}>
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`Bookings by source — ${rows[0]?.[labelKey]} leads with ${Math.round((segs[0]?.frac || 0) * 100)}% of ${total}`}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#F1EBE9" strokeWidth={SW} />
            {segs.map((s) => {
              const on = shown === s.i;
              const len = Math.max(s.frac * C - GAP, 0.001);
              return (
                <circle
                  key={s.i}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={on ? SW + GROW : SW}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-(s.offset * C)}
                  className="cursor-pointer transition-[stroke-width,opacity] duration-150"
                  style={{ opacity: shown == null || on ? 1 : 0.8 }}
                  onMouseEnter={() => setHover(s.i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => toggle(s.i)}
                />
              );
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-[20px] font-extrabold leading-none tracking-[-0.04em] text-ink">
            {sel ? (
              <>{sel.row[valueKey].toLocaleString('en-IN')}<span className="text-ink/35">/{total.toLocaleString('en-IN')}</span></>
            ) : total.toLocaleString('en-IN')}
          </span>
          <span className="mt-1 text-[11px] font-bold tabular-nums tracking-[0.02em] text-maroon">
            {sel ? `${Math.round(sel.frac * 100)}%` : 'booked'}
          </span>
        </div>
      </div>

      <ul className={cn('flex flex-col gap-0.5', stack ? 'w-full' : 'min-w-[150px] flex-1')}>
        {segs.map((s) => {
          const on = shown === s.i;
          return (
            <li key={s.i}>
              <button
                type="button"
                onMouseEnter={() => setHover(s.i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => toggle(s.i)}
                className={cn('flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition', on ? 'bg-blush' : 'hover:bg-cream')}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink/80">{s.row[labelKey]}</span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink">{(s.row[valueKey]).toLocaleString('en-IN')}</span>
                <span className="w-9 shrink-0 text-right text-[10.5px] font-bold tabular-nums text-ink/45">{Math.round(s.frac * 100)}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/* ── Brand marks for the booking-drawer actions. Third-party logos kept as
 * inline SVG so they render offline and keep their real colours on a white
 * button. Ported verbatim from labUi.jsx. ─────────────────────────────────── */
export const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#25D366" d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z" />
    <path fill="#fff" d="M9.516 7.391c-.17-.379-.349-.387-.513-.394l-.436-.005a.84.84 0 00-.608.285c-.21.229-.797.779-.797 1.9 0 1.12.817 2.204.93 2.356.115.152 1.575 2.52 3.886 3.433 1.918.757 2.309.606 2.725.569.416-.038 1.343-.549 1.532-1.08.19-.531.19-.986.133-1.08-.057-.096-.21-.153-.436-.266-.228-.114-1.343-.663-1.551-.739-.209-.076-.36-.114-.513.114-.152.228-.588.738-.721.89-.133.152-.266.171-.494.057-.228-.114-.963-.355-1.834-1.132-.678-.605-1.136-1.352-1.269-1.58-.133-.228-.014-.351.1-.465.102-.102.228-.266.342-.398.113-.133.151-.228.228-.38.076-.153.038-.285-.019-.399-.057-.114-.5-1.236-.705-1.688z" />
  </svg>
);

export const MeetIcon = ({ className }) => (
  <svg viewBox="0 0 87.5 72" className={className} aria-hidden="true">
    <path fill="#00832d" d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z" />
    <path fill="#0066da" d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z" />
    <path fill="#e94235" d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z" />
    <path fill="#2684fc" d="M20.5 20.5H0v31h20.5z" />
    <path fill="#00ac47" d="M82.6 8.68L69.5 19.44v34.4l13.16 10.8c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.91-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.84z" />
    <path fill="#ffba00" d="M63.5 0h-43v20.5h29V36l20-16.56V6c0-3.315-2.685-6-6-6z" />
  </svg>
);

/* ── InsightBand — the one focal surface per page (Kept). ─────────────────
 * Maroon-700 band with the loop pattern, ONE ee thread and at most one mascot.
 * States the page's single most important finding as a sentence built from real
 * figures, with at most two actions. Once per page, at the top. Mascot by domain:
 * purple = Intelligence/Pro, orange = Money/KYC, blue = Bookings/Today,
 * green = Grow/first steps. Decorative art is aria-hidden. */
const MASCOT = {
  purple: '/about/mascot-purple.png', orange: '/about/mascot-orange.png',
  blue: '/about/mascot-blue.png', green: '/about/mascot-green.png',
};
export const InsightBand = ({ eyebrow, title, sub, actions, aside, mascot, className = '' }) => (
  <section className={cn('relative isolate overflow-hidden rounded-[28px] bg-maroon-700 px-5 py-6 text-white sm:rounded-[32px] sm:px-9 sm:py-8', className)}>
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-50"
      style={{ backgroundImage: 'url(/brand/ds/03-patterns/mt-pattern-loop-on-maroon.svg)', backgroundSize: '180px' }} />
    <img src="/brand/ds/02-ee/mt-ee-thread-pink.svg" alt="" aria-hidden="true"
      className="pointer-events-none absolute -bottom-2 -right-24 -z-10 w-[420px] opacity-90 sm:w-[560px]" />
    {mascot && MASCOT[mascot] && (
      <img src={MASCOT[mascot]} alt="" aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-2 w-[104px] sm:right-6 sm:w-[180px]" />
    )}
    <div className={cn('grid gap-5', aside && 'lg:grid-cols-[1.25fr_1fr] lg:items-center', mascot && 'pr-[96px] sm:pr-[190px]')}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-pink">{eyebrow}</p>}
        <h2 className="mb-0 mt-2 max-w-[22ch] font-display text-[24px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-[32px]">{title}</h2>
        {sub && <p className="mt-2.5 max-w-[48ch] text-[14px] text-white/80 sm:text-[15px]">{sub}</p>}
        {actions && <div className="mt-5 flex flex-wrap gap-2.5">{actions}</div>}
      </div>
      {aside && <div className="min-w-0">{aside}</div>}
    </div>
  </section>
);
