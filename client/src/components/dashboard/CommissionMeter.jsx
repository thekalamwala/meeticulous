import { Link } from 'react-router-dom';
import { IndianRupee } from 'lucide-react';

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/**
 * CommissionMeter — free→Pro conversion nudge on the host dashboard home.
 *
 * Free hosts pay 5% commission on every booking; Pro charges 0%. Showing the actual
 * rupees they've already handed over turns the upgrade into a calculation, not a
 * generic pitch — it's the single highest-leverage conversion lever (Pro GMV earns
 * the platform ₹0 commission, so the business runs on free→Pro upgrades).
 *
 * Shown only to free-plan hosts who have paid real commission (> ₹0).
 *
 * Props:
 *   commissionPaid — total platform commission paid (₹), from GET /host/nudges
 *   isFree         — true if the host is on the free (Starter) plan
 */
export default function CommissionMeter({ commissionPaid, isFree }) {
  if (!isFree) return null;
  const paid = Number(commissionPaid) || 0;
  if (paid <= 0) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
      <IndianRupee className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2.25} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">You&apos;ve paid {rupees(paid)} in platform commission</p>
        <p className="mt-0.5 text-xs text-gray-600">
          Pro charges 0% commission — upgrade and keep every rupee you earn.
        </p>
      </div>
      <Link
        to="/dashboard/upgrade"
        className="shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white transition-colors hover:opacity-90"
      >
        See plans
      </Link>
    </div>
  );
}
