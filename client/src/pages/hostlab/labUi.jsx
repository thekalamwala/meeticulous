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
import { Search, TrendingDown, TrendingUp, X } from 'lucide-react';
import { cn } from '../../components/dashboard/ui';
import { pageMeta } from './nav';

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

/* ── SubPageHeader — every sub-page gets a real heading of its own ─────── */
export const SubPageHeader = ({ page, action, children }) => (
  <header className="flex flex-wrap items-end justify-between gap-2">
    <div className="min-w-0">
      <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">
        {page.label}
      </h1>
      <p className="mt-0.5 text-[12px] font-medium text-ink/55">{children || page.blurb}</p>
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
            placeholder="Search bookings, clients, services…"
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
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-neutral-100 text-[10px] font-bold text-maroon">
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
  <section className={cn('overflow-hidden rounded-lg border-2 border-neutral-200 bg-white', className)}>
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
export const FIELD =
  'block rounded-sm border-2 border-neutral-200 bg-white px-2.5 text-[12px] font-medium text-ink ' +
  'outline-none transition placeholder:text-ink/35 focus:border-maroon/50 ' +
  'focus-visible:ring-[3px] focus-visible:ring-rose disabled:bg-neutral-50 disabled:text-ink/40';

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
