// Payouts — dashboard_v2 graduation. v2 look (SubNav + balance tiles + dense
// settlement list) on the SAME real data as Payouts.jsx: getPayoutBalance /
// getTransactions / getMyKyc, same Razorpay-Route settlement mapping, same KYC
// gate. Shown on the flag-ON path (App picks it in PayoutsRoute).
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ShieldCheck, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPayoutBalance, getTransactions, getMyKyc } from '../services/api';
import { ErrorState, Skeleton } from '../components/dashboard/ui';
import { PageHeading, Panel, SubNav, Tile, StatusPill, Avatar, inr, fmtDay } from '../components/dashboard/ui/v2';
import { MONEY_NAV } from './dashboardNav';

// Route transfer state → host-facing settlement word + StatusPill key.
const settlementOf = (b) => {
  switch (b.transfer_status) {
    case 'processed': return ['processed', b.transfer_released_at, 'Settled'];
    case 'pending':   return ['in_transit', b.transfer_hold_until, 'Clears by'];
    case 'reversed':  return ['refunded', b.transfer_released_at, 'Reversed'];
    case 'failed':    return ['failed', null, ''];
    default:          return ['pending', null, ''];
  }
};

const PayoutsV2 = () => {
  const [balance, setBalance] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [kycStatus, setKycStatus] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [{ data: bal }, { data: txn }, kyc] = await Promise.all([
        getPayoutBalance(),
        getTransactions({ limit: 50, sort: 'desc' }),
        getMyKyc().then((r) => r.data).catch(() => ({ status: 'not_started' })),
      ]);
      setBalance(bal);
      setRows((txn?.data || []).filter((b) => b.razorpay_transfer_id || Number(b.vendor_amount) > 0));
      setKycStatus(kyc?.status || 'not_started');
    } catch {
      setError(true);
      toast.error('Failed to load payout data');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const kycApproved = kycStatus === 'approved';
  const header = (
    <>
      <PageHeading title="Payouts" sub="Your share of each paid booking, settled to your bank automatically." />
    </>
  );

  if (loading) {
    return <div className="flex flex-col gap-2.5">{header}<Skeleton className="h-20 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  }
  if (error) {
    return <div className="flex flex-col gap-2.5">{header}<ErrorState message="Couldn't load your payout data." onRetry={load} /></div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      {kycApproved ? (
        <div className="flex items-center gap-2 rounded-md border-2 border-success-fg/20 bg-success-bg px-3 py-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg" strokeWidth={2.4} />
          <p className="text-[11.5px] font-semibold text-success-fg">Verified — payouts settle automatically to your bank.</p>
        </div>
      ) : (
        <Link to="/dashboard/kyc" className="flex items-start gap-2 rounded-md border-2 border-marigold-300 bg-marigold-100 px-3 py-2.5 hover:bg-marigold-100/70">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-marigold-800" strokeWidth={2.4} />
          <div>
            <p className="text-[11.5px] font-bold text-marigold-800">
              {kycStatus === 'pending' ? 'Verification under review' : 'Complete verification to get paid'}
            </p>
            <p className="text-[10.5px] font-medium text-marigold-800">
              {kycStatus === 'pending'
                ? 'Payouts release automatically once your KYC is approved.'
                : 'Finish identity verification (KYC) before any payout can be released. Tap to start.'}
            </p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Total paid out" value={inr(balance?.paidOut, { compact: true })} accent />
        <Tile label="In transit" value={inr(balance?.clearing, { compact: true })} hint="Clearing to bank" />
        <Tile label="Pending" value={inr(balance?.pendingCompletion, { compact: true })} hint="Awaiting completion" />
      </div>

      <Panel title="Payout history" flush>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-14 text-center">
            <Banknote className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12px] font-bold text-ink">No payouts yet</p>
            <p className="max-w-sm text-[11px] font-medium text-ink/55">When a paid booking settles, the payout to your bank shows up here with its status and date.</p>
          </div>
        ) : (
          <ul className="divide-y-2 divide-neutral-100">
            {rows.map((r) => {
              const [key, when, whenLabel] = settlementOf(r);
              return (
                <li key={r.id} className="flex items-center gap-2.5 px-3 py-2">
                  <Avatar name={r.guest_name || r.guest_email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-ink">{r.services?.title || 'Service'}</p>
                    <p className="truncate text-[10.5px] font-medium text-ink/50">
                      {fmtDay(r.scheduled_at || r.created_at)}{when && whenLabel ? ` · ${whenLabel} ${fmtDay(when)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-ink">{inr(r.vendor_amount, { decimals: true })}</span>
                  <StatusPill status={key}>{key === 'failed' ? 'Failed' : undefined}</StatusPill>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default PayoutsV2;
