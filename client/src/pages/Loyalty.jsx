import { Link } from "react-router-dom";
import { Gift, Lock, Ticket, Percent, Trophy, Sparkles } from "lucide-react";

// /loyalty — Loyalty Program (INACTIVE / base state).
// Model (agreed): users unlock benefits purely by total amount spent on the
// platform — no other condition. This page lays out the full surface (tiers,
// rewards, scratch cards, affiliate promo codes) in a locked "coming soon"
// state. Wire real spend + rewards data when the backend lands (see gap list).

// Spend thresholds (₹) → tier. Placeholder values; admin-tunable later.
// `how` = plain-language "how you reach this tier" (spend-only model).
const TIERS = [
  { name: "Bronze",   spend: 0,     perks: "Welcome offers",             how: "Everyone starts here",        color: "#CD7F32" },
  { name: "Silver",   spend: 5000,  perks: "5% back as credits",         how: "Spend ₹5,000 in total",       color: "#9CA3AF" },
  { name: "Gold",     spend: 15000, perks: "10% back + priority slots",   how: "Spend ₹15,000 in total",      color: "#F5B301" },
  { name: "Platinum", spend: 40000, perks: "Exclusive drops + concierge", how: "Spend ₹40,000 in total",      color: "#6B7280" },
];

const LockedCard = ({ icon: Icon, title, desc }) => (
  <div className="relative overflow-hidden rounded-[8px] border-2 border-neutral-200 bg-white p-4">
    <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-neutral-100 text-ink/35"><Lock className="h-3 w-3" strokeWidth={2.4} /></span>
    <Icon className="h-6 w-6 text-maroon" strokeWidth={1.9} />
    <p className="mt-2 font-display text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">{title}</p>
    <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-ink/50">{desc}</p>
  </div>
);

const Loyalty = () => {
  // No spend data wired yet — everything renders locked.
  const spent = 0;

  return (
    <>
      {/* Header / coming soon banner */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-maroon p-5 text-white">
          <Sparkles className="h-6 w-6 shrink-0" strokeWidth={2} />
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/60">Coming soon</p>
            <h1 className="font-display text-[18px] font-extrabold tracking-[-0.03em]">Loyalty program</h1>
            <p className="max-w-md text-[12px] font-medium text-white/75">
              Spend on Meeticulous, climb tiers, and unlock rewards automatically. The more you book, the more you get back.
            </p>
          </div>
        </div>

        {/* Tier progress */}
        <div className="mb-5 rounded-[8px] border-2 border-neutral-200 bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">Your tier</h2>
            <span className="text-[12px] font-semibold text-ink/55">Total spent: <span className="font-bold text-ink">₹{spent.toLocaleString("en-IN")}</span></span>
          </div>
          <p className="mt-1 text-[11.5px] font-medium leading-snug text-ink/50">
            Tiers are based only on your lifetime spend on Meeticulous — every booking counts.
            You climb automatically as you cross each amount; there's nothing to claim or apply for.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {TIERS.map((t) => {
              const unlocked = spent >= t.spend;
              return (
                <div key={t.name}
                  className={`rounded-xl border-2 p-2.5 ${unlocked ? "border-maroon/25 bg-blush" : "border-neutral-200 bg-white"}`}>
                  <div className="flex items-center gap-1.5">
                    {unlocked ? <Trophy className="h-3.5 w-3.5 text-maroon" strokeWidth={2.2} /> : <Lock className="h-3.5 w-3.5 text-ink/30" strokeWidth={2.2} />}
                    <p className="font-display text-[12.5px] font-extrabold tracking-[-0.02em] text-ink">{t.name}</p>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-maroon">₹{t.spend.toLocaleString("en-IN")}+</p>
                  <p className="mt-0.5 text-[10.5px] font-medium leading-snug text-ink/55">{t.how}</p>
                  <p className="mt-0.5 text-[10.5px] font-medium leading-snug text-ink/50">{t.perks}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rewards grid */}
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-ink/40">Rewards</h2>
        <div className="mb-6 grid gap-2.5 sm:grid-cols-3">
          <LockedCard icon={Gift}    title="Rewards"   desc="Credits and gifts that unlock as you spend." />
          <LockedCard icon={Ticket}  title="Scratch cards" desc="Win surprise rewards after eligible bookings." />
          <LockedCard icon={Percent} title="Promo codes" desc="Exclusive codes from our affiliate partners." />
        </div>

        <div className="rounded-[8px] border-2 border-neutral-200 bg-white p-5 text-center">
          <p className="text-[12px] font-medium leading-snug text-ink/55">
            We're putting the finishing touches on rewards. Keep booking — your spend will count toward your tier the day it goes live.
          </p>
          <Link to="/explore" className="mt-3 inline-block text-[12.5px] font-bold text-maroon hover:underline">Explore creators →</Link>
        </div>
    </>
  );
};

export default Loyalty;
