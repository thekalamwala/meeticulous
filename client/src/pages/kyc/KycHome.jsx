import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { getMyKyc } from '../../services/api';
import { PageHeader, Card, Button, SkeletonCard } from '../../components/dashboard/ui';

const STATE = {
  pending:  { icon: Clock,        color: 'text-amber-500',  bg: 'bg-amber-50',  title: 'Verification in review', desc: "Your documents are being reviewed. Payouts unlock once approved." },
  approved: { icon: CheckCircle2, color: 'text-green-500',  bg: 'bg-green-50',  title: 'Verified', desc: 'Your identity is verified. You can request payouts.' },
  rejected: { icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-50',    title: 'Verification rejected', desc: 'Please review the note below and re-submit.' },
};

export default function KycHome() {
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getMyKyc().then(({ data }) => setKyc(data)).catch(() => setKyc({ status: 'not_started' })).finally(() => setLoading(false));
  }, []);

  if (loading) return <div><PageHeader title="Verification" subtitle="Verify your identity to receive payouts." /><SkeletonCard /></div>;

  const status = kyc?.status || 'not_started';
  const s = STATE[status];

  const pending = Number(kyc?.pending_earnings) || 0;
  const payoutsReady = !!kyc?.payouts_ready;

  return (
    <div>
      <PageHeader title="Verification" subtitle="Verify your identity to receive payouts." />
      {pending > 0 && !payoutsReady && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="text-2xl">💰</span>
          <p className="text-sm text-amber-800">
            You have <span className="font-bold">₹{pending.toLocaleString('en-IN')}</span> in pending earnings.
            {status === 'approved'
              ? ' Your payout account is being set up — you’ll receive them automatically once it’s active.'
              : ' Complete your KYC to receive them.'}
          </p>
        </div>
      )}
      {status === 'approved' && !payoutsReady && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-800">Finish your payout setup</p>
          <p className="mt-1 text-sm text-blue-700">
            Add your registered address and payout details so we can pay you via Razorpay Route. Tap “Update KYC details” below.
          </p>
        </div>
      )}
      {status === 'not_started' ? (
        <Card className="flex flex-col items-center p-8 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <h2 className="mb-1 text-lg font-bold text-gray-900">Complete your KYC</h2>
          <p className="mb-6 max-w-sm text-sm text-gray-500">
            A quick 3-step check — personal details, bank account, and your registered address. Required before your first payout.
          </p>
          <div className="w-full max-w-xs">
            <Button size="lg" full onClick={() => navigate('/dashboard/kyc/flow/start')}>Start verification</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${s.bg} ${s.color}`}>
              <s.icon className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">{s.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{s.desc}</p>
              {status === 'rejected' && kyc?.review_note && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"><span className="font-medium">Reason:</span> {kyc.review_note}</p>
              )}
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-gray-400">PAN</dt><dd className="text-gray-800">{kyc?.pan_number || '—'}</dd></div>
                <div><dt className="text-gray-400">Aadhaar</dt><dd className="text-gray-800">{kyc?.aadhaar_number || '—'}</dd></div>
                <div><dt className="text-gray-400">Bank</dt><dd className="text-gray-800">{kyc?.bank_name || '—'}</dd></div>
                <div><dt className="text-gray-400">Account</dt><dd className="text-gray-800">{kyc?.account_number || '—'}</dd></div>
              </dl>
              {(status === 'rejected' || status === 'approved') && (
                <div className="mt-5 max-w-xs">
                  <Button size="lg" full variant={status === 'approved' ? 'outline' : undefined}
                    onClick={() => navigate('/dashboard/kyc/flow/start')}>
                    {status === 'approved' ? 'Update KYC details' : 'Re-submit'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
