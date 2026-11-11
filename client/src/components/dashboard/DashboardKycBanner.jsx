import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

/**
 * DashboardKycBanner — proactive KYC nudge on the host dashboard home.
 *
 * Today a PAID booking is blocked until the host has PAN on file (KYC). A host can
 * publish paid services and never be told, so the first guest who tries to pay is
 * dropped. This banner prompts the one-time verification BEFORE that happens.
 *
 * Shown only when the host sells a paid service and hasn't started/finished KYC.
 * Hidden once KYC is submitted/approved, and for hosts with no paid service.
 *
 * Props:
 *   kyc            — GET /kyc/me payload ({ status, pending_earnings, payouts_ready }) or null
 *   hasPaidService — true if the host has at least one paid (non-free) service
 */
export default function DashboardKycBanner({ kyc, hasPaidService }) {
  if (!kyc) return null;
  const status = kyc.status;
  // Already done or in progress → no nudge (autopilot approves a submission quickly).
  if (status === 'approved' || status === 'pending' || status === 'submitted') return null;
  // Only nudge hosts who actually sell something paid — free-only hosts need no KYC.
  if (!hasPaidService) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2.25} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">Complete verification to accept payments</p>
        <p className="mt-0.5 text-xs text-gray-600">
          Your paid services can&apos;t be booked until you finish a quick one-time verification
          (PAN&nbsp;+&nbsp;bank). It takes a couple of minutes and you only do it once.
        </p>
      </div>
      <Link
        to="/dashboard/kyc"
        className="shrink-0 whitespace-nowrap rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-700"
      >
        Verify now
      </Link>
    </div>
  );
}
