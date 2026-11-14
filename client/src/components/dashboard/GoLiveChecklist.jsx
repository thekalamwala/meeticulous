import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, Package, ShieldCheck, Link2, ChevronDown } from 'lucide-react';
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
 * things a host must do before their first paid booking can happen. Renders as a
 * compact "Setup 1/3" pill (top-right of the greeting) that opens a dropdown with
 * the full checklist. Hides itself once all three are done.
 *
 * Props (all already loaded by Dashboard):
 *   kyc            — GET /kyc/me ({ status, pending_earnings, payouts_ready }) or null
 *   hasPaidService — true if the host has ≥1 paid (non-free) service
 *   username       — host booking-link slug
 */
export default function GoLiveChecklist({ kyc, hasPaidService, username }) {
  const [shared, setShared] = useState(readShared);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

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
      subtitle: hasPaidService ? 'Your catalogue is live.' : 'Let clients book and pay for your services.',
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
        : kycDone ? 'Verification in progress or complete.' : 'A one-time PAN & bank check.',
      to: '/dashboard/kyc',
      cta: 'Verify now',
    },
    {
      key: 'link',
      done: shared,
      Icon: Link2,
      title: 'Share your booking link',
      subtitle: shared ? 'Keep sharing it to get booked.' : 'Put your link where your audience already is.',
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

  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === total) return null; // fully live — nothing to nudge

  return (
    <div ref={wrapRef} className="relative shrink-0">
      {/* Pill trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Setup ${doneCount} of ${total} complete`}
        className="flex items-center gap-2.5 rounded-full border border-maroon/15 bg-white px-3.5 py-2 shadow-sm transition-colors hover:border-maroon/30"
      >
        <span className="text-xs font-bold text-maroon">Setup</span>
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-maroon/10">
          <span
            className="block h-full rounded-full bg-maroon transition-all"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </span>
        <span className="text-xs font-semibold text-ink/60">{doneCount}/{total}</span>
        <ChevronDown className={cn('h-4 w-4 text-maroon transition-transform', open && 'rotate-180')} strokeWidth={2.5} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-maroon/15 bg-white shadow-lg">
          <div className="border-b border-maroon/10 bg-cream/60 px-4 py-3">
            <h2 className="font-display text-sm font-bold text-ink">Complete your setup</h2>
            <p className="mt-0.5 text-xs text-ink/60">Finish these steps to start earning.</p>
          </div>

          <ol className="p-2">
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
                    {!s.done && (
                      <span className="mt-0.5 block text-xs font-bold text-maroon">{s.cta} →</span>
                    )}
                  </span>
                </>
              );
              const rowCls = 'flex items-start gap-3 rounded-2xl px-2.5 py-2.5';
              if (s.done) return <li key={s.key} className={rowCls}>{body}</li>;
              return (
                <li key={s.key}>
                  {s.to
                    ? <Link to={s.to} onClick={() => setOpen(false)} className={cn(rowCls, 'transition-colors hover:bg-cream')}>{body}</Link>
                    : <button type="button" onClick={s.onClick} className={cn(rowCls, 'w-full transition-colors hover:bg-cream')}>{body}</button>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
