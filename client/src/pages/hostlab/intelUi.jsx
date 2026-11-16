// ─────────────────────────────────────────────────────────────────────────────
// Intelligence — the chart shapes labUi doesn't have yet.
//
// Lives in its own module, not inside labUi.jsx, for two reasons: labUi is being
// edited concurrently on the Host Lab branch, and these four shapes are only
// needed by the Intelligence section. If Intelligence ships, they move into
// labUi; until then this file keeps the diff additive.
//
// There is NO charting library in client/package.json and this design doesn't add
// one (see the design doc §13) — every shape here is hand-rolled SVG or CSS grid.
//
// One measure, one shape, each with a stated purpose:
//   LineChart   — a trend over time (revenue, bookings, views)
//   Waterfall   — gross → deductions → net. The only honest shape for subtraction
//   Heatmap     — demand across weekday × hour, the only readable 2-D form
//   CohortTable — retention, where the counts matter more than a curve would
// Plus the furniture every page needs: Locked, RangeControls, AsOf, InsightCard,
// SortableTable, Delta.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Info, Lock, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../components/dashboard/ui';
import { inr, pct } from './labUi';

// Mirrors labUi's Sparkline, which hard-codes the same value: an SVG `stroke`
// cannot take a Tailwind class, so the maroon token is inlined here once and
// every alpha below is derived from it rather than invented.
const MAROON = '#960D32';
const alpha = (a) => `rgba(150, 13, 50, ${a})`;

/** A rate, with a decimal where one matters. labUi's pct() rounds to whole
 *  numbers, which is right for "71% drop" and wrong for conversion: 4.3% and
 *  3.6% both render as "4%", and those two are a business apart. */
export const rate = (n) => {
  const v = (Number(n) || 0) * 100;
  return `${v > 0 && v < 10 ? v.toFixed(1) : Math.round(v)}%`;
};

/* ── Delta — one period against another, never a bare number ───────────── */
export const Delta = ({ value, label = 'vs last period', inverse = false }) => {
  if (value == null) return <span className="text-[10.5px] font-medium text-ink/40">no prior period</span>;
  const good = inverse ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold">
      <span className={cn('inline-flex items-center gap-0.5', good ? 'text-success-fg' : 'text-error-fg')}>
        <Icon className="h-3 w-3" strokeWidth={2.6} />
        {value >= 0 ? '+' : ''}{value}%
      </span>
      <span className="font-medium text-ink/45">{label}</span>
    </span>
  );
};

/* ── AsOf — freshness, printed. Beacons' silent 30-minute staleness is the
 *   reason this is not optional furniture. ──────────────────────────────── */
export const AsOf = ({ at, freshness = 'live' }) => (
  <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-ink/45">
    <span className={cn('h-1.5 w-1.5 rounded-full', freshness === 'live' ? 'bg-success-fg' : 'bg-marigold')} />
    {freshness === 'live' ? 'Live' : 'Updated hourly'} · as of {at}
  </span>
);

/* ── Tooltip trigger — carries the metric definition from the dictionary ── */
export const Explain = ({ children }) => (
  <span className="group relative inline-flex">
    <Info className="h-3 w-3 cursor-help text-ink/30" strokeWidth={2.4} tabIndex={0} aria-label="What this means" />
    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-56 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white group-hover:block group-focus-within:block">
      {children}
    </span>
  </span>
);

/* ── Locked — the Pro gate. Mirrors ProTeaser.jsx: the real shape behind
 *   glass, aria-hidden, with an attributed CTA. The headline number shown is
 *   REAL (commission paid) — never a fabricated sample. ─────────────────── */
export const Locked = ({ headline, sub, src, children, onUpgrade }) => (
  <div className="relative overflow-hidden rounded-xl">
    <div className="pointer-events-none select-none blur-[5px] saturate-[0.6]" aria-hidden="true">{children}</div>
    <div className="absolute inset-0 grid place-items-center bg-cream/70 p-4 backdrop-blur-[2px]">
      <div className="max-w-[22rem] text-center">
        <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-maroon text-white">
          <Lock className="h-[17px] w-[17px]" strokeWidth={2.4} />
        </span>
        <p className="font-display text-[17px] font-extrabold leading-tight tracking-[-0.03em] text-ink">{headline}</p>
        {sub && <p className="mt-1 text-[12px] font-medium leading-snug text-ink/55">{sub}</p>}
        <button
          type="button"
          onClick={() => onUpgrade?.(src)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-maroon px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
        >
          Unlock with Pro <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
        <p className="mt-1.5 text-[10.5px] font-medium text-ink/40">₹1,179/year · and commission drops to 0%</p>
      </div>
    </div>
  </div>
);

/* ── RangeControls — date range + comparison, the furniture on every page ─ */
export const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'next7', label: 'Next 7 days' },
];

