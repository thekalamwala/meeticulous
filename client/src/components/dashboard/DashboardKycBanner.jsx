import { Link } from 'react-router-dom';
import { ShieldCheck, Wallet } from 'lucide-react';

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// Kept notice: a white card on the cream page, a blush icon chip, one sentence and
// one maroon button. It replaces the full-width coloured banner, which added a third
// ground colour to every page and took a quarter of the first phone screen.
// Marigold is reserved for open time slots, and green for status words.
const Banner = ({ tone, Icon, title, body }) => (
  <div className="mb-4 flex items-center gap-3 rounded-[20px] bg-white p-3 sm:mb-6 sm:gap-4 sm:p-4">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-blush text-maroon">
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="mb-0 text-[14px] font-semibold leading-snug text-ink">{title}</p>
      <p className="mb-0 mt-0.5 hidden text-[13px] text-muted sm:block">{body}</p>
    </div>
    <Link
      to="/dashboard/kyc"
      className="shrink-0 whitespace-nowrap rounded-[12px] bg-maroon px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
    >
      {tone.label}
    </Link>
  </div>
);

const WARN = { label: 'Verify now' };
const CASH = { label: 'Finish KYC' };

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
        title={`${rupees(kyc.pending_earnings)} is waiting for you`}
        body="Verify your PAN and bank once and we'll release it to your account."
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
