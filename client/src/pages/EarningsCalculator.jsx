import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Sprout, Sparkles, Rocket, Crown, Minus, Plus, ArrowRight, Info, Check, Zap, Wallet, Lock, Heart, TrendingUp } from "lucide-react";
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL } from "../utils/seo";
import "./earningsCalculator.css";
import {
  resultsFor, pickWinner, annualSaving, deltaVsFree, ANNUAL_FEE, platformFeesPerYear, TOPMATE_FEES,
} from "../lib/earningsCalc";

// /earnings-calculator — public conversion tool. Host sets price + monthly volume;
// sees annual take-home per plan as a bar chart (Starter 5% · Pro 0%),
// the plan that keeps the most, and how much more than free. All numbers come from
// lib/earningsCalc.js + lib/morPricing.js (server mirror) — display only, real
// pricing computed server-side at booking. No invented tiers, no fake figures.

const ROUTE_START = "/become-a-host";
const ICON = { free: Sprout, premium: Rocket };
const CTA_LABEL = { free: "Get Started", premium: "Start on Pro" };

// One-line "who's this for" per plan.
const POSITION = {
  free: "Test the waters, free.",
  premium: "Booking grows, you keep it all.",
};

// Concise, REAL feature highlights — mirrors data/plans.js. Keep in sync if plans change.
const FEATURES = {
  free: ["5% commission per booking", "Unlimited services & bookings", "Booking page + payments", "24-hour reminders", "Email support"],
  premium: ["0% commission (Keep 100% of your earnings)", "Client CRM + history", "Follow-up & rebook automation", "Unlimited digital products", "Priority WhatsApp support"],
};

