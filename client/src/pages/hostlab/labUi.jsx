// ─────────────────────────────────────────────────────────────────────────────
// Host Lab — prototype-only primitives.
//
// Everything the real kit (components/dashboard/ui) already has is imported from
// there, not re-written: Button, Card, Modal (incl. `drawer`), Tabs, DataTable,
// EmptyState, Badge, Input/Select/Textarea, SegmentedControl, ConfirmSheet…
// This file holds ONLY the pieces the kit is missing, so a graduating screen
// keeps the kit and brings just these along.
//
// Charts: every chart in the lab is SINGLE-SERIES (one measure over time, or one
// measure across stages/sources), so there is no categorical palette and nothing
// to colour-separate — one brand hue, direct labels, recessive axes. Status
// colours (success/warning/error tokens) always ship with a word, never alone.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowRight, CalendarCheck2, Check, ChevronDown, Clock, IndianRupee,
  Search, Star, TrendingDown, TrendingUp, UserMinus, X,
} from 'lucide-react';
import { cn } from '../../components/dashboard/ui';
import { pageMeta } from './nav';

/* ── Drawer ───────────────────────────────────────────────────────────────
 * Two bugs in the kit's Modal, both only visible once you close one.
 *
 * 1. It slides in and then vanishes. AnimatePresence can only play an exit
 *    while its child is still mounted, and the callers returned null the
 *    moment the selection cleared — so the component was gone before the
 *    animation could start. `open` is a prop here, and the caller keeps the
 *    last item on screen while it leaves (see useLast).
 *
 * 2. The list jumped. Locking the body with `overflow: hidden` drops the
 *    scroll position and removes the scrollbar, so the page reflows and the
 *    row you clicked is no longer under your cursor. This pins the body at a
 *    negative offset instead and keeps the scrollbar gutter, so nothing moves
 *    horizontally or vertically — and restores the exact position on close.
 * ---------------------------------------------------------------------- */

/** Holds the last non-null value, so content does not blank out mid-exit. */
export const useLast = (value) => {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return value ?? ref.current;
};

