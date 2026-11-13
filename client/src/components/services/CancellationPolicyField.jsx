import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

/**
 * CancellationPolicyField (P4) — a host picks a cancellation refund preset for a
 * paid service. `strict`/`flexible` are Pro-only; the server re-checks the plan and
 * maps the preset name → tiers (client never sends tiers). Descriptions are static
 * so this doesn't depend on the P2 client formatter.
 */
const PRESETS = [
  { key: 'standard', label: 'Standard', desc: 'Full refund 24h+ before · 50% 6–24h · none under 6h', pro: false },
  { key: 'strict', label: 'Strict', desc: 'Full refund 48h+ before · 50% 24–48h · none under 24h — keep more on late cancels', pro: true },
  { key: 'flexible', label: 'Flexible', desc: 'Full refund up to 2h before · none after', pro: true },
];

export default function CancellationPolicyField({ value = 'standard', onChange, isFree }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">Cancellation policy</label>
      <div className="space-y-2">
        {PRESETS.map((p) => {
          const locked = p.pro && isFree;
          const selected = value === p.key && !locked;
          return (
            <button
              key={p.key}
              type="button"
              disabled={locked}
              onClick={() => !locked && onChange(p.key)}
              aria-pressed={selected}
              className={[
                'flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                selected ? 'border-maroon bg-maroon/5 ring-1 ring-maroon/30'
                  : locked ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-70'
                  : 'border-gray-200 hover:border-maroon/40',
              ].join(' ')}
            >
              <span className={[
                'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                selected ? 'border-maroon bg-maroon' : 'border-gray-300',
              ].join(' ')}>
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {p.label}
                  {p.pro && <span className="rounded-full bg-marigold-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-marigold-800">Pro</span>}
                  {locked && <Lock className="h-3 w-3 text-gray-400" strokeWidth={2.2} />}
                </span>
                <span className="mt-0.5 block text-xs text-ink/55">{p.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      {isFree && (
        <p className="mt-2 text-xs text-ink/55">
          Stricter policies protect your income from late cancellations.{' '}
          <Link to="/dashboard/upgrade?src=cancellation_policy" className="font-semibold text-maroon underline">Upgrade to Pro</Link>
        </p>
      )}
    </div>
  );
}
