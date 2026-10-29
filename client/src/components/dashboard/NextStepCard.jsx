import { Link } from 'react-router-dom';
import { Wallet, CreditCard, IndianRupee, XCircle } from 'lucide-react';

// The single ranked "Next step" nudge on the host dashboard. Content is a data-only
// descriptor from lib/hostNudges.buildNudges. The share nudge renders its own rich
// hero in Dashboard, so this handles the KYC / legacy / upgrade descriptors.
const ICONS = { Wallet, CreditCard, IndianRupee };
const TONE = {
  emerald: { box: 'border-emerald-200 bg-emerald-50', icon: 'text-emerald-600', cta: 'bg-emerald-600 hover:bg-emerald-700', x: 'text-emerald-500 hover:text-emerald-700' },
  amber:   { box: 'border-amber-200 bg-amber-50',     icon: 'text-amber-600',   cta: 'bg-amber-600 hover:bg-amber-700',     x: 'text-amber-500 hover:text-amber-700' },
  primary: { box: 'border-primary/20 bg-primary/5',   icon: 'text-primary',     cta: 'bg-primary hover:opacity-90',         x: 'text-primary/60 hover:text-primary' },
};

export default function NextStepCard({ nudge, onDismiss }) {
  const Icon = ICONS[nudge.icon] || IndianRupee;
  const t = TONE[nudge.tone] || TONE.primary;
  return (
    <div className={`mb-5 flex items-start gap-3 rounded-md border p-4 ${t.box}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.icon}`} strokeWidth={2.25} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{nudge.title}</p>
        <p className="mt-0.5 text-xs text-gray-600">{nudge.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link to={nudge.to} className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-bold text-white transition-colors ${t.cta}`}>
          {nudge.cta}
        </Link>
        {nudge.dismissible && onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss" className={`p-1 ${t.x}`}>
            <XCircle className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
  );
}