// No scroll lock, deliberately. Two attempts at one both broke the page:
// `overflow: hidden` on the body drops the scroll position and removes the
// scrollbar, so the list jumps sideways and loses your place; pinning the body
// with `position: fixed` and a negative top takes it out of flow, its height
// collapses, and the list behind the drawer disappears entirely.
//
// A side panel does not need the page frozen. Touch nothing, and the list stays
// exactly where it was — which was the point of locking it in the first place.
// The background stays scrollable behind the drawer, which is what Linear's
// side peek does too.
export const Drawer = ({ open, onClose, title, subtitle, children, width = 'sm:w-[480px]' }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Both children are motion components with keys, and neither is wrapped in a
  // plain element. AnimatePresence only tracks its DIRECT children: with a
  // <div> in between, the panel mounted at `initial` and stayed there — it
  // never animated in, and there was nothing for the exit to play on. So each
  // positions itself rather than sharing a flex wrapper.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-backdrop"
            className="fixed inset-0 z-[100] bg-ink/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            // Tween, not spring. A spring asymptotes, so AnimatePresence never
            // sees the exit finish and leaves the node mounted off-screen.
            // Bounded easing also matches the brand's 140–220ms, no-bounce rule.
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn('fixed inset-y-0 right-0 z-[101] flex w-full flex-col border-l-2 border-neutral-200 bg-white dash-elev-3', width)}
          >
            <header className="flex shrink-0 items-start gap-2 border-b-2 border-neutral-200 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <h2 className="mb-0 truncate font-display text-[13.5px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 truncate text-[11px] font-medium text-ink/50">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-xs text-ink/45 transition hover:bg-blush hover:text-maroon"
              >
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

/* ── useSubPage ───────────────────────────────────────────────────────────
 * A destination's sub-pages are real routes (/host-lab/money/payouts), not a
 * ?tab= on one page. This reads which one is open from the path and hands back
 * its entry from nav.js, so the heading, the rail and the router all read the
 * same declaration. An unknown slug falls back to the first.
 * ---------------------------------------------------------------------- */
export const useSubPage = (parent) => {
  const { page } = useParams();
  return pageMeta(parent, page);
};

/* ── SubPageHeader — every page gets a real heading of its own ──────────
 *
 * Two ways in, because two kinds of page exist:
 *   <SubPageHeader page={page} />        a sub-page, titled from its nav.js entry
 *   <SubPageHeader title="Today">…</…>   a destination with no sub-pages of its
 *                                        own (Today, Catalog, Clients), or one
 *                                        titled from its data (the editor)
 *
 * `page` wins when both are given. The subtitle is `children` if present, else
 * the nav blurb — so a page whose subtitle is computed live (today's date, a
 * row count, a sum) passes it as children and still gets the shared heading.
 *
 * This is deliberately NOT a tab strip. nav.js states the console's rule: if it
 * has a URL in the rail it is a page, if it is a subset of one list it is a
 * filter, nothing is a tab. This renders the heading only.
 * ---------------------------------------------------------------------- */
export const SubPageHeader = ({ page, title, action, children }) => (
  <header className="flex flex-wrap items-end justify-between gap-2">
    <div className="min-w-0">
      <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">
        {page ? page.label : title}
      </h1>
      <p className="mt-0.5 text-[12px] font-medium text-ink/55">{children || page?.blurb}</p>
    </div>
    {action}
  </header>
);

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

/* ── dates ─────────────────────────────────────────────────────────────── */
export const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const fmtDayFull = (iso) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '');
export const relDay = (iso) => {
  const d = new Date(iso);
  const t = new Date();
  const days = Math.round((d.setHours(0, 0, 0, 0) - t.setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days < 0 ? `${-days} days ago` : `In ${days} days`;
};

/* ── LabBanner — says plainly that nothing here is real ────────────────── */
export const LabBanner = () => (
  <div className="flex items-center gap-1.5 overflow-hidden border-b-2 border-marigold-300 bg-marigold-100 px-2.5 py-1 text-[10.5px] font-semibold text-marigold-800">
    <span className="shrink-0 rounded-full bg-marigold px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-ink">Prototype</span>
    <span className="truncate">Redesign proposal for the host dashboard. Sample data only — nothing here reads or writes your real account.</span>
  </div>
);

/* ── Tile — the console's one stat shape ──────────────────────────────────
 * Anatomy, borrowed from the compact reference: label and a trend mark share
 * the top line, the figure sits alone, and the delta and the way deeper share
 * a footer rule. Everything is optional, so the same component covers a bare
 * number, a number with a sparkline, and a number you can click through.
 * ---------------------------------------------------------------------- */
export const Tile = ({ label, value, delta, deltaLabel, hint, onClick, accent = false, spark, more, children }) => {
  const Tag = onClick ? 'button' : 'div';
  const up = delta != null && delta >= 0;
  const footer = delta != null || hint || more;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col rounded-md border-2 p-2.5 text-left transition',
        accent ? 'border-maroon bg-maroon text-white' : 'border-neutral-200 bg-white',
        onClick && 'hover:border-maroon/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className={cn('truncate text-[10px] font-bold uppercase tracking-[0.07em]', accent ? 'text-white/70' : 'text-ink/45')}>{label}</span>
        {spark && <span className="mt-px shrink-0 opacity-90">{spark}</span>}
      </div>

      <span className={cn('mt-1 font-display text-[17px] font-extrabold leading-none tracking-[-0.035em]', accent ? 'text-white' : 'text-ink')}>
        {value}
      </span>

      {footer && (
        <div className={cn('mt-2 flex items-center gap-1.5 border-t pt-1.5 text-[10.5px] font-semibold', accent ? 'border-white/20' : 'border-neutral-200')}>
          {delta != null && (
            <span className={cn('inline-flex shrink-0 items-center gap-0.5', accent ? 'text-white/85' : up ? 'text-success-fg' : 'text-error-fg')}>
              {up ? <TrendingUp className="h-3 w-3" strokeWidth={2.6} /> : <TrendingDown className="h-3 w-3" strokeWidth={2.6} />}
              {up ? '+' : ''}{delta}%
            </span>
          )}
          <span className={cn('truncate font-medium', accent ? 'text-white/65' : 'text-ink/45')}>
            {delta != null ? deltaLabel || 'vs last period' : hint}
          </span>
          {more && <span className={cn('ml-auto shrink-0 font-bold', accent ? 'text-white' : 'text-maroon')}>{more} →</span>}
        </div>
      )}
      {children}
    </Tag>
  );
};

/* Chip, AppliedChip and Dropdown lived here. They were the four-row filter
 * bar; filters.jsx replaced all three with one row. Removed rather than kept
 * around, so nothing drifts back to the old pattern. */

/* ── Toggle ────────────────────────────────────────────────────────────── */
export const Toggle = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative h-6 w-9 shrink-0 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
      checked ? 'border-maroon bg-maroon' : 'border-neutral-300 bg-neutral-100',
      disabled && 'cursor-not-allowed opacity-45',
    )}
  >
    <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
  </button>
);

