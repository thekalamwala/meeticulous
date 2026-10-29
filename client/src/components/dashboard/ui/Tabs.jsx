import { cn } from './cn';

/** tabs: [{ value, label, icon?, count? }] */
export function Tabs({ tabs = [], value, onChange, className = '' }) {
  return (
    <div className={cn('dash-noscrollbar flex gap-1 overflow-x-auto border-b border-gray-200', className)} role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(t.value)}
            className={cn(
              'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'text-primary' : 'text-gray-500 hover:text-gray-800',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
            {t.count != null && (
              <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{t.count}</span>
            )}
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
