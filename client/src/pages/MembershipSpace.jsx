import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getMembershipSpace, joinMembership } from "../services/api";
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
    if (tier.type !== "free") { toast("Paid memberships are coming soon."); return; } // M6: Razorpay checkout
    setJoining(tier.id);
    try {
      await joinMembership(tier.id);
      toast.success(`You're in — ${tier.name}`);
      await load(); // unlocks posts in place
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
              ) : (
                <button onClick={() => join(t)} disabled={joining === t.id}
                  className="mt-btn mt-btn--primary mt-btn--s mt-auto">
                  {joining === t.id ? "Joining…" : t.type === "free" ? "Join free" : `Join · ₹${t.price_inr}/mo`}
                </button>
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
