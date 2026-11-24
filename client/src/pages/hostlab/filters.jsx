// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR — one row, after the Semrush pattern.
//
// The bookings bar cost four rows: saved-view chips, a control row, a row of
// status chips, and an "applied filters" row underneath. The first thing a host
// saw was the filtering, not their bookings.
//
// The move that collapses it: an applied filter shows its VALUE INSIDE its own
// button and grows an ✕. There is then nothing for a separate chip row to say,
// and one glance along one row tells you everything narrowing the list.
//
//   rest      Status ⌄             neutral outline
//   applied   Status: Unpaid ✕     maroon outline, blush ground
//
// Rarely-touched controls go behind `more`, which is Semrush's "Advanced
// filters": present, not in the way.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '../../components/dashboard/ui';

const usePopover = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return [open, setOpen, ref];
};

const CTRL = 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border-2 px-2.5 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose';
const REST = 'border-neutral-200 bg-white text-ink/65 hover:border-maroon/40 hover:text-ink';
const ON = 'border-maroon bg-blush text-maroon';

/** The button face: one value by name, several by count, none at all when clear. */
const faceOf = (value, options, multi, empty) => {
  if (multi) {
    if (!value?.length) return null;
    if (value.length === 1) return options.find((x) => x.value === value[0])?.label ?? null;
    return `${value.length} selected`;
  }
  if (value == null || value === empty) return null;
  return options.find((x) => x.value === value)?.label ?? null;
};

