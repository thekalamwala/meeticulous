import { Link } from 'react-router-dom';
import { cancellationSegments } from '../../lib/cancellationPolicy';

/**
 * CancellationPolicyNote — discloses the cancellation/refund policy on the booking
 * page BEFORE payment (closes the disclosure gap Refund.jsx flags). Shows the tiers
 * that will apply to this booking; defaults to the standard policy, and once
 * per-host policies go live (P3) it renders the service's resolved `tiers`.
 */
export default function CancellationPolicyNote({ tiers, className = '' }) {
  const segments = cancellationSegments(tiers);
  return (
    <div className={`rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 ${className}`}>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Cancellation policy
      </div>
      <ul className="space-y-1">
        {segments.map((s) => (
          <li key={s.when} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-gray-600">Cancel {s.when}</span>
            <span className="shrink-0 font-semibold text-gray-900">{s.pct}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10.5px] leading-snug text-gray-400">
        Refunds are on the service price; the booking fee is non-refundable.{' '}
        <Link to="/refund" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">Full policy</Link>
      </p>
    </div>
  );
}
