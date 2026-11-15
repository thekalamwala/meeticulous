import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, X } from 'lucide-react';
import { PREMIUM_PLAN } from '../../data/plans';

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const DISMISS_KEY = 'cm_dismissed';

const readDismissed = () => {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

/**
 * CommissionMeter — the sharpest free→Pro conversion nudge on the host dashboard.
 *
 * Free hosts pay 5% commission on every booking; Pro charges 0%. Showing the actual
 * rupees already handed over turns the upgrade into a calculation, not a generic
 * pitch — the single highest-leverage lever (Pro GMV earns the platform ₹0, so the
 * business runs on free→Pro upgrades). Once a host has paid MORE than Pro's yearly
 * price, the copy goes blunt: they've already spent more than the fix would cost.
 *
 * Shown only to free-plan hosts who have paid real commission (> ₹0). Dismissible
 * for the session (a soft nudge, not a hard cap).
 *
 * Props:
 *   commissionPaid — total platform commission paid (₹), from GET /host/nudges
 *   isFree         — true if the host is on the free (Starter) plan
 *   src            — attribution tag → /dashboard/upgrade?src=<src> (default "commission")
 */
export default function CommissionMeter({ commissionPaid, isFree, src = 'commission' }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  if (!isFree) return null;
  const paid = Number(commissionPaid) || 0;
  if (paid <= 0 || dismissed) return null;

  // Blunt only once they've paid STRICTLY more than Pro's yearly price.
  const pastPrice = paid > PREMIUM_PLAN.yearly;
  const headline = pastPrice
    ? `You've paid ${rupees(paid)} in commission — more than Pro costs (${rupees(PREMIUM_PLAN.yearly)}/yr)`
    : `You've paid ${rupees(paid)} in commission`;
  const sub = pastPrice
    ? 'Go Pro and keep every rupee — 0% commission.'
    : 'Pro charges 0% commission — keep every rupee you earn.';

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="mb-5 flex items-start gap-3 rounded-md border-2 border-maroon/15 bg-blush p-4">
      <IndianRupee className="mt-0.5 h-5 w-5 shrink-0 text-maroon" strokeWidth={2.25} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{headline}</p>
        <p className="mt-0.5 text-xs text-ink/60">{sub}</p>
      </div>
      <Link
        to={`/dashboard/upgrade?src=${src}`}
        className="shrink-0 whitespace-nowrap rounded-full bg-maroon px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-maroon-dark"
      >
        Go Pro
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-ink/30 transition-colors hover:bg-maroon/10 hover:text-ink/60"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
