// ─────────────────────────────────────────────────────────────────────────────
// Intelligence — the chart kit.
//
// Shape of the thing: Google Analytics' card grid. One card, one question, one
// chart, almost no prose. A number carries its own meaning; a paragraph under a
// chart means the chart failed.
//
// Own module rather than labUi.jsx because labUi is edited concurrently on the
// Host Lab branch. There is NO charting library in client/package.json and this
// does not add one — every shape is hand-rolled SVG.
//
// PALETTE — computed, not chosen. Run through the dataviz validator against the
// cream surface; all six checks pass (worst adjacent CVD ΔE 21.8 deutan):
//   series  #960D32  --mt-maroon       the one data colour. Single series = this.
//   open    #C68A12  marigold-600      ONLY where it means open/unbooked capacity,
//                                      which is what the brand reserves marigold for.
//   alt     #A12A47  rose-700          third slot, used once (lead time vs median).
// Marigold-500 (#F6C35A) FAILS the lightness band and contrast on cream — the
// 600 step is the one that passes, so that is the step used.
//
// Sequential (heatmap, cohort) is one hue light→dark from the maroon ramp.
// There is no dual-axis chart anywhere in here, by rule: two measures of
// different scale become two charts, never two y-scales.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Info, Lock, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../components/dashboard/ui';
import { inr } from './labUi';

export const C = {
  series: '#960D32',
  open: '#C68A12',
  alt: '#A12A47',
  grid: 'rgba(43, 10, 20, 0.09)',
  surface: '#FFFFFF',
};
const seriesAt = (a) => `rgba(150, 13, 50, ${a})`;

/** A rate, with a decimal where one matters: 4.3% and 3.6% must not both
 *  render as "4%". Whole numbers above 10%, where the decimal is noise. */
export const rate = (n) => {
  const v = (Number(n) || 0) * 100;
  return `${v > 0 && v < 10 ? v.toFixed(1) : Math.round(v)}%`;
};

const num = (n) => Number(n || 0).toLocaleString('en-IN');

/* ── Scorecard — the GA4 top row. Number, change, shape. No sentence. ───── */
export const Scorecard = ({ label, value, delta, spark, onClick, info, inverse = false }) => {
  const Tag = onClick ? 'button' : 'div';
  const good = delta == null ? null : inverse ? delta <= 0 : delta >= 0;
  const Icon = delta >= 0 ? TrendingUp : TrendingDown;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border-2 border-neutral-200 bg-white p-3 text-left transition',
        onClick && 'hover:border-maroon/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
      )}
    >
      <span className="flex items-center gap-1 text-[11px] font-semibold text-ink/50">
        <span className="truncate">{label}</span>
        {info && <Explain>{info}</Explain>}
      </span>
      <span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink">{value}</span>
      <div className="flex items-end justify-between gap-2">
        {/* undefined = this measure has no period comparison (a stock figure like
            pending payout); null = comparable, but no prior period exists yet. */}
        {delta === undefined ? <span /> : delta === null ? <span className="text-[11px] font-medium text-ink/35">no prior period</span> : (
          <span className={cn('inline-flex items-center gap-0.5 text-[11.5px] font-bold', good ? 'text-success-fg' : 'text-error-fg')}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2.6} />{delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
        {spark}
      </div>
    </Tag>
  );
};

/* ── Tooltip trigger — where a definition lives instead of in a paragraph ── */
export const Explain = ({ children }) => (
  <span className="group relative inline-flex">
    <Info className="h-3 w-3 cursor-help text-ink/30" strokeWidth={2.4} tabIndex={0} aria-label="What this means" />
    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-56 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white group-hover:block group-focus-within:block">
      {children}
    </span>
  </span>
);

/* ── Card — the grid unit. Title, optional link, chart. ────────────────── */
export const Card = ({ title, info, action, children, className = '' }) => (
  <section className={cn('flex flex-col rounded-xl border-2 border-neutral-200 bg-white p-3', className)}>
    <header className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 truncate text-[12.5px] font-bold text-ink">
        {title}
        {info && <Explain>{info}</Explain>}
      </h3>
      {action}
    </header>
    <div className="min-w-0 flex-1">{children}</div>
  </section>
);

export const CardLink = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex shrink-0 items-center gap-0.5 rounded-full text-[11px] font-bold text-maroon transition hover:gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
  >
    {children} <ArrowRight className="h-3 w-3" strokeWidth={2.8} />
  </button>
);

/* ── AreaChart — one measure over time. Crosshair + tooltip by default. ──
 *   One series only. Two measures of different scale get two of these, side
 *   by side, never two y-axes on one plot. ─────────────────────────────── */
