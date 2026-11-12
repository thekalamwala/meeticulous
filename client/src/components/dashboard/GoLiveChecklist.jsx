import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Package, ShieldCheck, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { markLinkShared } from '../../services/api';
import { cn } from './ui/cn';

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const SHARE_KEY = 'mt_golive_link_shared';

const readShared = () => {
  try { return localStorage.getItem(SHARE_KEY) === '1'; } catch { return false; }
};

/**
 * GoLiveChecklist — the host activation path on the dashboard home: the three
 * things a host must do before their first paid booking can happen. Replaces the
 * standalone KYC banner on home (the KYC step folds in the "money waiting" nudge);
 * other pages keep KycNudgeStrip. Hides itself once all three are done.
 *
 * Props (all already loaded by Dashboard):
 *   kyc            — GET /kyc/me ({ status, pending_earnings, payouts_ready }) or null
 *   hasPaidService — true if the host has ≥1 paid (non-free) service
 *   username       — host booking-link slug
 */
export default function GoLiveChecklist({ kyc, hasPaidService, username }) {
  const [shared, setShared] = useState(readShared);

  const status = kyc?.status;
  // KYC counts as done once it's at least in review — nagging a host who already
  // submitted is noise. Approval is still required before payouts (enforced elsewhere).
  const kycDone = ['approved', 'submitted', 'pending'].includes(status);
  const moneyWaiting = Number(kyc?.pending_earnings) > 0 && status !== 'approved' && !kyc?.payouts_ready;

  const steps = [
    {
      key: 'service',
      done: hasPaidService,
      Icon: Package,
      title: 'Add a paid service',
      subtitle: hasPaidService ? 'Your catalogue is live.' : 'Create something guests can book and pay for.',
      to: '/dashboard/services',
      cta: 'Add service',
    },
    {
      key: 'kyc',
      done: kycDone,
      Icon: ShieldCheck,
      title: 'Verify to get paid',
      subtitle: moneyWaiting
        ? `${rupees(kyc.pending_earnings)} is waiting — finish KYC to withdraw.`
        : kycDone ? 'Verification in progress or complete.' : 'A one-time PAN + bank check. Takes a couple of minutes.',
      to: '/dashboard/kyc',
      cta: 'Verify now',
    },
    {
      key: 'link',
      done: shared,
      Icon: Link2,
      title: 'Share your booking link',
      subtitle: shared ? 'Nice — keep sharing it to get booked.' : 'Put your link where your audience already is.',
      cta: 'Copy link',
      onClick: async () => {
        if (!username) { toast.error('Set your username first.'); return; }
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/${username}`);
          toast.success('Booking link copied!');
          try { localStorage.setItem(SHARE_KEY, '1'); } catch { /* non-persistent is fine */ }
          setShared(true);
          markLinkShared();
        } catch {
          toast.error('Could not copy your link.');
        }
      },
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // fully live — nothing to nudge

  return (
    <section
      aria-label="Get set up"
      className="mb-5 rounded-2xl border border-maroon/15 bg-cream/60 p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-ink">Get set up to take bookings</h2>
          <p className="mt-0.5 text-xs text-ink/60">Finish these to start earning.</p>
        </div>
        <span className="shrink-0 rounded-full bg-maroon/10 px-2.5 py-1 text-xs font-bold text-maroon">
          {doneCount} of {steps.length}
        </span>
      </div>

      <ol className="space-y-2">
        {steps.map((s) => {
          const body = (
            <>
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                  s.done ? 'bg-c-emerald/15 text-c-emerald' : 'bg-maroon/10 text-maroon',
                )}
              >
                {s.done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <s.Icon className="h-4 w-4" strokeWidth={2} />}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className={cn('block truncate text-sm font-semibold', s.done ? 'text-ink/50 line-through' : 'text-ink')}>
                  {s.title}
                </span>
                <span className="block truncate text-xs text-ink/60">{s.subtitle}</span>
              </span>
              {!s.done && (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-maroon px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-maroon-dark">
                  {s.cta}
                </span>
              )}
            </>
          );
          const rowCls = 'flex items-center gap-3 rounded-xl border border-maroon/10 bg-white px-3 py-2.5';
          if (s.done) return <li key={s.key} className={rowCls}>{body}</li>;
          return (
            <li key={s.key}>
              {s.to
                ? <Link to={s.to} className={cn(rowCls, 'transition-colors hover:border-maroon/25')}>{body}</Link>
                : <button type="button" onClick={s.onClick} className={cn(rowCls, 'w-full transition-colors hover:border-maroon/25')}>{body}</button>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
