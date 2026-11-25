import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getMembershipSpace, joinMembership, createMembershipSubscription, syncMembershipSubscription, verifyMembershipUpgrade } from "../services/api";
import loadRazorpay from "../utils/loadRazorpay";
import { useAuth } from "../context/AuthContext";
import ItemCard from "../components/community/ItemCard";
import { Check, Lock, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

export default function MembershipSpace() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | notfound
  const [joining, setJoining] = useState(null);

  const load = async () => {
    try {
      const { data } = await getMembershipSpace(username);
      setData(data); setStatus("ok");
    } catch (e) {
      setStatus(e?.response?.status === 404 ? "notfound" : "error");
    }
  };
  useEffect(() => { load(); }, [username]);

  if (status === "loading") return <div className="mx-auto max-w-2xl p-6 text-muted">Loading…</div>;
  if (status !== "ok") return (
    <div className="mx-auto max-w-2xl p-6 text-center">
      <p className="text-ink/70">No membership here yet.</p>
      <Link to={`/${username}`} className="mt-btn mt-btn--secondary mt-btn--s mt-3 inline-flex">View profile</Link>
    </div>
  );

  const { host, program, tiers, posts, viewer_membership: mine } = data;

  const join = async (tier) => {
    if (!user) { navigate(`/login?next=/${username}/membership`); return; }
    setJoining(tier.id);
    try {
      if (tier.type === "free") {
        await joinMembership(tier.id);
        toast.success(`You're in — ${tier.name}`);
        await load(); // unlocks posts in place
        return;
      }
      // Paid: Razorpay recurring checkout. Webhook grants entitlement; sync is the on-return fallback.
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error("Payment gateway failed to load"); return; }
      const { data } = await createMembershipSubscription(tier.id);

      // Moving up from a cheaper paid tier: a one-time order for the prorated
      // difference, not a new mandate. The recurring one starts at the old period end.
      if (data.upgrade) {
        new window.Razorpay({
          key: data.key,
          order_id: data.razorpay_order_id,
          amount: data.amount,
          currency: data.currency,
          name: "Meeticulous",
          description: `${data.from_tier?.name || "Current tier"} → ${tier.name}`,
          handler: async (r) => {
            try {
              await verifyMembershipUpgrade({
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
              });
              toast.success(`You're on ${tier.name}`);
            } catch (err) {
              toast.error(err?.response?.data?.message || "Payment taken, but the upgrade did not apply. We're on it.");
            }
            await load();
          },
          prefill: { name: user?.name, email: user?.email },
          theme: { color: "#960D32" },
        }).open();
        return;
      }

      new window.Razorpay({
        key: data.key,
        subscription_id: data.subscription_id,
        name: "Meeticulous",
        description: `${program.name} — ${tier.name} (auto-renews)`,
        handler: async () => {
          try { await syncMembershipSubscription(data.subscription_id); } catch { /* webhook will catch up */ }
          toast.success(`Membership active — ${tier.name}`);
          await load();
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#960D32" },
      }).open();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not join");
    } finally { setJoining(null); }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-5">
      <Link to={`/${username}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-maroon">
        <ArrowLeft size={16} /> {host.name || host.username}
      </Link>

      {program.cover_url && (
        <img src={program.cover_url} alt="" className="h-40 w-full rounded-2xl object-cover bg-blush" />
      )}
      <div>
        <h1 className="font-display text-2xl font-extrabold text-maroon">{program.name}</h1>
        {program.blurb && <p className="mt-1 text-ink/70">{program.blurb}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiers.map((t) => {
          const current = mine?.tier_id === t.id;
          // What the member holds now decides whether another tier is a move up
          // (allowed, prorated) or down (cancel first — they keep the paid period).
          const heldPrice = mine ? Number(tiers.find((x) => x.id === mine.tier_id)?.price_inr) || 0 : 0;
          const price = Number(t.price_inr) || 0;
          const isUpgrade = !!mine && !current && price > heldPrice;
          const isDowngrade = !!mine && !current && price <= heldPrice;
          return (
            <div key={t.id} className="mt-card flex flex-col gap-3 p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg">{t.name}</h3>
                <span className="font-semibold text-maroon">{t.type === "free" ? "Free" : `₹${t.price_inr}/mo`}</span>
              </div>
              {t.perks?.length > 0 && (
                <ul className="space-y-1 text-sm text-ink/70">
                  {t.perks.map((p, i) => <li key={i} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-maroon" />{p}</li>)}
                </ul>
              )}
              {current ? (
                <span className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-blush px-3 py-1.5 text-sm font-medium text-maroon">
                  <Check size={15} /> Current plan
                </span>
              ) : isDowngrade ? (
                <span className="mt-auto text-center text-xs text-ink/50">
                  Cancel your current tier to move here — it stays active until the period you have paid for ends.
                </span>
              ) : (
                <button onClick={() => join(t)} disabled={joining === t.id}
                  className="mt-btn mt-btn--primary mt-btn--s mt-auto">
                  {joining === t.id
                    ? (isUpgrade ? "Upgrading…" : "Joining…")
                    : isUpgrade ? `Upgrade · ₹${t.price_inr}/mo`
                    : t.type === "free" ? "Join free" : `Join · ₹${t.price_inr}/mo`}
                </button>
              )}
              {isUpgrade && (
                <p className="-mt-1 text-center text-xs text-ink/50">
                  You pay the difference for the days left on your current tier.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {posts.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg flex items-center gap-2"><Lock size={16} className="text-maroon" /> Recent from {host.name || host.username}</h2>
          {posts.map((p) => <ItemCard key={p.id} item={p} viewerId={user?.id} />)}
        </div>
      )}
    </div>
  );
}