export const AreaChart = ({ data, format = (v) => inr(v, { compact: true }), height = 128, color = C.series, id = 'a' }) => {
  const [hover, setHover] = useState(null);
  const W = 520;
  const PAD_B = 16;
  const max = Math.max(...data.map((d) => d.value), 1);
  const x = (i) => (i / Math.max(data.length - 1, 1)) * W;
  const y = (v) => 6 + (1 - v / max) * (height - PAD_B - 6);

  if (!data.length) return <p className="py-6 text-center text-[12px] font-medium text-ink/40">Nothing in this range.</p>;

  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${line} ${W},${height - PAD_B} 0,${height - PAD_B}`;
  const peak = data.reduce((a, b, i) => (b.value > data[a].value ? i : a), 0);
  const shown = hover ?? peak;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} role="img" aria-label={`${format(max)} peak over ${data.length} points`}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1="0" x2={W} y1={y(max * t)} y2={y(max * t)} stroke={C.grid} strokeWidth="1" />
        ))}
        <polygon points={area} fill={`url(#fill-${id})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1={x(shown)} x2={x(shown)} y1="0" y2={height - PAD_B} stroke={color} strokeWidth="1" strokeOpacity="0.35" />
        <circle cx={x(shown)} cy={y(data[shown].value)} r="4" fill={color} stroke={C.surface} strokeWidth="2" />
        {data.map((d, i) => (
          <rect
            key={d.label} x={x(i) - W / data.length / 2} y="0" width={W / data.length} height={height}
            fill="transparent" tabIndex={0} role="button" aria-label={`${d.label}: ${format(d.value)}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            className="cursor-crosshair focus:outline-none"
          />
        ))}
      </svg>
      <div className="flex items-center justify-between text-[10px] font-semibold text-ink/35">
        <span>{data[0].label}</span>
        <span className="rounded-full bg-cream px-2 py-0.5 text-[10.5px] font-bold text-ink/70">
          {data[shown].label} · {format(data[shown].value)}
        </span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
};

/* ── Bars — one measure across named rows, bar beside the label. ────────── */
export const Bars = ({ rows, valueKey = 'value', labelKey = 'label', format = num, color = C.series, note }) => {
  const max = Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r[labelKey]} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[11.5px] font-semibold text-ink/75">{r[labelKey]}</span>
            <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-ink">
              {format(r[valueKey])}
              {note && <span className="ml-1.5 font-medium text-ink/40">{note(r)}</span>}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${(r[valueKey] / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

/* ── SegmentedBar — part-to-whole at a glance. The one place a legend plus
 *   in-bar labels is correct (dataviz: tall segmented bar). ───────────── */
export const SegmentedBar = ({ segments, format = inr }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const shade = (i) => seriesAt(0.95 - (i / Math.max(segments.length - 1, 1)) * 0.65);
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <div
            key={s.label}
            title={`${s.label}: ${format(s.value)} (${rate(s.value / total)})`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / total) * 100}%`, background: shade(i) }}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-col gap-1">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-baseline gap-2 text-[11.5px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: shade(i) }} />
            <span className="truncate font-semibold text-ink/70">{s.label}</span>
            <span className="ml-auto shrink-0 font-bold tabular-nums text-ink">{format(s.value)}</span>
            <span className="w-9 shrink-0 text-right font-medium tabular-nums text-ink/40">{rate(s.value / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ── Waterfall — gross → deductions → net. The honest shape for subtraction. */
export const Waterfall = ({ rows }) => {
  const gross = rows[0]?.value || 1;
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const isTotal = r.kind === 'total';
        return (
          <li key={r.label} className={cn(isTotal && 'mt-1 border-t-2 border-neutral-200 pt-2')}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className={cn('truncate text-[11.5px]', isTotal ? 'font-bold text-ink' : 'font-semibold text-ink/70')}>{r.label}</span>
              <span className={cn('shrink-0 tabular-nums', isTotal ? 'text-[14px] font-extrabold text-ink' : 'text-[11.5px] font-bold text-ink/75')}>
                {r.kind === 'deduction' ? '−' : ''}{inr(Math.abs(r.value))}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max((Math.abs(r.value) / gross) * 100, 1)}%`,
                  background: isTotal ? C.series : r.kind === 'deduction' ? seriesAt(0.3) : seriesAt(0.6),
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

/* ── Funnel — ordered stages, each step against the one above it. ───────── */
export const Funnel = ({ stages }) => {
  const top = stages[0]?.value || 1;
  return (
    <ol className="flex flex-col gap-1.5">
      {stages.map((s, i) => {
        const drop = i === 0 ? null : 1 - s.value / stages[i - 1].value;
        const worst = i > 0 && drop === Math.max(...stages.slice(1).map((st, j) => 1 - st.value / stages[j].value));
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[11.5px] font-semibold text-ink/75">{s.label}</span>
              <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-ink">{num(s.value)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 flex-1 rounded-lg bg-neutral-100">
                <div className="h-full rounded-lg" style={{ width: `${Math.max((s.value / top) * 100, 2)}%`, background: seriesAt(0.95 - i * 0.14) }} />
              </div>
              <span className={cn('w-16 shrink-0 text-right text-[10.5px] font-bold tabular-nums', worst ? 'text-error-fg' : 'text-ink/35')}>
                {drop == null ? `${rate(1)}` : `−${rate(drop)}`}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

/* ── Heatmap — weekday × hour. Sequential, one hue light→dark. ──────────── */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const Heatmap = ({ grid, hours, onPick }) => {
  const max = Math.max(...grid.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-separate border-spacing-[2px]">
        <caption className="sr-only">Bookings by weekday and hour, IST</caption>
        <thead>
          <tr><th className="w-8" />{hours.map((h) => <th key={h} scope="col" className="pb-0.5 text-[9px] font-bold text-ink/35">{h}</th>)}</tr>
        </thead>
        <tbody>
          {grid.map((row, di) => (
            <tr key={DAYS[di]}>
              <th scope="row" className="pr-1 text-right text-[9.5px] font-bold text-ink/40">{DAYS[di]}</th>
              {row.map((v, hi) => (
                <td key={hours[hi]}>
                  <button
                    type="button"
                    onClick={() => onPick?.(DAYS[di], hours[hi], v)}
                    title={`${DAYS[di]} ${hours[hi]} · ${v} booking${v === 1 ? '' : 's'}`}
                    className="grid aspect-square w-full place-items-center rounded-md text-[9px] font-bold transition hover:ring-2 hover:ring-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
                    style={{ background: v ? seriesAt(0.1 + (v / max) * 0.8) : '#F5F5F5', color: v / max > 0.55 ? '#fff' : 'rgba(43,10,20,0.45)' }}
                  >
                    <span className="sr-only">{DAYS[di]} {hours[hi]}: </span>{v || ''}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ── CohortTable — retention. Sequential shading, counts kept visible. ──── */
export const CohortTable = ({ cohorts, months }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[420px] text-[11px]">
      <caption className="sr-only">Repeat booking rate by first-booking month</caption>
      <thead>
        <tr className="text-left">
          <th scope="col" className="pb-1 pr-2 font-bold text-ink/40">Cohort</th>
          <th scope="col" className="pb-1 pr-2 text-right font-bold text-ink/40">n</th>
          {months.map((m) => <th key={m} scope="col" className="pb-1 text-center font-bold text-ink/40">{m}</th>)}
        </tr>
      </thead>
      <tbody>
        {cohorts.map((c) => (
          <tr key={c.month}>
            <th scope="row" className="py-0.5 pr-2 text-left font-semibold text-ink/75">{c.month}</th>
            <td className="py-0.5 pr-2 text-right font-bold tabular-nums text-ink/60">{c.size}</td>
            {months.map((m, i) => {
              const v = c.values[i];
              return (
                <td key={m} className="py-0.5">
                  {v == null ? <span className="grid h-6 place-items-center text-ink/15">·</span> : (
                    <span
                      className="grid h-6 place-items-center rounded font-bold tabular-nums"
                      style={{ background: seriesAt(0.08 + v * 0.75), color: v > 0.5 ? '#fff' : 'rgba(43,10,20,0.7)' }}
                      title={`${Math.round(v * 100)}% of the ${c.month} cohort booked again`}
                    >
                      {Math.round(v * 100)}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ── DataTable — a dimension table with the bar inside the cell. ────────── */
export const DataTable = ({ columns, rows, initialSort, rowKey = 'label', barKey }) => {
  const [sort, setSort] = useState({ key: initialSort || columns[1]?.key, dir: 'desc' });
  const max = barKey ? Math.max(...rows.map((r) => r[barKey]), 1) : 0;
  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key];
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av ?? -Infinity) - (bv ?? -Infinity);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [rows, sort]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-[11.5px]">
        <thead>
          <tr className="border-b border-neutral-200">
            {columns.map((c) => (
              <th
                key={c.key} scope="col"
                aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={cn('pb-1.5 font-bold text-ink/40', c.align === 'right' ? 'text-right' : 'text-left')}
              >
                <button
                  type="button"
                  onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
                  className={cn('inline-flex items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose', sort.key === c.key && 'text-maroon')}
                >
                  {c.label}
                  {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp className="h-2.5 w-2.5" strokeWidth={3} /> : <ArrowDown className="h-2.5 w-2.5" strokeWidth={3} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r[rowKey]} className="border-b border-neutral-100 last:border-0">
              {columns.map((c, ci) => (
                <td key={c.key} className={cn('py-1.5', c.align === 'right' ? 'text-right tabular-nums' : 'text-left', c.strong ? 'font-bold text-ink' : 'font-medium text-ink/65')}>
                  {ci === 0 && barKey ? (
                    <span className="block">
                      <span className="block truncate">{c.render ? c.render(r) : r[c.key]}</span>
                      <span className="mt-1 block h-1 rounded-full" style={{ width: `${(r[barKey] / max) * 100}%`, background: seriesAt(0.55), minWidth: 2 }} />
                    </span>
                  ) : (c.render ? c.render(r) : r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ── Locked — the Pro gate. Real headline number, never a fabricated one. ─ */
export const Locked = ({ headline, src, children, onUpgrade, compact = false }) => (
  <div className="relative overflow-hidden rounded-xl">
    <div className={cn('pointer-events-none select-none blur-[5px] saturate-[0.5]', compact && 'max-h-44')} aria-hidden="true">{children}</div>
    <div className="absolute inset-0 grid place-items-center bg-cream/75 p-3">
      <div className="text-center">
        <span className="mx-auto mb-1.5 grid h-8 w-8 place-items-center rounded-full bg-maroon text-white">
          <Lock className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <p className="mx-auto max-w-[17rem] font-display text-[14px] font-extrabold leading-tight tracking-[-0.025em] text-ink">{headline}</p>
        <button
          type="button"
          onClick={() => onUpgrade?.(src)}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-maroon px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
        >
          Unlock with Pro <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  </div>
);

/* ── RangeControls — one row above the cards, GA4-style. ────────────────── */
export const RANGES = [
  { value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' },
  { value: 'mtd', label: 'MTD' }, { value: 'ytd', label: 'YTD' }, { value: 'next7', label: 'Next 7d' },
];

export const RangeControls = ({ range, onRange, compare, onCompare, asOf, freshness }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <div className="flex overflow-hidden rounded-full border-2 border-neutral-200 bg-white">
      {RANGES.map((r) => (
        <button
          key={r.value} type="button" onClick={() => onRange(r.value)} aria-pressed={range === r.value}
          className={cn(
            'px-2.5 py-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
            range === r.value ? 'bg-maroon text-white' : 'text-ink/50 hover:bg-blush',
          )}
        >{r.label}</button>
      ))}
    </div>
    <button
      type="button" onClick={() => onCompare(!compare)} aria-pressed={compare}
      className={cn(
        'rounded-full border-2 px-2.5 py-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
        compare ? 'border-maroon bg-maroon/5 text-maroon' : 'border-neutral-200 bg-white text-ink/50 hover:border-maroon/40',
      )}
    >Compare</button>
    <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] font-medium text-ink/40">
      <span className={cn('h-1.5 w-1.5 rounded-full', freshness === 'live' ? 'bg-success-fg' : 'bg-marigold-600')} />
      {asOf}
      <Explain>
        Money is read from your bookings and payouts, so it matches what you were paid. Visitor numbers come from our own
        tracking and update hourly.
      </Explain>
    </span>
  </div>
);

/* ── Insight — a recommendation. Number first, evidence on demand. ─────── */
export const Insight = ({ insight, onAct }) => {
  const [open, setOpen] = useState(false);
  if (!insight.evidence?.length) return null;
  return (
    <li className="rounded-xl border-2 border-neutral-200 bg-white p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="font-display text-[17px] font-extrabold leading-none tracking-[-0.03em] text-maroon">{insight.headline}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink/70">{insight.what}</span>
        <button
          type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="shrink-0 rounded-full px-1.5 text-[11px] font-bold text-ink/40 hover:text-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
        >Why</button>
        <button
          type="button" onClick={() => onAct?.(insight)}
          className="shrink-0 rounded-full bg-maroon px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
        >{insight.action}</button>
      </div>
      {open && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-cream p-2.5 sm:grid-cols-4">
          {insight.evidence.map((e) => (
            <div key={e.label}>
              <dt className="truncate text-[10px] font-semibold text-ink/45">{e.label}</dt>
              <dd className="font-display text-[13px] font-extrabold tracking-[-0.02em] text-ink">{e.value}</dd>
            </div>
          ))}
          <div className="col-span-2 border-t border-maroon/10 pt-1.5 text-[11px] font-medium text-ink/55 sm:col-span-4">
            {insight.impact}
            {insight.estimate && <span className="ml-1 rounded-full bg-marigold-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-marigold-800">estimate</span>}
            <span className="ml-2 text-ink/40">Measured by: {insight.measure}</span>
          </div>
        </dl>
      )}
    </li>
  );
};

/* ── Empty — specific, never generic. ──────────────────────────────────── */
export const Empty = ({ title, body }) => (
  <div className="grid place-items-center rounded-xl border-2 border-dashed border-neutral-200 bg-white px-4 py-7 text-center">
    <p className="font-display text-[14px] font-extrabold tracking-[-0.02em] text-ink">{title}</p>
    <p className="mt-1 max-w-xs text-[11.5px] font-medium leading-snug text-ink/50">{body}</p>
  </div>
);