export const RangeControls = ({ range, onRange, compare, onCompare }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <div className="flex overflow-hidden rounded-full border-2 border-neutral-200 bg-white">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onRange(r.value)}
          aria-pressed={range === r.value}
          className={cn(
            'px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
            range === r.value ? 'bg-maroon text-white' : 'text-ink/55 hover:bg-blush',
          )}
        >
          {r.value === 'next7' ? 'Next 7d' : r.label.replace('Last ', '').replace('Month to date', 'MTD').replace('Year to date', 'YTD')}
        </button>
      ))}
    </div>
    <button
      type="button"
      onClick={() => onCompare(!compare)}
      aria-pressed={compare}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
        compare ? 'border-maroon bg-maroon/5 text-maroon' : 'border-neutral-200 bg-white text-ink/55 hover:border-maroon/40',
      )}
    >
      Compare to previous
    </button>
  </div>
);

/* ── LineChart — a trend. Hover any point for its exact value. ──────────── */
export const LineChart = ({
  series, labelKey = 'label', height = 170,
  format = (v) => inr(v, { compact: true }),
}) => {
  const [hover, setHover] = useState(null);
  const W = 560;
  const H = height;
  const pad = { l: 4, r: 4, t: 10, b: 18 };
  const keys = series.map((s) => s.key);
  const rows = series[0]?.data || [];
  const max = Math.max(...series.flatMap((s) => s.data.map((d) => d.value)), 1);

  const x = (i) => pad.l + (i / Math.max(rows.length - 1, 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

  if (!rows.length) return <p className="py-8 text-center text-[12px] font-medium text-ink/45">No data in this range yet.</p>;

  return (
    <div className="relative">
      <div className="flex gap-2.5">
        <div className="flex shrink-0 flex-col justify-between py-0.5 text-right text-[9.5px] font-semibold tabular-nums text-ink/35" style={{ height: H - pad.b }}>
          <span>{format(max)}</span><span>{format(max / 2)}</span><span>{format(0)}</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} role="img" aria-label="Trend over the selected range">
            {[0, 0.5, 1].map((t) => (
              <line key={t} x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="currentColor" className="text-neutral-200" strokeWidth="1" />
            ))}
            {series.map((s, si) => (
              <polyline
                key={s.key}
                points={s.data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')}
                fill="none"
                stroke={si === 0 ? MAROON : alpha(0.3)}
                strokeWidth={si === 0 ? 2.25 : 2}
                strokeDasharray={s.dashed ? '4 3' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke={alpha(0.25)} strokeWidth="1" />}
            {series.map((s, si) => hover != null && (
              <circle key={s.key} cx={x(hover)} cy={y(s.data[hover].value)} r="3.25" fill={si === 0 ? MAROON : alpha(0.45)} stroke="#fff" strokeWidth="1.5" />
            ))}
            {rows.map((d, i) => (
              <rect
                key={d[labelKey]}
                x={x(i) - (W / rows.length) / 2} y={0} width={W / rows.length} height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`${d[labelKey]}: ${series.map((s) => `${s.key} ${format(s.data[i].value)}`).join(', ')}`}
                className="cursor-crosshair focus:outline-none"
              />
            ))}
          </svg>
          <div className="flex justify-between pt-0.5 text-[9.5px] font-semibold text-ink/35">
            <span>{rows[0]?.[labelKey]}</span>
            <span>{rows[rows.length - 1]?.[labelKey]}</span>
          </div>
          {hover != null && (
            <div className="pointer-events-none absolute -top-1 left-1/2 w-max -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white">
              <span className="text-white/60">{rows[hover][labelKey]} · </span>
              {series.map((s) => (
                <span key={s.key} className="ml-1.5">{s.key} <span className="tabular-nums">{format(s.data[hover].value)}</span></span>
              ))}
            </div>
          )}
        </div>
      </div>
      {keys.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-3 pl-10 text-[10.5px] font-semibold text-ink/55">
          {series.map((s, si) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: si === 0 ? MAROON : alpha(0.3) }} />
              {s.key}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Waterfall — gross → every deduction → net. Stripe's "net volume"
 *   honesty, as a shape. A pie could not show subtraction. ──────────────── */
export const Waterfall = ({ rows }) => {
  const gross = rows[0]?.value || 1;
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const isTotal = r.kind === 'total';
        const w = Math.max((Math.abs(r.value) / gross) * 100, 1.5);
        return (
          <li key={r.label} className={cn(isTotal && 'mt-1 border-t-2 border-neutral-200 pt-2.5')}>
            <div className="mb-1 flex items-baseline justify-between gap-2.5">
              <span className={cn('truncate text-[12px]', isTotal ? 'font-bold text-ink' : 'font-semibold text-ink/75')}>
                {r.kind === 'deduction' && <ArrowDown className="mr-1 inline h-3 w-3 text-error-fg" strokeWidth={2.6} />}
                {r.label}
              </span>
              <span className={cn('shrink-0 tabular-nums', isTotal ? 'text-[14px] font-extrabold text-ink' : 'text-[11.5px] font-bold text-ink/80')}>
                {r.kind === 'deduction' ? '−' : ''}{inr(Math.abs(r.value))}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className={cn('h-full rounded-full', isTotal ? 'bg-maroon' : r.kind === 'deduction' ? 'bg-rose' : 'bg-maroon/55')}
                style={{ width: `${w}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

/* ── Heatmap — weekday × hour demand. Scrolls on a phone, day labels stick ─ */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const Heatmap = ({ grid, hours, onPick }) => {
  const max = Math.max(...grid.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-[2px]">
        <caption className="sr-only">Bookings by weekday and hour, all times IST</caption>
        <thead>
          <tr>
            <th scope="col" className="w-9" />
            {hours.map((h) => (
              <th key={h} scope="col" className="pb-0.5 text-[9.5px] font-bold text-ink/35">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, di) => (
            <tr key={DAYS[di]}>
              <th scope="row" className="sticky left-0 bg-white pr-1 text-right text-[10px] font-bold text-ink/45">{DAYS[di]}</th>
              {row.map((v, hi) => (
                <td key={hours[hi]}>
                  <button
                    type="button"
                    onClick={() => onPick?.(DAYS[di], hours[hi], v)}
                    title={`${DAYS[di]} ${hours[hi]} · ${v} booking${v === 1 ? '' : 's'}`}
                    className="grid aspect-square w-full place-items-center rounded-md text-[9.5px] font-bold transition hover:ring-2 hover:ring-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
                    style={{ background: v ? alpha(0.12 + (v / max) * 0.78) : 'rgb(245 245 245)', color: v / max > 0.55 ? '#fff' : 'rgba(26,26,26,0.5)' }}
                  >
                    <span className="sr-only">{DAYS[di]} {hours[hi]}: </span>{v || ''}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10.5px] font-medium text-ink/45">All times IST. Darker means more bookings taken in that slot.</p>
    </div>
  );
};

/* ── CohortTable — retention. A table, because the counts matter. ───────── */
export const CohortTable = ({ cohorts, months }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[460px] text-[11.5px]">
      <caption className="sr-only">Repeat booking rate by first-booking month</caption>
      <thead>
        <tr className="text-left">
          <th scope="col" className="pb-1.5 pr-2 font-bold text-ink/45">First booked</th>
          <th scope="col" className="pb-1.5 pr-2 text-right font-bold text-ink/45">Guests</th>
          {months.map((m) => (
            <th key={m} scope="col" className="pb-1.5 text-center font-bold text-ink/45">{m}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cohorts.map((c) => (
          <tr key={c.month}>
            <th scope="row" className="py-0.5 pr-2 text-left font-semibold text-ink/80">{c.month}</th>
            <td className="py-0.5 pr-2 text-right font-bold tabular-nums text-ink">{c.size}</td>
            {months.map((m, i) => {
              const v = c.values[i];
              return (
                <td key={m} className="py-0.5">
                  {v == null ? (
                    <span className="grid h-7 place-items-center text-ink/20">·</span>
                  ) : (
                    <span
                      className="grid h-7 place-items-center rounded-md font-bold tabular-nums"
                      style={{ background: alpha(0.08 + v * 0.72), color: v > 0.55 ? '#fff' : 'rgba(26,26,26,0.72)' }}
                      title={`${Math.round(v * 100)}% of the ${c.month} cohort booked again`}
                    >
                      {pct(v)}
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

/* ── InsightCard — a recommendation with its evidence. Six fields, and it
 *   renders nothing without evidence (design doc §10). ──────────────────── */
export const InsightCard = ({ insight, onAct }) => {
  const [open, setOpen] = useState(false);
  if (!insight.evidence?.length) return null;
  return (
    <li className="rounded-xl border-2 border-neutral-200 bg-white p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-marigold/25 text-[13px]">{insight.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[14px] font-extrabold leading-snug tracking-[-0.02em] text-ink">{insight.what}</p>
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-ink/60">{insight.why}</p>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-1.5 text-[11px] font-bold text-maroon underline decoration-maroon/30 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
          >
            {open ? 'Hide the numbers' : 'Show the numbers'}
          </button>

          {open && (
            <div className="mt-2 rounded-lg bg-cream p-2.5">
              <ul className="flex flex-col gap-1">
                {insight.evidence.map((e) => (
                  <li key={e.label} className="flex items-baseline justify-between gap-2 text-[11.5px]">
                    <span className="font-medium text-ink/60">{e.label}</span>
                    <span className="shrink-0 font-bold tabular-nums text-ink">{e.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-maroon/10 pt-1.5 text-[11px] font-medium text-ink/55">
                <span className="font-bold text-ink/70">If it works: </span>{insight.impact}
                {insight.estimate && <span className="ml-1 rounded-full bg-marigold/30 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-ink/70">estimate</span>}
              </p>
              <p className="mt-1 text-[11px] font-medium text-ink/55">
                <span className="font-bold text-ink/70">Measure it: </span>{insight.measure}
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onAct?.(insight)}
          className="shrink-0 rounded-full bg-maroon px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
        >
          {insight.action}
        </button>
      </div>
    </li>
  );
};

/* ── SortableTable — the Gumroad referrer table, generalised. Every column
 *   sorts; the sorted one says so. ─────────────────────────────────────── */
export const SortableTable = ({ columns, rows, initialSort, rowKey = 'label', footer }) => {
  const [sort, setSort] = useState({ key: initialSort || columns[1]?.key, dir: 'desc' });
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    const vals = [...rows];
    vals.sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key];
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av ?? -Infinity) - (bv ?? -Infinity);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return col ? vals : rows;
  }, [rows, sort, columns]);

  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[12px]">
        <thead>
          <tr className="border-b-2 border-neutral-200">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={cn('pb-1.5 font-bold text-ink/45', c.align === 'right' ? 'text-right' : 'text-left')}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={cn('inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose', sort.key === c.key && 'text-maroon')}
                >
                  {c.label}
                  {sort.key === c.key && (sort.dir === 'asc'
                    ? <ArrowUp className="h-3 w-3" strokeWidth={2.8} />
                    : <ArrowDown className="h-3 w-3" strokeWidth={2.8} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r[rowKey]} className="border-b border-neutral-100 last:border-0">
              {columns.map((c) => (
                <td key={c.key} className={cn('py-1.5', c.align === 'right' ? 'text-right tabular-nums' : 'text-left', c.strong ? 'font-bold text-ink' : 'font-medium text-ink/70')}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
};

/* ── Empty — specific, never generic. ──────────────────────────────────── */
export const Empty = ({ title, body, action }) => (
  <div className="grid place-items-center rounded-xl border-2 border-dashed border-neutral-200 bg-white px-4 py-8 text-center">
    <p className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">{title}</p>
    <p className="mt-1 max-w-sm text-[12px] font-medium leading-snug text-ink/55">{body}</p>
    {action}
  </div>
);
