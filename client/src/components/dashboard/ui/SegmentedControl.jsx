import { cn } from './cn';

/**
 * App-style segmented control for filters / tab switches.
 * Replaces the small bordered filter pills with a thumb-friendly (min 44–48px),
 * horizontally-scrollable segmented row.
 *
 * options: [{ value, label, count? }]
 */
export function SegmentedControl({ options = [], value, onChange, className = '' }) {
  return (
    <div
      role="tablist"
      className={cn(
        'dash-noscrollbar flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100/70 p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(opt.value)}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-white text-gray-900 shadow-sm dash-elev-1'
                : 'text-gray-500 hover:text-gray-800 active:bg-white/50',
            )}
          >
            {opt.label}
            {opt.count != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none',
                  active ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
