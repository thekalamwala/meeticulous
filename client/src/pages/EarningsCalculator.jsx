import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Sprout, Sparkles, Rocket, Crown, Minus, Plus, ArrowRight, Info, Check, Zap, Wallet, Lock, Heart } from "lucide-react";
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL } from "../utils/seo";
import {
  resultsFor, pickWinner, annualSaving, deltaVsFree, ANNUAL_FEE, platformFeesPerYear, TOPMATE_FEES,
} from "../lib/earningsCalc";

// /earnings-calculator — public conversion tool. Host sets price + monthly volume;
// sees annual take-home per plan as a bar chart (Sloth 5% · Sloth Active 0%),
// the plan that keeps the most, and how much more than free. All numbers come from
// lib/earningsCalc.js + lib/morPricing.js (server mirror) — display only, real
// pricing computed server-side at booking. No invented tiers, no fake figures.

const ROUTE_START = "/become-a-host";
const ICON = { free: Sprout, premium: Rocket };
const ACCENT = { free: "#4AB765", premium: "#2E1065" };
const CTA_LABEL = { free: "Get Started", premium: "Start on Sloth Active" };

// One-line "who's this for" per plan.
const POSITION = {
  free: "Test the waters, free.",
  premium: "Booking grows, you keep it all.",
};

// Concise, REAL feature highlights — mirrors data/plans.js. Keep in sync if plans change.
const FEATURES = {
  free: ["5% commission per booking", "Unlimited services & bookings", "Booking page + payments", "24-hour reminders", "Email support"],
  premium: ["0% commission", "Client CRM + history", "Follow-up & rebook automation", "Unlimited digital products", "Priority WhatsApp support"],
};

const inr0 = (n) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
const inr2 = (n) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);

// ponytail: hand-rolled count-up (rAF, ~500ms). Snaps to final when reduced-motion
// is set OR matchMedia is unavailable (jsdom in tests). No animation lib.
function useCountUp(value, ms = 500) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const reduce =
      typeof window === "undefined" || !window.matchMedia
        ? true
        : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return display;
}

