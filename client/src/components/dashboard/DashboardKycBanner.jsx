import { Link } from 'react-router-dom';
import { ShieldCheck, Wallet } from 'lucide-react';

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const Banner = ({ tone, Icon, title, body }) => (
  <div className={`mb-5 flex items-start gap-3 rounded-md border p-4 ${tone.box}`}>
    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.icon}`} strokeWidth={2.25} />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-0.5 text-xs text-gray-600">{body}</p>
    </div>
    <Link
      to="/dashboard/kyc"
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold text-white transition-colors ${tone.cta}`}
    >
      {tone.label}
    </Link>
  </div>
);

// Brand tokens (Loop & Slot). WARN = marigold = the design system's warning surface
// (matches Badge `warning` + the --warning token). CASH = c-emerald (positive/money).
// CTAs are maroon except the money banner, which keeps the positive emerald.
const WARN = { box: 'border-marigold-300 bg-marigold-100', icon: 'text-marigold-800', cta: 'bg-maroon hover:bg-maroon-dark', label: 'Verify now' };
const CASH = { box: 'border-c-emerald/30 bg-c-emerald/10', icon: 'text-c-emerald', cta: 'bg-c-emerald hover:opacity-90', label: 'Finish KYC' };

/**
 * DashboardKycBanner — KYC nudge on the host dashboard home.
 *
 * Two cases, most-urgent first:
 *   1. Money waiting — the host has earned but can't withdraw because KYC isn't done.
 *      Real cash on the line, so it outranks the pre-earnings nudge.
 *   2. Pre-earnings push — the host sells a paid service but hasn't started KYC, so a
 *      paid booking would be blocked (PAN gate). Prompt the one-time verification first.
 *
 * Hidden once KYC is submitted/approved (case 2) and for hosts with no paid service.
 *
 * Props:
 *   kyc            — GET /kyc/me payload ({ status, pending_earnings, payouts_ready }) or null
 *   hasPaidService — true if the host has at least one paid (non-free) service
 */
export default function DashboardKycBanner({ kyc, hasPaidService }) {
  if (!kyc) return null;
  const status = kyc.status;
  const approved = status === 'approved';
  const earned = Number(kyc.pending_earnings) > 0;
  const payoutsReady = !!kyc.payouts_ready;

  // 1. Money waiting — earned but not yet withdrawable (KYC incomplete). Highest priority.
  if (!approved && !payoutsReady && earned) {
    return (
      <Banner
        tone={CASH}
        Icon={Wallet}
        title={`You have ${rupees(kyc.pending_earnings)} waiting — finish KYC to withdraw`}
        body="Your earnings are held safely. Complete the one-time verification (PAN + bank) and we'll release them to your account."
      />
    );
  }

  // 2. Pre-earnings push — sells a paid service but hasn't started/finished KYC.
  if (approved || status === 'pending' || status === 'submitted') return null;
  if (!hasPaidService) return null;
  return (
    <Banner
      tone={WARN}
      Icon={ShieldCheck}
      title="Complete verification to accept payments"
      body="Your paid services can't be booked until you finish a quick one-time verification (PAN + bank). It takes a couple of minutes and you only do it once."
    />
  );
}