/* ── BarChart — single series, magnitude over time ─────────────────────────
 * One hue (maroon). Bars are thin with 4px rounded tops anchored to the
 * baseline and a 2px surface gap between them. Grid is recessive, y-axis is
 * three labels, and every bar has a hover tooltip. No legend: the title names
 * the only series. Direct labels are selective — the max bar only.
 * ---------------------------------------------------------------------- */
export const BarChart = ({ data, valueKey = 'revenue', labelKey = 'month', format = (v) => inr(v, { compact: true }), height = 180 }) => {
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const ticks = [max, max / 2, 0];
  const maxIdx = data.findIndex((d) => d[valueKey] === max);

  return (
    <div className="relative">
      <div className="flex gap-2">
        {/* y axis */}
        <div className="flex shrink-0 flex-col justify-between py-0.5 text-right text-[9.5px] font-semibold tabular-nums text-ink/35" style={{ height }}>
          {ticks.map((t) => <span key={t}>{format(t)}</span>)}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* recessive grid */}
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((t) => <span key={t} className="h-px w-full bg-neutral-200/70" />)}
          </div>
          <div className="relative flex items-end gap-[2px]" style={{ height }}>
            {data.map((d, i) => {
              const h = Math.max((d[valueKey] / max) * 100, 1.5);
              const on = hover === i;
              return (
                <button
                  key={d[labelKey]}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${d[labelKey]}: ${format(d[valueKey])}`}
                  className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
                >
                  <span
                    className={cn('w-full max-w-[26px] rounded-t transition-colors', on ? 'bg-maroon-dark' : 'bg-maroon')}
                    style={{ height: `${h}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
                  />
                  {i === maxIdx && !on && (
                    <span className="pointer-events-none absolute -top-4 whitespace-nowrap text-[9.5px] font-bold text-ink/55">
                      {format(d[valueKey])}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* x axis */}
          <div className="mt-1.5 flex gap-[2px]">
            {data.map((d) => (
              <span key={d[labelKey]} className="flex-1 text-center text-[9.5px] font-semibold text-ink/40">{d[labelKey]}</span>
            ))}
          </div>
          {hover != null && (
            <div
              className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[10.5px] font-semibold text-white"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              {data[hover][labelKey]} · {format(data[hover][valueKey])}
              {data[hover].bookings != null && <span className="text-white/60"> · {data[hover].bookings} bookings</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Sparkline — single series, no axis, decoration-free ───────────────── */
export const Sparkline = ({ values, width = 62, height = 20 }) => {
  const d = useMemo(() => {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    return values
      .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 3) - 1.5}`)
      .join(' ');
  }, [values, width, height]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend over the last 12 months" className="shrink-0">
      <polyline points={d} fill="none" stroke="#960D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ── RankedBars — one measure across named rows (sources, services) ───────
 * Horizontal, single hue, every row direct-labelled. This is the honest form
 * for "which of these is biggest" — never a pie, never five hues.
 * ---------------------------------------------------------------------- */
export const RankedBars = ({ rows, valueKey = 'views', labelKey = 'label', format = (v) => v.toLocaleString('en-IN'), secondary }) => {
  const max = Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r[labelKey]}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[11.5px] font-semibold text-ink/80">{r[labelKey]}</span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink">
              {format(r[valueKey])}
              {secondary && <span className="ml-1.5 font-medium text-ink/45">{secondary(r)}</span>}
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

/* ── SourceDonut — interactive donut for a categorical split (where bookings
 * came from). Single-hue maroon ramp — tints of the brand hue, never a
 * rainbow. Tap a slice or a legend row to focus it: the hole reads out that
 * source's count, share and name; tap again to clear back to the total. Donut
 * and legend sit side-by-side when the panel is wide and wrap to a column when
 * it is narrow, so one component serves mobile and desktop. ─────────────── */
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
 * button. ─────────────────────────────────────────────────────────────────── */
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

/* ── NeedsYouModal — the "hardest first" action queue as a progress checklist
 * (one component for mobile and desktop). A segmented progress bar up top, then
 * accordion rows: a status dot (open = dashed ring, handled = green check), the
 * title + urgency chip, and a chevron. One row expands at a time to reveal the
 * detail and three controls — the CTA, ✓ handled, ✗ dismiss. ───────────────── */
const NEEDS_ICON = { confirm: CalendarCheck2, unpaid: IndianRupee, lapsing: UserMinus, review: Star, gap: Clock };
const NEEDS_URGENCY = {
  now: ['Now', 'bg-error-bg text-error-fg'],
  today: ['Today', 'bg-warning-bg text-warning-fg'],
  this_week: ['This week', 'bg-neutral-100 text-ink/55'],
};

export const NeedsYouModal = ({ open, onClose, items = [], go }) => {
  const [done, setDone] = useState([]);
  const [openId, setOpenId] = useState(items[0]?.id ?? null);

  const total = items.length;
  const resolved = done.length;
  const allDone = total > 0 && resolved >= total;
  const resolve = (id) => {
    setDone((d) => (d.includes(id) ? d : [...d, id]));
    const next = items.find((x) => x.id !== id && !done.includes(x.id));
    setOpenId(next ? next.id : null);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120]">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 rounded-none bg-ink/40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-2 border-neutral-200 bg-white shadow-xl"
          >
            <header className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.02em] text-ink">Needs you</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-ink/50">
                {allDone ? 'All caught up — nicely done.' : `${resolved} of ${total} handled · hardest first`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 transition hover:border-maroon/40 hover:text-maroon"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
          <div className="mt-3 flex gap-1.5">
            {items.map((a, i) => (
              <span key={a.id} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < resolved ? 'bg-maroon' : 'bg-neutral-200')} />
            ))}
          </div>
        </header>

        <ul className="flex-1 divide-y-2 divide-neutral-200 overflow-y-auto border-t-2 border-neutral-200">
          {items.map((a) => {
            const isDone = done.includes(a.id);
            const isOpen = openId === a.id;
            const Icon = NEEDS_ICON[a.kind] || AlertTriangle;
            const [word, chip] = NEEDS_URGENCY[a.urgency] || NEEDS_URGENCY.this_week;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                  className="flex w-full items-center gap-3 rounded-none px-4 py-3 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose"
                >
                  {isDone ? (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success-fg text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-dashed border-maroon/40 text-maroon">
                      <Icon className="h-3 w-3" strokeWidth={2.6} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[12.5px] font-bold leading-tight', isDone ? 'text-ink/40 line-through' : 'text-ink')}>
                      {a.title}
                    </span>
                  </span>
                  {!isDone && (
                    <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-bold', chip)}>{word}</span>
                  )}
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink/40 transition-transform', isOpen && 'rotate-180')} strokeWidth={2.4} />
                </button>

                <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="px-4 pb-3 pl-[52px]">
                      <p className="text-[11.5px] font-medium leading-snug text-ink/60">{a.detail}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { onClose(); go(a.target); }}
                          className="inline-flex items-center gap-1 rounded-full bg-maroon px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
                        >
                          {a.cta} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
                        </button>
                        <button
                          type="button"
                          onClick={() => resolve(a.id)}
                          aria-label="Mark handled"
                          title="Mark handled"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 text-ink/45 transition hover:border-success-fg hover:text-success-fg"
                        >
                          <Check className="h-4 w-4" strokeWidth={2.6} />
                        </button>
                        <button
                          type="button"
                          onClick={() => resolve(a.id)}
                          aria-label="Dismiss"
                          title="Dismiss"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 text-ink/45 transition hover:border-maroon/40 hover:text-maroon"
                        >
                          <X className="h-4 w-4" strokeWidth={2.6} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* ── Funnel — one measure across ordered stages, with step drop-off ────── */
export const Funnel = ({ stages }) => {
  const top = stages[0]?.value || 1;
  return (
    <ol className="flex flex-col gap-2">
      {stages.map((s, i) => {
        const prev = i === 0 ? null : stages[i - 1].value;
        const drop = prev ? 1 - s.value / prev : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] font-semibold text-ink/80">{s.label}</span>
              <span className="text-[11.5px] font-bold tabular-nums text-ink">
                {s.value.toLocaleString('en-IN')}
                <span className="ml-1.5 text-[10.5px] font-semibold text-ink/40">{pct(s.value / top)} of views</span>
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-lg bg-neutral-100">
              <div
                className="flex h-full items-center rounded-lg bg-maroon px-2 text-[10px] font-bold text-white"
                style={{ width: `${Math.max((s.value / top) * 100, 6)}%` }}
              />
            </div>
            {drop != null && (
              <p className="mt-1 text-[10.5px] font-medium text-ink/45">
                {pct(drop)} drop from {stages[i - 1].label.toLowerCase()}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
};

/* ── CommandPalette — one search box over bookings, clients and services ─ */
export const CommandPalette = ({ open, onClose, items, onPick }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.slice(0, 8);
    return items.filter((it) => `${it.title} ${it.subtitle || ''} ${it.group}`.toLowerCase().includes(needle)).slice(0, 10);
  }, [q, items]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && results[sel]) { e.preventDefault(); onPick(results[sel]); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, results, sel, onClose, onPick]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-2.5 pt-[12vh]">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Search" className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 border-neutral-200 bg-white dash-elev-3">
        <div className="flex items-center gap-1.5 border-b-2 border-neutral-200 px-2.5 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2.4} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or jump to anything…"
            className="w-full bg-transparent text-[12px] font-medium text-ink outline-none placeholder:text-ink/35"
          />
          <kbd className="shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[9.5px] font-bold text-ink/40">esc</kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-2.5 py-8 text-center text-[11.5px] font-medium text-ink/45">Nothing matches “{q}”.</li>
          ) : (
            results.map((it, i) => (
              <li key={it.id}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => { onPick(it); onClose(); }}
                  className={cn('flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition', i === sel ? 'bg-blush' : 'hover:bg-cream')}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-neutral-100 text-[10px] font-bold text-maroon">
                    {it.group.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-ink">{it.title}</span>
                    {it.subtitle && <span className="block truncate text-[10.5px] text-ink/50">{it.subtitle}</span>}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink/35">{it.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
};

/* ── StatusPill — state always carries a word, never colour alone ──────── */
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

/* ── SectionCard — the one card shape the lab uses ─────────────────────── */
export const Panel = ({ title, subtitle, action, children, className = '', flush = false }) => (
  <section className={cn('overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(43,10,20,0.03),0_8px_24px_-12px_rgba(43,10,20,0.08)]', className)}>
    {(title || action) && (
      <header className="flex flex-wrap items-center justify-between gap-1.5 border-b border-neutral-200/70 px-3.5 py-2.5">
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

/* ── RADIUS AT CONSOLE DENSITY ────────────────────────────────────────────
 * The brand radius scale (inputs 16 · slots 20 · cards 24 · dialogs 32) was
 * drawn for booking-page furniture, where the smallest thing it names is tall.
 * Carried onto a 24px list row, a 16px corner is two thirds of the height and
 * the row reads as a capsule — which is exactly how this prototype went wrong
 * after two density passes scaled padding and heights but left radii alone.
 *
 * Rule: a radius is about a third of the element's height, capped by the brand
 * scale. Nothing is square-cornered; nothing below 40px tall is a pill either.
 *
 *   24px sub-row ......... rounded-xs  (6px)
 *   28–32px row / input .. rounded-sm  (10px)
 *   tiles, popovers ...... rounded-md  (16px)
 *   panels, cards ........ rounded-lg  (20px)
 *   dialogs .............. rounded-3xl (32px)
 *   chips, badges, buttons pill — the brand mandates these, and they are
 *                          short-and-wide, so a pill reads as intended.
 * ---------------------------------------------------------------------- */

/* ── Fields ───────────────────────────────────────────────────────────────
 * The kit's Form.jsx still ships pre-rebrand styling: `rounded` (10px) where
 * the radius scale says inputs are 16px, cold `border-gray-300` instead of the
 * warm neutral ramp, a 2px primary focus ring instead of the 3px rose one, and
 * a Select chevron whose SVG stroke is still hardcoded BLUE (#00457C) from the
 * old palette. Rather than restyle a shared production component from inside a
 * prototype, the lab uses these, and the fix is filed as a P0 in the report.
 * ---------------------------------------------------------------------- */
// Minimalist: clean bottom border instead of a full frame, transparent, no ring
// — the Field label sits above. Matches the user-facing .fb-input style.
export const FIELD =
  'block border-solid border-x-0 border-t-0 border-b-[1.5px] rounded-none border-neutral-200 bg-transparent px-0.5 text-[12px] font-medium text-ink ' +
  'outline-none transition placeholder:text-ink/35 focus:border-maroon ' +
  'focus-visible:ring-0 disabled:text-ink/40';

// `cn` is a plain string joiner — it does NOT resolve Tailwind conflicts. So a
// base `w-full` silently beats a caller's `w-[116px]` (whichever Tailwind emits
// last wins, not whichever was passed last). Rather than add tailwind-merge for
// one prototype, each default is applied only when the caller supplied none.
const unless = (className, prefix, fallback) =>
  (new RegExp(`(^|\\s)${prefix}-`).test(className) ? '' : fallback);

export const LabInput = ({ className = '', ...props }) => (
  <input className={cn(FIELD, unless(className, 'w', 'w-full'), unless(className, 'h', 'h-8'), className)} {...props} />
);

export const LabSelect = ({ className = '', children, ...props }) => (
  <select
    className={cn(FIELD, 'cursor-pointer appearance-none pr-8', unless(className, 'w', 'w-full'), unless(className, 'h', 'h-8'), className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23960D32' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem center' }}
    {...props}
  >
    {children}
  </select>
);

export const LabTextarea = ({ className = '', rows = 3, ...props }) => (
  <textarea rows={rows} className={cn(FIELD, unless(className, 'w', 'w-full'), 'py-1.5', className)} {...props} />
);

export const Field = ({ label, hint, htmlFor, children, className = '' }) => (
  <label htmlFor={htmlFor} className={cn('block', className)}>
    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink/45">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[10.5px] font-medium text-ink/45">{hint}</span>}
  </label>
);

/* ── Avatar ────────────────────────────────────────────────────────────── */
export const Avatar = ({ name, size = 'h-8 w-8 text-[10.5px]' }) => (
  <span className={cn('grid shrink-0 place-items-center rounded-full bg-blush font-bold text-maroon', size)}>
    {(name || 'G').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
  </span>
);