/** One filter control. Shows its value when set; the ✕ clears it in place. */
export const Filter = ({
  label, value, options, onChange,
  multi = false, align = 'left', width = 'w-56', empty = 'all', icon: Icon,
}) => {
  const [open, setOpen, ref] = usePopover();
  const face = faceOf(value, options, multi, empty);
  const active = face != null;

  const pick = (v) => {
    if (!multi) { onChange(v); setOpen(false); return; }
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(CTRL, active ? ON : REST)}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2.4} />}
        <span className={active ? 'text-maroon/55' : 'text-ink/40'}>{label}</span>
        {active && <span className="max-w-[110px] truncate">{face}</span>}
        {active ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Clear ${label}`}
            onClick={(e) => { e.stopPropagation(); onChange(multi ? [] : empty); }}
            className="-mr-0.5 grid h-4 w-4 place-items-center rounded-xs text-maroon/55 transition hover:bg-maroon/15 hover:text-maroon"
          >
            <X className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-55" strokeWidth={2.6} />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable={multi || undefined}
          className={cn(
            'absolute z-50 mt-1 max-h-[300px] overflow-y-auto overflow-x-hidden rounded-sm border-2 border-neutral-200 bg-white py-1 dash-elev-3',
            width,
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.map((o) => {
            const on = multi ? value.includes(o.value) : value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => pick(o.value)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] font-medium text-ink/75 transition hover:bg-blush"
              >
                {multi && (
                  <span className={cn('grid h-3.5 w-3.5 shrink-0 place-items-center rounded-xs border-2', on ? 'border-maroon bg-maroon text-white' : 'border-neutral-300')}>
                    {on && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.count != null && <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-ink/35">{o.count}</span>}
                {!multi && on && <Check className="h-3.5 w-3.5 shrink-0 text-maroon" strokeWidth={3} />}
              </button>
            );
          })}
          {multi && value.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false); }}
              className="mt-1 w-full border-t-2 border-neutral-200 px-2.5 py-1.5 text-left text-[11px] font-bold text-maroon transition hover:bg-blush"
            >
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** The row: search, the filters, an optional overflow menu, then the right side. */
export const FilterBar = ({ search, children, more, onClearAll, activeCount = 0, trailing, className = '', bare = false }) => {
  const [moreOpen, setMoreOpen, moreRef] = usePopover();
  return (
    // `bare` drops the outer box (border + fill + padding) so the controls float
    // on the page — the borderless catalog look. Default keeps the boxed bar.
    <div className={cn('flex flex-wrap items-center gap-1.5', bare ? '' : 'rounded-lg border-2 border-neutral-200 bg-white p-1.5', className)}>
      {search && (
        <div className="relative min-w-[150px] flex-1 sm:max-w-[250px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" strokeWidth={2.4} />
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            className="h-8 w-full rounded-sm border-2 border-neutral-200 bg-white pl-8 pr-7 text-[11.5px] font-medium text-ink outline-none transition placeholder:text-ink/35 focus:border-maroon/40 focus-visible:ring-2 focus-visible:ring-rose"
          />
          {search.value && (
            <button
              type="button"
              onClick={() => search.onChange('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-xs text-ink/35 transition hover:bg-neutral-100 hover:text-ink"
            >
              <X className="h-3 w-3" strokeWidth={3} />
            </button>
          )}
        </div>
      )}

      {children}

      {more && (
        <div ref={moreRef} className="relative shrink-0">
          <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={cn(CTRL, REST)}>
            <SlidersHorizontal className="h-3.5 w-3.5 opacity-70" strokeWidth={2.4} />
            More
            <ChevronDown className="h-3.5 w-3.5 opacity-55" strokeWidth={2.6} />
          </button>
          {moreOpen && (
            <div className="absolute left-0 z-50 mt-1 w-64 rounded-sm border-2 border-neutral-200 bg-white p-2.5 dash-elev-3">
              {more}
            </div>
          )}
        </div>
      )}

      {activeCount > 1 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="shrink-0 px-1 text-[11px] font-bold text-maroon underline decoration-maroon/30 underline-offset-2 transition hover:decoration-maroon"
        >
          Clear all
        </button>
      )}

      {trailing && <div className="ml-auto flex shrink-0 items-center gap-1.5">{trailing}</div>}
    </div>
  );
};

/* ── CheckBox ─────────────────────────────────────────────────────────────
 * A native checkbox with `accent-color` paints a solid 16px block in the
 * accent — against a light table row that reads as a black box, and it is the
 * heaviest thing on screen in a view where selection is incidental. This is
 * the same 14px box the filter panels use: a 2px outline at rest, filled only
 * once it is on. The real <input> stays, moved off-screen, so the label, the
 * keyboard and screen readers behave exactly as before.
 * ---------------------------------------------------------------------- */
export const CheckBox = ({ checked, onChange, label, className = '' }) => (
  <label className={cn('relative inline-flex cursor-pointer items-center', className)}>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="peer absolute h-0 w-0 opacity-0"
    />
    <span
      aria-hidden="true"
      className={cn(
        'grid h-3.5 w-3.5 place-items-center rounded-xs border-2 transition',
        'peer-focus-visible:ring-2 peer-focus-visible:ring-rose peer-focus-visible:ring-offset-1',
        checked ? 'border-maroon bg-maroon text-white' : 'border-neutral-300 bg-white hover:border-maroon/50',
      )}
    >
      {checked && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
    </span>
  </label>
);

/** Segmented view switcher. An option with `to` navigates, because a view of
 *  a list is a place you can link someone to — the switch is the control, the
 *  URL is the truth. Without `to` it falls back to local state. */
export const ViewSwitch = ({ value, onChange, options }) => (
  <div className="flex shrink-0 items-center rounded-sm border-2 border-neutral-200 bg-cream p-0.5">
    {options.map((o) => {
      const on = value === o.value;
      const cls = cn(
        'grid h-6 w-7 place-items-center rounded-xs transition',
        on ? 'bg-maroon text-white' : 'text-ink/45 hover:text-ink',
      );
      return o.to ? (
        <Link key={o.value} to={o.to} aria-current={on ? 'page' : undefined} aria-label={o.label} title={o.label} className={cls}>
          <o.icon className="h-3.5 w-3.5" strokeWidth={2.4} />
        </Link>
      ) : (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={on} aria-label={o.label} title={o.label} className={cls}>
          <o.icon className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      );
    })}
  </div>
);

export default FilterBar;
