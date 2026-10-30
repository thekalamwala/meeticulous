import { Link } from "react-router-dom";
import { Gift, Lock, Ticket, Percent, Trophy, Sparkles } from "lucide-react";

// /loyalty — Loyalty Program (INACTIVE / base state).
// Model (agreed): users unlock benefits purely by total amount spent on the
// platform — no other condition. This page lays out the full surface (tiers,
// rewards, scratch cards, affiliate promo codes) in a locked "coming soon"
// state. Wire real spend + rewards data when the backend lands (see gap list).

// Spend thresholds (₹) → tier. Placeholder values; admin-tunable later.
const TIERS = [
  { name: "Bronze",   spend: 0,     perks: "Welcome offers",            color: "#CD7F32" },
  { name: "Silver",   spend: 5000,  perks: "5% back as credits",        color: "#9CA3AF" },
  { name: "Gold",     spend: 15000, perks: "10% back + priority slots",  color: "#F5B301" },
  { name: "Platinum", spend: 40000, perks: "Exclusive drops + concierge",color: "#6B7280" },
];

const LockedCard = ({ icon: Icon, title, desc }) => (
  <div className="relative bg-white border rounded-2xl p-5 overflow-hidden">
    <div className="absolute top-3 right-3 text-gray-300"><Lock size={15} /></div>
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 text-gray-400 mb-3">
      <Icon size={20} />
    </span>
    <p className="font-semibold text-gray-800">{title}</p>
    <p className="text-sm text-gray-500 mt-1">{desc}</p>
  </div>
);

const Loyalty = () => {
  // No spend data wired yet — everything renders locked.
  const spent = 0;

  return (
    <>
      {/* Header / coming soon banner */}
        <div className="rounded-2xl p-6 sm:p-8 mb-6 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#960D32,#960D32)" }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-90">
            <Sparkles size={14} /> Coming soon
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-2">Loyalty Program</h1>
          <p className="text-sm opacity-90 mt-1 max-w-md">
            Spend on Meeticulous, climb tiers, and unlock rewards automatically. The more you book, the more you get back.
          </p>
        </div>

        {/* Tier progress */}
        <div className="bg-white border rounded-2xl p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Your tier</h2>
            <span className="text-xs text-gray-400">Total spent: ₹{spent.toLocaleString("en-IN")}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TIERS.map((t) => {
              const unlocked = spent >= t.spend;
              return (
                <div key={t.name}
                  className={`rounded-xl border p-3 text-center ${unlocked ? "border-[#960D32]/40 bg-[#960D32]/5" : "bg-gray-50"}`}>
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full mb-2"
                    style={{ background: `${t.color}22`, color: t.color }}>
                    {unlocked ? <Trophy size={17} /> : <Lock size={15} />}
                  </span>
                  <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">₹{t.spend.toLocaleString("en-IN")}+</p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">{t.perks}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rewards grid */}
        <h2 className="font-semibold text-gray-900 mb-3">Rewards</h2>
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <LockedCard icon={Gift}    title="Rewards"   desc="Credits and gifts that unlock as you spend." />
          <LockedCard icon={Ticket}  title="Scratch cards" desc="Win surprise rewards after eligible bookings." />
          <LockedCard icon={Percent} title="Promo codes" desc="Exclusive codes from our affiliate partners." />
        </div>

        <div className="bg-white border rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-500">
            We're putting the finishing touches on rewards. Keep booking — your spend will count toward your tier the day it goes live.
          </p>
          <Link to="/explore" className="inline-block text-sm font-medium text-[#960D32] hover:underline mt-3">Explore creators →</Link>
        </div>
    </>
  );
};

export default Loyalty;
