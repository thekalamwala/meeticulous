import { cn } from './cn';
import { Card } from './Card';

const TONE_BG = {
  neutral: 'bg-gray-100 text-gray-600',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-700',
};

/** KPI tile. Unifies Dashboard stat tiles, Payouts balances, Earnings KPI row. */
export function StatCard({
  label, value, hint, delta, icon: Icon, tone = 'neutral', active = false, onClick, className = '',
}) {
  const clickable = typeof onClick === 'function';
  const deltaNum = typeof delta === 'number' ? delta : null;
  return (
    <Card
      as={clickable ? 'button' : 'div'}
      onClick={onClick}
      padded={false}
      className={cn(
        'w-full p-4 text-left',
        clickable && 'dash-elev-hover',
        active && 'ring-2 ring-primary/40 border-primary/40',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        {Icon && (
          <span className={cn('rounded-md p-1.5', TONE_BG[tone] || TONE_BG.neutral)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {deltaNum !== null && (
          <span className={cn('text-xs font-semibold', deltaNum >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {deltaNum >= 0 ? '▲' : '▼'} {Math.abs(deltaNum)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </Card>
  );
}

export default StatCard;
