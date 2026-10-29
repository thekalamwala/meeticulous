import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Banknote, Clock, Hourglass, ShieldCheck, CheckCircle2 } from "lucide-react";
import { getPayoutBalance, getTransactions, getMyKyc } from "../services/api";
import toast from "react-hot-toast";
import {
  PageHeader, Section, StatCard, DataTable, EmptyState, ErrorState, SkeletonCard, fmtMoney,
} from "../components/dashboard/ui";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

// Map a booking's Route transfer state to a host-facing settlement status. Payouts
// are automatic (Razorpay Route): the host's share is transferred on capture, held
// briefly, then released to their bank. `transfer_status` is the source of truth.
const settlementOf = (b) => {
  switch (b.transfer_status) {
    case "processed": return { label: "Settled",   tone: "green", when: b.transfer_released_at, whenLabel: "Settled on" };
    case "pending":   return { label: "In transit", tone: "amber", when: b.transfer_hold_until,  whenLabel: "Clears by" };
    case "reversed":  return { label: "Reversed",   tone: "rose",  when: b.transfer_released_at, whenLabel: "Reversed" };
    case "failed":    return { label: "Failed",     tone: "rose",  when: null,                   whenLabel: "" };
    default:          return { label: "Processing", tone: "gray",  when: null,                   whenLabel: "" };
  }
};

const TONE = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose:  "bg-rose-50 text-rose-700 border-rose-200",
  gray:  "bg-gray-100 text-gray-600 border-gray-200",
};

const SettleBadge = ({ s }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[s.tone]}`}>
    {s.label}
  </span>
);

const COLUMNS = [
  { key: "date", header: "Date", render: (r) => <span className="text-gray-600">{fmtDate(r.scheduled_at || r.created_at)}</span> },
  {
    key: "booking", header: "Booking",
    render: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-800">{r.services?.title || "Service"}</p>
        <p className="truncate text-xs text-gray-400">{r.guest_name || r.guest_email || "Guest"}</p>
      </div>
    ),
  },
  { key: "amount", header: "Payout", render: (r) => <span className="font-semibold text-gray-800">{fmtMoney(r.vendor_amount, { decimals: true })}</span> },
  {
    key: "status", header: "Status",
    render: (r) => {
      const s = settlementOf(r);
      return (
        <div>
          <SettleBadge s={s} />
          {s.whenLabel && s.when && <p className="mt-0.5 text-xs text-gray-400">{s.whenLabel} {fmtDate(s.when)}</p>}
        </div>
      );
    },
  },
];

const Payouts = () => {
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
        getTransactions({ limit: 50, sort: "desc" }),
        getMyKyc().then((r) => r.data).catch(() => ({ status: "not_started" })),
      ]);
      setBalance(bal);
      // Only bookings that actually generated a payout (a Route transfer) — this is
      // a settlement statement, not the full transaction list.
      setRows((txn?.data || []).filter((b) => b.razorpay_transfer_id || Number(b.vendor_amount) > 0));
      setKycStatus(kyc?.status || "not_started");
    } catch {
      setError(true);
      toast.error("Failed to load payout data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const kycApproved = kycStatus === "approved";
  const subtitle = "Payouts are automatic — your share of each paid booking is settled to your bank.";

  if (loading) {
    return (
      <div>
        <PageHeader title="Payouts" subtitle={subtitle} />
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <DataTable columns={COLUMNS} rows={[]} loading />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Payouts" subtitle={subtitle} />
        <ErrorState message="Couldn’t load your payout data." onRetry={load} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Payouts" subtitle={subtitle} />

      {/* KYC gate — payouts only release once verification is approved. */}
      {kycApproved ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800">Verified — payouts settle automatically to your bank.</p>
        </div>
      ) : (
        <Link to="/dashboard/kyc" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {kycStatus === "pending" ? "Verification under review" : "Complete verification to get paid"}
            </p>
            <p className="text-xs text-amber-700">
              {kycStatus === "pending"
                ? "Payouts release automatically once your KYC is approved."
                : "You must complete identity verification (KYC) before any payout can be released. Tap to start."}
            </p>
          </div>
        </Link>
      )}

      {/* Settlement summary. */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total Paid Out" value={fmtMoney(balance?.paidOut, { decimals: true })} icon={Banknote} tone="primary" />
        <StatCard label="In Transit" value={fmtMoney(balance?.clearing, { decimals: true })} icon={Clock} tone="warning" />
        <StatCard label="Pending Completion" value={fmtMoney(balance?.pendingCompletion, { decimals: true })} icon={Hourglass} tone="neutral" />
      </div>

      <Section title="Payout history">
        <DataTable
          columns={COLUMNS}
          rows={rows}
          empty={<EmptyState icon={Banknote} title="No payouts yet" description="When a paid booking settles, the payout to your bank shows up here with its status and date." />}
        />
      </Section>
    </div>
  );
};

export default Payouts;
