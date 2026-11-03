import { cn } from './cn';

// Loop & Slot tones (no blue/green/amber/red hexes — brand ramp only). info has
// no brand blue, so it collapses onto maroon; success uses the c-emerald token.
const TONES = {
  neutral: 'bg-ink/5 text-ink/60',
  success: 'bg-c-emerald/10 text-c-emerald',
  warning: 'bg-marigold-100 text-marigold-800',
  danger: 'bg-rose/10 text-rose-700',
  info: 'bg-maroon-100 text-maroon-700',
  primary: 'bg-primary/10 text-primary',
};

export function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

// One status -> tone map for the entire dashboard (booking/payment/payout/feedback/plan).
const STATUS_TONE = {
  pending: 'warning', awaiting: 'warning', processing: 'warning', planned: 'warning', requested: 'warning',
  confirmed: 'success', active: 'success', paid: 'success', approved: 'success', completed: 'success',
  shipped: 'success', resolved: 'success', published: 'success', live: 'success',
  cancelled: 'danger', canceled: 'danger', failed: 'danger', rejected: 'danger', declined: 'danger', refunded: 'danger',
  unpaid: 'neutral', draft: 'neutral', new: 'neutral', closed: 'neutral', inactive: 'neutral', hidden: 'neutral',
  reviewing: 'info', in_review: 'info', open: 'info', upcoming: 'info',
};

const labelize = (s) =>
  String(s || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function StatusBadge({ status, label, dot = true, className = '' }) {
  const key = String(status || '').toLowerCase().trim();
  return (
    <Badge tone={STATUS_TONE[key] || 'neutral'} dot={dot} className={className}>
      {label || labelize(status)}
    </Badge>
  );
}

export default Badge;