// Numbered input: value + −/+ steppers + a slider, with min/max rails.
function StepperInput({ n, title, sublabel, value, min, max, step, prefix, onChange }) {
  const num = Number(value) || 0;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{n}</span>
        <div>
          <p className="text-sm font-bold text-ink">{title}</p>
          <p className="text-xs text-neutral-500">{sublabel}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3 py-2 transition-all duration-150 hover:border-black/20 focus-within:ring-2 focus-within:ring-primary/25">
        {prefix && <span className="text-neutral-400">{prefix}</span>}
        <input
          type="number" inputMode="numeric" min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : clamp(Number(e.target.value)))}
          className="w-full border-0 bg-transparent p-0 text-lg font-bold text-ink outline-none focus:shadow-none focus:outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={title}
        />
        <button type="button" onClick={() => onChange(clamp(num - step))} aria-label={`Decrease ${title}`}
          className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200">
          <Minus size={14} />
        </button>
        <button type="button" onClick={() => onChange(clamp(num + step))} aria-label={`Increase ${title}`}
          className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200">
          <Plus size={14} />
        </button>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={Math.min(Math.max(num, min), max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-primary" aria-label={`${title} slider`}
      />
      <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
        <span>{prefix}{min.toLocaleString("en-IN")}</span>
        <span>{prefix}{max.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
}

// Honest bar chart — heights are true (0-based) net-annual take-home; the winner
// is coloured + crowned, others muted. No truncated axis, no exaggeration.
function EarningsBars({ results, winnerKey }) {
  const order = ["free", "premium"];
  const bars = order.map((k) => results.find((r) => r.plan.key === k)).filter(Boolean);
  const maxNet = Math.max(...bars.map((b) => b.netAnnual), 1);
  const BAR_MAX = 132;
  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-3" style={{ height: BAR_MAX + 34 }}>
        {bars.map((b) => {
          const isWin = b.plan.key === winnerKey;
          const muted = b.capped || b.outgrows;
          const h = Math.max(10, (Math.max(0, b.netAnnual) / maxNet) * BAR_MAX);
          return (
            <div key={b.plan.key} className="flex flex-1 flex-col items-center justify-end">
              {isWin && <Crown size={16} className="mb-0.5" style={{ color: ACCENT.premium }} fill={ACCENT.premium} />}
              <span className="mb-1 text-[11px] font-bold text-ink">{inr0(b.netAnnual)}</span>
              <div className="w-full max-w-[58px] rounded-t-lg transition-all duration-300"
                style={{ height: h, background: isWin ? ACCENT.premium : "#d9d5cc", opacity: muted ? 0.5 : 1 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-3">
        {bars.map((b) => (
          <div key={b.plan.key} className="flex-1 text-center">
            <p className="text-xs font-semibold text-ink">{b.plan.name}</p>
            <p className="text-[10px] text-neutral-500">{b.plan.key === "free" ? "5% fee" : "0% fee"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanCard({ result, winnerKey, cycle }) {
  const { plan } = result;
  const Icon = ICON[plan.key] ?? Sparkles;
  const accent = ACCENT[plan.key];
  const isRec = plan.key === "premium"; // Sloth Active is the recommended plan
  const monthly = plan.monthly;
  const yearly = ANNUAL_FEE[plan.key];
  const priceNote =
    monthly === 0
      ? "Free to start · 5% per booking"
      : `0% commission · ${cycle === "annual" ? `${inr0(yearly)}/yr` : `${inr0(monthly)}/mo`}`;
  return (
    <div className={`relative flex flex-col rounded-[14px] border bg-white p-5 sm:p-6 ${isRec ? "border-2 shadow-[0_12px_40px_rgba(254,81,0,0.12)]" : "border-black/10"}`}
      style={isRec ? { borderColor: accent, background: "#EFF6FB" } : undefined}>
      {isRec && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-white" style={{ background: accent }}>
          <Crown size={12} fill="#fff" /> Recommended
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ color: accent, background: `${accent}14` }}>
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-base font-bold text-ink">{plan.name}</p>
          <p className="text-[11px] text-neutral-500">{priceNote}</p>
        </div>
      </div>

      <p className="mt-4 text-sm font-bold text-ink">{POSITION[plan.key]}</p>
      <div className="mt-2">
        <p className="text-2xl font-extrabold" style={{ color: isRec ? accent : "#191919" }}>{inr0(result.netAnnual)}</p>
        <p className="text-xs text-neutral-500">you keep per year</p>
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {FEATURES[plan.key].map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-neutral-700">
            <Check size={15} className="mt-0.5 flex-shrink-0" style={{ color: accent }} /> {f}
          </li>
        ))}
      </ul>

      {result.capped && (
        <p className="mt-3 rounded-[8px] bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
          This plan caps at {inr0(plan.maxServicePrice)} per session.
        </p>
      )}
      {result.outgrows && (
        <p className="mt-3 rounded-[8px] bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
          Caps at {result.bookingCap.toLocaleString("en-IN")} bookings/year — {result.uncollectedBookings.toLocaleString("en-IN")} you couldn&rsquo;t take.
        </p>
      )}

      <Link to={ROUTE_START}
        className={`mt-5 inline-flex items-center justify-center gap-1.5 rounded-[10px] px-5 py-3 text-sm font-semibold transition ${isRec ? "text-white hover:opacity-95" : "border border-black/15 text-ink hover:border-black/30"}`}
        style={isRec ? { background: accent } : undefined}>
        {CTA_LABEL[plan.key]} <ArrowRight size={16} />
      </Link>
    </div>
  );
}

const REASSURE = [
  { icon: Zap, title: "Free to start", body: "Test the waters at zero cost." },
  { icon: Wallet, title: "Real payouts", body: "Monthly, not a sales number." },
  { icon: Lock, title: "Cancel anytime", body: "No lock-in." },
  { icon: Heart, title: "Same take-home", body: "Whether or not you're GST-registered." },
];

// Module-level (stable identity) so it doesn't remount on every parent render.
function CycleToggle({ cycle, setCycle, small }) {
  return (
    <div className={`inline-flex rounded-full bg-neutral-100 p-0.5 ${small ? "text-[11px]" : "text-xs"}`}>
      <button type="button" onClick={() => setCycle("annual")} aria-pressed={cycle === "annual"}
        className={`rounded-full px-3 py-1 font-semibold transition ${cycle === "annual" ? "bg-white text-ink shadow-sm" : "text-neutral-500"}`}>Yearly</button>
      <button type="button" onClick={() => setCycle("monthly")} aria-pressed={cycle === "monthly"}
        className={`rounded-full px-3 py-1 font-semibold transition ${cycle === "monthly" ? "bg-white text-ink shadow-sm" : "text-neutral-500"}`}>Monthly</button>
    </div>
  );
}

export default function EarningsCalculator() {
  const [earning, setEarning] = useState(5000);
  const [bookings, setBookings] = useState(12);
  const [cycle, setCycle] = useState("annual"); // annual | monthly

  const results = useMemo(() => resultsFor(earning, bookings, cycle), [earning, bookings, cycle]);
  const winnerKey = useMemo(() => pickWinner(results), [results]);
  const winner = results.find((r) => r.plan.key === winnerKey);

  const winnerIsFree = winnerKey === "free";
  const delta = deltaVsFree(results, winnerKey);
  const maxSaving = annualSaving("premium");

  const platformFees = useMemo(() => platformFeesPerYear(earning, bookings), [earning, bookings]);
  const animatedNet = useCountUp(winner.netAnnual);
  const canonical = `${SITE_URL}/earnings-calculator`;

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC" }}>
      <Seo
        title="Earnings Calculator — see what you keep | Meeticulous"
        description="Meeticulous earnings calculator: set your price and monthly bookings to see exactly what you keep — and whether Sloth or Sloth Active leaves you the most."
        canonical={canonical}
        image={ogCard("earnings-calculator", "png")}
      />
      <div className="app-container py-10 sm:py-14">
        <div className="mx-auto max-w-5xl pb-24 sm:pb-0">

          {/* HERO */}
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">For people who get paid for their time</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-ink sm:text-5xl">
            Your time. Your rules.<br /><span className="text-primary">More money</span> in your pocket.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-600 sm:text-base">
            Set your price and how often you book. We&rsquo;ll show you what you&rsquo;ll keep with each plan — so you can choose what works best for you.
          </p>

          {/* CALCULATOR + EARNINGS */}
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {/* Inputs */}
            <div className="rounded-[16px] border border-black/5 bg-white p-6 sm:p-7">
              <StepperInput n={1} title="Set your price per session" sublabel="How much do you charge for each session?"
                prefix="₹" value={earning} min={500} max={50000} step={500}
                onChange={(v) => setEarning(v)} />
              <div className="mt-7">
                <StepperInput n={2} title="Set your sessions per month" sublabel="How many sessions do you conduct?"
                  value={bookings} min={1} max={50} step={1}
                  onChange={(v) => setBookings(v)} />
              </div>
            </div>

            {/* Estimated earnings + bar chart */}
            <div className="rounded-[16px] border p-6 sm:p-7" style={{ borderColor: "rgba(254,81,0,0.18)", background: "linear-gradient(180deg,#fff6f1,#ffffff)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your estimated earnings</span>
                <CycleToggle cycle={cycle} setCycle={setCycle} small />
              </div>
              <p className="mt-3 text-lg font-bold text-ink">With {winner.plan.name}, you keep</p>
              <p className="text-4xl font-extrabold leading-none text-primary sm:text-[2.7rem]">
                {inr0(animatedNet)}
              </p>
              <p className="mt-1 text-sm text-neutral-500">per year</p>
              {!winnerIsFree && delta > 0 ? (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#e9f6ee] px-3 py-1.5 text-xs font-semibold text-[#1f7a3d]">
                  🚀 {inr0(delta)} more than the free plan
                </span>
              ) : (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">
                  Free plan keeps the most at your volume
                </span>
              )}
              <EarningsBars results={results} winnerKey={winnerKey} />
            </div>
          </div>

          {/* PLANS */}
          <div className="mt-14">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Choose a plan</p>
            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">Plans that grow with you</h2>
              <div className="inline-flex items-center gap-2">
                <CycleToggle cycle={cycle} setCycle={setCycle} />
                {maxSaving > 0 && cycle === "annual" && (
                  <span className="text-[11px] font-semibold text-[#1f7a3d]">Save up to {inr0(maxSaving)}</span>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {["free", "premium"].map((k) => (
                <PlanCard key={k} result={results.find((r) => r.plan.key === k)} winnerKey={winnerKey} cycle={cycle} />
              ))}
            </div>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-500">
              Your guest pays <strong>{inr2(winner.guestPays)}</strong> at a {inr0(earning)} price — your price plus a flat ₹10 booking fee. You never eat it; your take-home is your price minus taxes.
            </p>
          </div>

          {/* VS TOPMATE — platform fees only; gateway charges apply everywhere */}
          <div className="mt-14">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Compare platforms</p>
            <h2 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">Platform fees per year vs Topmate</h2>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              At {inr0(earning)} a session and {bookings} sessions a month, this is what each option takes in platform fees over a year.
            </p>
            <div className="mt-5 overflow-x-auto rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAFC] text-xs uppercase tracking-wide text-neutral-500">
                  <tr><th className="px-4 py-3">Option</th><th className="px-4 py-3">How it charges</th><th className="px-4 py-3 text-right">Fees per year</th></tr>
                </thead>
                <tbody>
                  {platformFees.map((r) => (
                    <tr key={r.key} className="border-t border-black/5">
                      <td className="px-4 py-3 font-semibold text-ink">{r.name}</td>
                      <td className="px-4 py-3 text-neutral-600">{r.note}</td>
                      <td className="px-4 py-3 text-right font-heading font-bold tabular-nums text-ink">{inr0(r.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
              Topmate fees as published on <a href={TOPMATE_FEES.source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">topmate.io</a> ({TOPMATE_FEES.checked}). Payment gateway charges apply on every platform and are left out of all rows. See the full{" "}
              <Link to="/compare/topmate-alternative" className="text-primary hover:underline">Topmate comparison</Link>.
            </p>
          </div>

          {/* REASSURANCE */}
          <div className="mt-12 grid gap-4 rounded-[14px] border border-black/5 bg-white/60 p-5 sm:grid-cols-4">
            {REASSURE.map(({ icon: I, title, body }) => (
              <div key={title} className="flex items-start gap-2.5">
                <I size={18} className="mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-bold text-ink">{title}</p>
                  <p className="text-xs text-neutral-500">{body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* FOOTNOTE */}
          <div className="mt-5 flex gap-2.5 text-[11px] leading-relaxed text-neutral-500">
            <Info size={13} className="mt-0.5 flex-shrink-0" />
            <p>
              An illustration, not a quote. Figures assume 18% GST (most categories; some differ) and your exact price is confirmed when you list a service. See the{" "}
              <Link to="/host-fees" className="text-primary hover:underline">Host Fee &amp; Payment Schedule</Link> for the full breakdown.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky CTA on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 backdrop-blur sm:hidden">
        <Link to={ROUTE_START} className="flex items-center justify-center gap-1.5 rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-white">
          Start on {winner.plan.name} <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
