import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMySubscriptions, cancelMembership } from "../services/api";
import BackButton from "../components/common/BackButton";
import { EmptyState, StatusBadge, Badge, ConfirmSheet } from "../components/dashboard/ui";
import { Users } from "lucide-react";
import toast from "react-hot-toast";

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null);

export default function MyMemberships() {
  const [subs, setSubs] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const load = async () => {
    try { const { data } = await getMySubscriptions(); setSubs(data.subscriptions || []); }
    catch { setSubs([]); }
  };
  useEffect(() => { load(); }, []);

  const doCancel = async () => {
    const s = confirmCancel; setConfirmCancel(null);
    try {
      await cancelMembership(s.host_id);
      toast.success(s.paid ? "Cancels at the end of your billing period." : "Membership ended.");
      await load();
    } catch (e) { toast.error(e?.response?.data?.message || "Could not cancel"); }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <BackButton />
      <h1 className="font-display text-2xl font-extrabold text-maroon">My memberships</h1>

      {subs && subs.length === 0 && (
        <EmptyState icon={Users} title="No memberships yet"
          description="Join a host's membership from their profile to see it here." />
      )}

      {subs?.map((s) => (
        <div key={s.id} className="mt-card flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {s.host?.username
                ? <Link to={`/${s.host.username}/membership`} className="font-semibold text-ink no-underline hover:text-maroon">{s.host?.name || "Host"}</Link>
                : <span className="font-semibold text-ink">{s.host?.name || "Host"}</span>}
              {s.tier && <Badge>{s.tier.name}{s.tier.type === "paid" ? ` · ₹${s.tier.price_inr}/mo` : " · Free"}</Badge>
              }
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink/60">
              <StatusBadge status={s.status} />
              {s.current_period_end && ["active", "past_due"].includes(s.status) && (
                <span>{s.paid ? "Renews" : "Since"} {fmtDate(s.current_period_end || s.started_at)}</span>
              )}
            </div>
          </div>
          {["active", "past_due"].includes(s.status) && (
            <button onClick={() => setConfirmCancel(s)} className="mt-btn mt-btn--ghost mt-btn--s shrink-0">Cancel</button>
          )}
        </div>
      ))}

      <ConfirmSheet open={!!confirmCancel} danger title="Cancel membership?"
        message={confirmCancel?.paid
          ? "You'll keep access until the end of your current billing period."
          : "You'll lose access to members-only posts right away."}
        confirmLabel="Cancel membership" cancelLabel="Keep it"
        onConfirm={doCancel} onClose={() => setConfirmCancel(null)} />
    </div>
  );
}
