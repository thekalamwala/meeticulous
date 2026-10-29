import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Gift, Hourglass, Copy, Check, Share2, Banknote } from "lucide-react";
import { getMyReferrals } from "../services/api";
import toast from "react-hot-toast";
import {
  PageHeader, Section, StatCard, DataTable, Badge, Button,
  EmptyState, ErrorState, SkeletonCard, fmtMoney,
} from "../components/dashboard/ui";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Public plan labels (DB slugs → what hosts see on the pricing page).
const PLAN_LABEL = { creator: "Host+", professional: "Studio" };
const planLabel = (slug) => PLAN_LABEL[slug] || slug || "—";

const COLUMNS = [
  { key: "date", header: "Date", render: (r) => <span className="text-gray-600">{fmtDate(r.created_at)}</span> },
  {
    key: "plan", header: "Plan",
    render: (r) => (r.referred_plan
      ? <span className="text-gray-700">{planLabel(r.referred_plan)}<span className="text-gray-400"> · {r.cadence}</span></span>
      : <span className="text-gray-400">—</span>),
  },
  {
    key: "reward", header: "Reward",
    render: (r) => (Number(r.reward_value) > 0
      ? <span className="font-semibold text-gray-800">{fmtMoney(r.reward_value, { decimals: true })}</span>
      : <span className="text-gray-400">—</span>),
  },
  {
    key: "status", header: "Status",
    // Friendly labels for the referral lifecycle.
    render: (r) => {
      const map = {
        pending: { label: "Signed up", tone: "neutral" },
        qualified: { label: "In review", tone: "warning" },
        rewarded: { label: "Rewarded", tone: "success" },
        rejected: { label: "Not eligible", tone: "danger" },
      };
      const m = map[r.status] || { label: r.status, tone: "neutral" };
      return <Badge tone={m.tone} dot>{m.label}</Badge>;
    },
  },
];

const ReferEarn = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: d } = await getMyReferrals();
      setData(d);
    } catch {
      setError(true);
      toast.error("Failed to load your referrals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const username = data?.username || "";
  const link = username ? `${window.location.origin}/?ref=${username}` : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy — select and copy manually");
    }
  };

  const share = async () => {
    if (!link || !navigator.share) return copy();
    try {
      await navigator.share({ title: "Meeticulous", text: "Run your bookings on Meeticulous — join with my link:", url: link });
    } catch { /* user cancelled */ }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Refer & Earn" subtitle="Invite other hosts. Earn cash when they subscribe." />
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
        <PageHeader title="Refer & Earn" subtitle="Invite other hosts. Earn cash when they subscribe." />
        <ErrorState message="Couldn’t load your referrals." onRetry={load} />
      </div>
    );
  }

  const s = data?.stats || {};

  return (
    <div>
      <PageHeader title="Refer & Earn" subtitle="Invite other hosts. Earn cash when they subscribe." />

      {/* Referral link */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-gray-800">Your referral link</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 truncate rounded-lg bg-gray-50 px-3 py-2.5 font-mono text-sm text-gray-600">
            {link || "Set a username to get your link"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy} disabled={!link}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button onClick={share} disabled={!link}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Share it with other creators. When someone signs up as a host through your link and pays for a plan,
          you earn a cash reward that lands in your payout balance after a short review window.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-2 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Hosts referred" value={s.total || 0} icon={Users} tone="primary" />
        <StatCard label="Earned" value={fmtMoney(s.earned, { decimals: true })} icon={Gift} tone="success" />
        <StatCard label="In review" value={fmtMoney(s.pendingValue, { decimals: true })} icon={Hourglass} tone="warning" />
      </div>

      <p className="mb-6 mt-4 flex items-start gap-2 text-xs text-gray-500">
        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <span>
          Rewards are paid in cash to your{" "}
          <Link to="/dashboard/payments/payouts" className="font-semibold text-primary hover:underline">payout balance</Link>{" "}
          once released. Complete KYC to withdraw.
        </span>
      </p>

      <Section title="Your referrals">
        <DataTable
          columns={COLUMNS}
          rows={data?.referrals || []}
          empty={<EmptyState icon={Users} title="No referrals yet" description="Share your link above. Your referred hosts and rewards will show up here." />}
        />
      </Section>
    </div>
  );
};

export default ReferEarn;
