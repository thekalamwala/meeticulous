import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { getMySubscriptions, cancelMembership } from "../services/api";
import { useRegisterRefresh } from "../components/dashboard/ui/refreshContext";
import { ConfirmSheet } from "../components/dashboard/ui";
import { StatusPill } from "../components/dashboard/ui/v2";
import { KeptError } from "./catalog/KeptKit";
import { GuestEmpty, LibraryHead, btnPrimary, btnQuiet } from "./guest/GuestKit";

// /user/memberships — Library › Memberships (Kept). Cancel copy and behaviour as before.
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

export default function MyMemberships() {
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const load = useCallback(() => getMySubscriptions()
    .then(({ data }) => { setSubs(data.subscriptions || []); setError(false); })
    .catch(() => setError(true)), []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);

  const doCancel = async () => {
    const s = confirmCancel; setConfirmCancel(null);
    try {
      await cancelMembership(s.host_id);
      toast.success(s.paid ? "Cancels at the end of your billing period." : "Membership ended.");
      await load();
    } catch (e) { toast.error(e?.response?.data?.message || "Could not cancel"); }
  };

  return (
    <div className="flex flex-col gap-6">
      <LibraryHead />
      {error && !subs ? <KeptError what="memberships" onRetry={load} />
        : !subs ? <div aria-hidden="true" className="h-40 animate-pulse rounded-[24px] bg-white" />
          : subs.length === 0 ? (
            <GuestEmpty mascot="green" title="No memberships yet" sub="Join a host's membership from their page to see it here."
              action={<Link to="/explore" className={btnPrimary}>Browse creators</Link>} />
          ) : (
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-[24px] bg-white">
              {subs.map((s) => {
                const live = ["active", "past_due"].includes(s.status);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                    <div className="min-w-0 flex-1">
                      {s.host?.username
                        ? <Link to={`/${s.host.username}/membership`} className="block truncate text-[15px] font-semibold text-ink hover:text-maroon hover:no-underline">{s.host?.name || "Host"}</Link>
                        : <span className="block truncate text-[15px] font-semibold text-ink">{s.host?.name || "Host"}</span>}
                      <p className="mb-0 mt-0.5 truncate text-[13px] text-muted">
                        {s.tier ? `${s.tier.name} · ${s.tier.type === "paid" ? `₹${s.tier.price_inr}/mo` : "Free"}` : "Membership"}
                        {live && s.current_period_end ? ` · ${s.paid ? "Renews" : "Since"} ${fmtDate(s.current_period_end || s.started_at)}` : ""}
                      </p>
                    </div>
                    <StatusPill status={s.status}>{s.status === "past_due" ? "Payment due" : undefined}</StatusPill>
                    {live && <button type="button" onClick={() => setConfirmCancel(s)} className={btnQuiet}>Cancel</button>}
                  </li>
                );
              })}
            </ul>
          )}

      <ConfirmSheet open={!!confirmCancel} danger title="Cancel membership?"
        message={confirmCancel?.paid
          ? "You'll keep access until the end of your current billing period."
          : "You'll lose access to members-only posts right away."}
        confirmLabel="Cancel membership" cancelLabel="Keep it"
        onConfirm={doCancel} onClose={() => setConfirmCancel(null)} />
    </div>
  );
}