const PLAN_MASCOTS = { free: ["green"], premium: ["orange", "purple"] };

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
function StepperInput({ n, title, sublabel, value, min, max, step, prefix, presets, onChange }) {
  const num = Number(value) || 0;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const sliderValue = min + Math.round((clamp(num) - min) / step) * step;
  const progress = ((sliderValue - min) / (max - min)) * 100;
  const midpoint = Math.floor((min + max) / (2 * step)) * step;
  const format = (amount) => prefix ? inr0(amount) : amount.toLocaleString("en-IN");
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{n}</span>
        <div>
          <p className="text-sm font-bold text-ink">{title}</p>
          <p className="text-xs text-neutral-500">{sublabel}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-black/10 bg-white px-3 py-2 transition-all duration-150 hover:border-black/20 focus-within:ring-2 focus-within:ring-primary/25">
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
      <div className="earnings-slider mt-3" style={{ "--slider-progress": `${progress}%` }}>
        <input
          type="range" min={min} max={max} step={step}
          value={sliderValue}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${title} slider`}
          aria-valuetext={format(sliderValue)}
        />
        <div className="earnings-slider__visual" aria-hidden="true">
          <div className="earnings-slider__ticks">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="earnings-slider__track" />
          <span className="earnings-slider__thumb" />
        </div>
      </div>
      <div className="grid grid-cols-3 text-[11px] text-neutral-500" aria-hidden="true">
        <span>{format(min)}</span>
        <span className="text-center">{format(midpoint)}</span>
        <span className="text-right">{format(max)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={`${title} presets`}>
        <span className="mr-1 text-[11px] text-neutral-500">Quick set</span>
        {presets.map((preset) => (
          <button key={preset} type="button" aria-pressed={num === preset} onClick={() => onChange(preset)}
            className="rounded-full border border-black/10 px-2.5 py-1 text-xs font-medium text-ink hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary/30 aria-pressed:bg-primary/5 aria-pressed:text-primary">
            {format(preset)}
          </button>
        ))}
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
    <div className="earnings-bars">
      <div className="earnings-bars__plot" style={{ height: BAR_MAX + 40 }}>
        {bars.map((b) => {
          const isWin = b.plan.key === winnerKey;
          const muted = b.capped || b.outgrows;
          const h = Math.max(10, (Math.max(0, b.netAnnual) / maxNet) * BAR_MAX);
          return (
            <div key={b.plan.key} className="earnings-bars__col">
              {isWin && <Crown size={16} className="earnings-bars__crown" aria-label="Keeps the most" />}
              <span className="earnings-bars__value">{inr0(b.netAnnual)}</span>
              <div className={`earnings-bars__bar ${isWin ? "earnings-bars__bar--win" : ""} ${muted ? "earnings-bars__bar--muted" : ""}`}
                style={{ height: h }} />
            </div>
          );
        })}
      </div>
      <div className="earnings-bars__labels">
        {bars.map((b) => (
          <div key={b.plan.key}>
            <p className="earnings-bars__name">{b.plan.name}</p>
            <p className="earnings-bars__fee">{b.plan.key === "free" ? "5% fee" : "0% fee"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanCard({ result, cycle, proAdvantage }) {
  const { plan } = result;
  const Icon = ICON[plan.key] ?? Sparkles;
  const isRec = plan.key === "premium"; // Pro is the recommended plan
  const monthly = plan.monthly;
  const yearly = ANNUAL_FEE[plan.key];
  const priceNote =
    monthly === 0
      ? "Free to start · 5% per booking"
      : `0% commission · ${cycle === "annual" ? `${inr0(yearly)}/yr` : `${inr0(monthly)}/mo`}`;
  return (
    <article className={`earnings-plan ${isRec ? "earnings-plan--pro" : ""}`}>
      {isRec && <span className="mt-badge mt-badge--official earnings-plan__flag">Recommended</span>}

      <div className="earnings-plan__top">
        <div className="min-w-0">
          <div className="earnings-plan__id">
            <span className="earnings-plan__icon"><Icon size={20} /></span>
            <div>
              <h3 className="earnings-plan__name">{plan.name}</h3>
              <p className="earnings-plan__note">{priceNote}</p>
            </div>
          </div>
          <p className="earnings-plan__position">{POSITION[plan.key]}</p>
        </div>
        <div className="earnings-plan__art" aria-hidden="true">
          {PLAN_MASCOTS[plan.key].map((color) => (
            <img key={color} src={`/about/mascot-${color}.png`} alt="" loading="lazy" />
          ))}
        </div>
      </div>

      <div>
        <p className="earnings-plan__amount">{inr0(result.netAnnual)}</p>
        <p className="earnings-plan__amount-label">you keep per year</p>
        {isRec && proAdvantage > 0 && (
          <p className="mt-badge mt-badge--brand earnings-plan__advantage">
            <TrendingUp size={14} aria-hidden="true" /> {inr0(proAdvantage)} more in your pocket vs. Starter
          </p>
        )}
      </div>

      <ul className="earnings-plan__features">
        {FEATURES[plan.key].map((f) => (
          <li key={f}><Check size={16} aria-hidden="true" /> {f}</li>
        ))}
      </ul>

      {result.capped && (
        <p className="earnings-plan__warn">This plan caps at {inr0(plan.maxServicePrice)} per session.</p>
      )}
      {result.outgrows && (
        <p className="earnings-plan__warn">
          Caps at {result.bookingCap.toLocaleString("en-IN")} bookings/year — {result.uncollectedBookings.toLocaleString("en-IN")} you couldn&rsquo;t take.
        </p>
      )}

      <Link to={ROUTE_START} className={`mt-btn mt-btn--block ${isRec ? "" : "mt-btn--secondary"}`}>
        {CTA_LABEL[plan.key]} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}

const REASSURE = [
  { icon: Zap, title: "Free to start", body: "Test the waters at zero cost." },
  { icon: Wallet, title: "Real payouts", body: "Monthly, not a sales number." },
  { icon: Lock, title: "Cancel anytime", body: "No lock-in." },
  { icon: Heart, title: "Same take-home", body: "Whether or not you're GST-registered." },
];

// Module-level (stable identity) so it doesn't remount on every parent render.
function CycleToggle({ cycle, setCycle, onBrand }) {
  return (
    <div className={`earnings-cycle ${onBrand ? "earnings-cycle--onbrand" : ""}`}>
      <button type="button" onClick={() => setCycle("annual")} aria-pressed={cycle === "annual"}>Yearly</button>
      <button type="button" onClick={() => setCycle("monthly")} aria-pressed={cycle === "monthly"}>Monthly</button>
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
  const lowestFee = Math.min(...platformFees.map((r) => r.fee));
  const animatedNet = useCountUp(winner.netAnnual);
  const canonical = `${SITE_URL}/earnings-calculator`;

  return (
    <div className="min-h-screen bg-cream">
      <Seo
        title="Earnings Calculator — see what you keep | Meeticulous"
        description="Meeticulous earnings calculator: set your price and monthly bookings to see exactly what you keep — and whether Starter or Pro leaves you the most."
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
            <div className="rounded-2xl bg-white p-6 sm:p-8">
              <StepperInput n={1} title="Set your price per session" sublabel="How much do you charge for each session?"
                prefix="₹" value={earning} min={500} max={50000} step={500} presets={[1500, 5000, 15000, 30000]}
                onChange={(v) => setEarning(v)} />
              <div className="mt-7">
                <StepperInput n={2} title="Set your sessions per month" sublabel="How many sessions do you conduct?"
                  value={bookings} min={1} max={50} step={1} presets={[5, 12, 25, 40]}
                  onChange={(v) => setBookings(v)} />
              </div>
            </div>

            {/* Estimated earnings + bar chart */}
            <section className="earnings-result" aria-live="polite">
              {/* ee thread — one per layout, bleeding off an edge, behind content (BRAND_RULES). */}
              <img src="/brand/ds/02-ee/mt-ee-thread-white.svg" alt="" aria-hidden="true" className="earnings-result__thread" />
              <div className="earnings-result__head">
                <span className="mt-overline">Your estimated earnings</span>
                <CycleToggle cycle={cycle} setCycle={setCycle} onBrand />
              </div>
              <p className="earnings-result__lead">With {winner.plan.name}, you keep</p>
              <p className="earnings-result__amount">{inr0(animatedNet)}</p>
              <p className="earnings-result__per">per year</p>
              {!winnerIsFree && delta > 0 ? (
                <span className="earnings-result__delta">
                  <TrendingUp size={14} aria-hidden="true" /> {inr0(delta)} more than the free plan
                </span>
              ) : (
                <span className="earnings-result__delta earnings-result__delta--quiet">
                  Free plan keeps the most at your volume
                </span>
              )}
              <EarningsBars results={results} winnerKey={winnerKey} />
            </section>
          </div>

          {/* PLANS */}
          <div className="mt-14">
            <p className="mt-overline text-maroon">Choose a plan</p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon sm:text-[2.5rem]">
                Plans that grow <span className="font-serif text-[1.08em] font-normal italic tracking-normal">with you</span>
              </h2>
              <div className="inline-flex items-center gap-3">
                {maxSaving > 0 && (
                  <span className={`mt-badge mt-badge--brand ${cycle === "annual" ? "" : "invisible"}`}>
                    Save up to {inr0(maxSaving)}
                  </span>
                )}
                <CycleToggle cycle={cycle} setCycle={setCycle} />
              </div>
            </div>

            <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-6">
              {["free", "premium"].map((k) => (
                <PlanCard key={k} result={results.find((r) => r.plan.key === k)} proAdvantage={delta} cycle={cycle} />
              ))}
            </div>

            <p className="earnings-fineprint mt-5 text-center">
              Your guest pays <strong>{inr2(winner.guestPays)}</strong> at a {inr0(earning)} price — your price plus a flat ₹10 booking fee. You never eat it; your take-home is your price minus taxes.
            </p>
          </div>

          {/* VS TOPMATE — platform fees only; gateway charges apply everywhere */}
          <div className="mt-20">
            <p className="mt-overline text-maroon">Compare platforms</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon sm:text-[2.5rem]">
              Platform fees per year vs Topmate
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-600">
              At {inr0(earning)} a session and {bookings} sessions a month, this is what each option takes in platform fees over a year.
            </p>
            <div className="earnings-compare">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Option</th>
                    <th scope="col" className="earnings-compare__how">How it charges</th>
                    <th scope="col" className="earnings-compare__fee">Fees per year</th>
                  </tr>
                </thead>
                <tbody>
                  {platformFees.map((r) => {
                    const lowest = r.fee === lowestFee;
                    return (
                      <tr key={r.key} className={lowest ? "is-lowest" : undefined}>
                        <th scope="row">
                          <span className="earnings-compare__name">{r.name}</span>
                          {lowest && <span className="mt-badge mt-badge--official mt-badge--s">Lowest</span>}
                          <span className="earnings-compare__note">{r.note}</span>
                        </th>
                        <td className="earnings-compare__how">{r.note}</td>
                        <td className="earnings-compare__fee">{inr0(r.fee)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="earnings-fineprint mt-4">
              Topmate fees as published on <a href={TOPMATE_FEES.source} target="_blank" rel="noopener noreferrer">topmate.io</a> ({TOPMATE_FEES.checked}). Payment gateway charges apply on every platform and are left out of all rows. See the full{" "}
              <Link to="/compare/topmate-alternative">Topmate comparison</Link>.
            </p>
          </div>

          {/* REASSURANCE */}
          <ul className="earnings-reassure">
            {REASSURE.map(({ icon: I, title, body }) => (
              <li key={title}>
                <span className="earnings-reassure__icon"><I size={20} aria-hidden="true" /></span>
                <p className="earnings-reassure__title">{title}</p>
                <p className="earnings-reassure__body">{body}</p>
              </li>
            ))}
          </ul>

          {/* FOOTNOTE */}
          <div className="earnings-fineprint mt-6 flex gap-2.5">
            <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p>
              An illustration, not a quote. Figures assume 18% GST (most categories; some differ) and your exact price is confirmed when you list a service. See the{" "}
              <Link to="/host-fees">Host Fee &amp; Payment Schedule</Link> for the full breakdown.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky CTA on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 backdrop-blur sm:hidden">
        <Link to={ROUTE_START} className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">
          Start on {winner.plan.name} <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
