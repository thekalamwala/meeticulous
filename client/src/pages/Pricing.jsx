import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Info,
  Sprout,
  Rocket,
  ArrowRight,
  Zap,
  Users,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import Seo from "../components/common/Seo";
import Tooltip from "../components/common/Tooltip";
import { ogCard } from "../config/ogImages";
import { SITE_URL } from "../utils/seo";
import {
  PLAN_COLUMNS,
  PLAN_MATRIX,
  PREMIUM_PER_DAY,
  PREMIUM_ANNUAL_SAVE_PCT,
  PREMIUM_YEARLY_PER_MONTH,
  PREMIUM_PLAN,
  FREE_PLAN,
  PREMIUM_PLAN_USD,
  PREMIUM_USD_ANNUAL_SAVE_PCT,
} from "../data/plans";
import PricingCards from "../components/pricing/PricingCards";
import useFeeOnly from "../hooks/useFeeOnly";
import { getPricingRegion } from "../lib/pricingRegion";

// Outside India: swap the matrix's two ₹ price rows for USD (everything else in
// the matrix is currency-free).
const USD_PRICE_ROWS = {
  "Monthly price": { free: "$0", premium: `$${PREMIUM_PLAN_USD.monthly}` },
  "Yearly price": { free: "$0", premium: `$${PREMIUM_PLAN_USD.yearly}` },
};
const PLAN_MATRIX_USD = PLAN_MATRIX.map((s) => ({
  ...s,
  rows: s.rows.map((r) => (USD_PRICE_ROWS[r.label] ? { ...r, ...USD_PRICE_ROWS[r.label] } : r)),
}));
import { analytics, EVENTS } from "../services/analytics";
import useUtm from "../hooks/useUtm";

// /pricing — dedicated public pricing page. A product journey, not a spec sheet:
//   Starter = Operate (free) → Pro = Grow (premium).
// The plan cards, prices and the full feature comparison are single-sourced from
// client/src/data/plans.js (mirrors DB migration v3.165), so the table here, the
// homepage cards and the enforced server limits never drift apart. Only features
// the server actually enforces are shown (honesty rule — see plans.js).
//
// 2026-11 structural redesign: soft-modern aesthetic to match About/Careers.
// Hero on a tinted band → framed plan cards → a single 4-step growth timeline
// (was 3 separate bands) → "What Pro does" + the pay-for-itself calculator side
// by side → feature comparison → crimson closing CTA.

const ROUTE_START = "/become-a-host";

// Green (Starter / operate) vs crimson (Pro / grow) — the two plan accents from
// plans.js, kept as locals so the storytelling reads the same hues as the cards.
const OPERATE = FREE_PLAN.accent; // #4AB765
const GROW = PREMIUM_PLAN.accent; // #960D32

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Meeticulous",
  description:
    "Zero-commission appointment booking for Indian creators — publish services, get booked via OTP or login, collect payments through Razorpay.",
  brand: { "@type": "Brand", name: "Meeticulous" },
  // Prices are GST-INCLUSIVE, matching what the cards show and what Razorpay
  // actually charges. These are indexed into rich results, so a stale number
  // here survives in Google for weeks after the page itself is corrected.
  offers: [
    { "@type": "Offer", name: "Starter", price: "0", priceCurrency: "INR", availability: "https://schema.org/InStock" },
    { "@type": "Offer", name: "Pro (monthly)", price: "235", priceCurrency: "INR", availability: "https://schema.org/InStock" },
    { "@type": "Offer", name: "Pro (yearly)", price: "1179", priceCurrency: "INR", availability: "https://schema.org/InStock" },
  ],
  // No aggregateRating: Google penalises self-serving ratings that aren't
  // backed by real, verifiable reviews. Re-add (with an on-page badge) only
  // when sourced from actual review data — see enterpriseSeo.js for the pattern.
};

// One comparison cell: ✓ for true, — for false, verbatim text for a string, and a
// "Limited" chip + tooltip for a limited(tip) object (so a small free number is
// never printed bare — the exact figure lives in the tooltip).
const Cell = ({ value }) => {
  if (value === true) return <Check size={18} className="mx-auto text-primary" aria-label="Included" />;
  if (value === false) return <span className="text-neutral-300" aria-label="Not included">—</span>;
  if (value && typeof value === "object" && value.tip) {
    return (
      <Tooltip content={value.tip}>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {value.v || "Limited"}
          <Info size={12} aria-hidden="true" />
        </span>
      </Tooltip>
    );
  }
  return <span className="text-sm text-neutral-700">{value}</span>;
};

export default function Pricing() {
  // Interim (fee-only) mode: hide the free Starter column + soften commission/earn
  // copy, and drop the free-vs-paid storytelling (it only makes sense once the
  // free plan is advertised). Reverts automatically when the DB flag flips on
  // Route go-live.
  const feeOnly = useFeeOnly();
  const columns = feeOnly ? PLAN_COLUMNS.filter((c) => c.key !== "free") : PLAN_COLUMNS;
  // USD visitors: USD prices, and no ₹ growth/calculator band (its maths is ₹
  // bookings revenue vs the GST-inclusive INR price).
  const [intl] = useState(() => getPricingRegion() === "INTL");

  // plan_viewed — the pricing-visitor retargeting audience (Meta/GA4). Fire once
  // on mount, carrying first-touch ad attribution so the audience ties back to the
  // Reel/campaign that sent them here.
  const utm = useUtm();
  useEffect(() => { analytics.track(EVENTS.PLAN_VIEWED, { ...utm }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="bg-canvas">
      <Seo
        title={feeOnly ? "Pricing — Meeticulous | Pro for creators & professionals" : "Pricing — Meeticulous | Start free. Go Pro as you grow."}
        description={feeOnly ? "Simple, honest pricing for your booking page — scheduling, reminders and automation. Pro is ₹1,179 a year, GST included." : "Two plans, that's it. Starter is free forever — put your business online and start taking bookings. Pro turns those bookings into a business system. All prices include GST."}
        image={ogCard('pricing')}
        canonical={`${SITE_URL}/pricing`}
        jsonLd={JSON_LD}
      />

      {/* ── Hero (cream ground) + plan cards overlapping it ───────────── */}
      <section className="relative overflow-hidden px-5 pb-10 pt-16 sm:px-8 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Pricing</p>
          <h1 className="mt-3 font-display font-extrabold leading-[1.08] text-maroon text-[clamp(2.4rem,5vw,3.75rem)]">
            Simple pricing that grows{" "}
            <span className="text-rose">with your {feeOnly ? "practice" : "business"}.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[640px] text-lg leading-relaxed text-ink/70">
            {feeOnly
              ? "Pick the plan that fits your booking page. Upgrade anytime."
              : `Start for free. Stay free for as long as you need. When bookings pile up, Pro gives you the tools to run what happens next — for under ${intl ? "$5 a month" : `${PREMIUM_PER_DAY} a day`}.`}
          </p>
          {!feeOnly && <OperateGrowPills />}
        </div>

        {/* Plan cards — framed on a soft panel so they lift off the hero band */}
        <div className="mx-auto mt-12 max-w-[1050px]">
          <PricingCards />
          <p className="mt-6 text-center text-xs text-neutral-400">
            {intl
              ? `Prices in USD · Yearly saves ${PREMIUM_USD_ANNUAL_SAVE_PCT}% · Cancel anytime`
              : feeOnly
              ? "All prices include GST · Cancel anytime"
              : `All prices include GST · Yearly saves ${PREMIUM_ANNUAL_SAVE_PCT}% · ~2.4% payment gateway fee applies (not our charge) · Cancel anytime`}
          </p>
        </div>
      </section>

      {/* ── Growth journey (two-plan world only) ─────────────────────── */}
      {!feeOnly && !intl && (
        <>
          <GrowthTimeline />
          <ProValueAndCalculator />
        </>
      )}

      {/* ── Full feature comparison ──────────────────────────────────── */}
      <section className="bg-canvas px-5 pb-20 pt-16 sm:px-8 lg:pt-24">
        <div className="mx-auto max-w-[1050px]">
          <h2 className="text-center font-display text-4xl font-extrabold text-maroon sm:text-5xl">
            Everything <span className="text-rose">you get</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[620px] text-center text-lg leading-relaxed text-ink/70">
            Everything Starter gives you free, and everything you unlock with Pro.
            Tap any <span className="font-semibold text-primary">Limited</span> tag for the detail.
          </p>

          <div className="mt-10 overflow-x-auto rounded-[16px] border-2 border-neutral-200 bg-white p-1 sm:p-2">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-black/10">
                  <th className="py-3 pl-3 pr-4 text-sm font-semibold text-neutral-500">Feature</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-3 py-3 text-center">
                      <span className={`font-heading text-base font-bold ${c.recommended ? "text-primary" : "text-ink"}`}>{c.name}</span>
                      {c.recommended && (
                        <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-wide text-primary">★</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(intl ? PLAN_MATRIX_USD : PLAN_MATRIX).map((section) => (
                  <FragmentSection key={section.group} section={section} columns={columns} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Teams / agencies — no self-serve tier, one line to sales */}
          <p className="mt-10 text-center text-sm text-neutral-500">
            Teams, agencies or multi-location practices?{" "}
            <Link to="/enterprise" className="font-semibold text-primary">Talk to sales →</Link>
          </p>
        </div>
      </section>

      {/* ── Closing CTA (design-system maroon band) ───────────────────────────────── */}
      <section className="px-5 pb-24 pt-16 sm:px-8 lg:pt-20">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[24px] bg-maroon px-8 py-14 text-center text-white sm:px-12">
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            {feeOnly ? "Ready when you are." : "Start slow. Grow when it counts."}
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-lg text-blush">
            Put your business online for free in minutes. Become Pro in one click the day your bookings need it.
          </p>
          <Link
            to={ROUTE_START}
            className="mt-btn mt-btn--onbrand mt-8"
          >
            Get your booking link <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Storytelling (two-plan world only). All copy maps to real, enforced gates
 * from plans.js — no invented features, no fake booking thresholds.
 * ──────────────────────────────────────────────────────────────────────────── */

// Two pills under the hero that name the whole idea in three words each.
function OperateGrowPills() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
      <span
        className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
        style={{ color: OPERATE, borderColor: `${OPERATE}55`, background: `${OPERATE}12` }}
      >
        <Sprout size={16} strokeWidth={2} /> Starter · Operate
      </span>
      <ArrowRight size={18} className="text-ink/30" aria-hidden="true" />
      <span
        className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
        style={{ color: GROW, borderColor: `${GROW}55`, background: `${GROW}12` }}
      >
        <Rocket size={16} strokeWidth={2} /> Pro · Grow
      </span>
    </div>
  );
}

// The four growth stages as one horizontal, connected timeline — replaces the
// old Operate-vs-Grow panels, the "Your business is growing" band and the stage
// grid. No fake numbers: the only figure named (₹4,700/mo) is the real breakeven
// (5% commission = the effective ₹235/mo Pro price — see plans.js + the calc).
const STAGES = [
  {
    tag: "Starting out",
    lead: "0 → your first bookings",
    body: "Starter is enough. Get your booking page online and start accepting appointments — nothing to pay until you do.",
    accent: OPERATE,
    plan: "Starter",
    icon: Sprout,
  },
  {
    tag: "Getting busy",
    lead: "Bookings coming in regularly",
    body: "Automation starts saving you time. 1-hour reminders, reschedule alerts and follow-ups keep customers showing up.",
    accent: "#C43A59",
    plan: "Pro",
    icon: Zap,
  },
  {
    tag: "Growing",
    lead: "More customers. More to manage.",
    body: "You need visibility. A full client CRM with notes and history, plus rebook automation to bring people back.",
    accent: "#E0506F",
    plan: "Pro",
    icon: Users,
  },
  {
    tag: "Running the business",
    lead: "Bookings are your engine",
    body: "Earning over ₹4,700 a month? At 0% commission, Pro already costs you less than the 5% — and you keep it all.",
    accent: GROW,
    plan: "Pro",
    icon: Rocket,
  },
];

function GrowthTimeline() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-display text-4xl font-extrabold text-maroon sm:text-5xl">
          How Meeticulous <span className="text-rose">grows with you</span>
        </h2>
        <p className="mx-auto mt-4 max-w-[620px] text-center text-lg leading-relaxed text-ink/70">
          Start free on Starter. Move up to Pro only when the last stage starts to feel busy — there's no rush.
        </p>

        <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* connecting line across the top row (lg only) */}
          <span aria-hidden className="pointer-events-none absolute left-0 right-0 top-6 hidden border-t border-dashed border-ink/15 lg:block" />
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.tag} className="relative flex flex-col">
                <span
                  className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-white"
                  style={{ background: s.accent }}
                >
                  <Icon size={20} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="mt-5 text-xs font-bold uppercase tracking-wide" style={{ color: s.accent }}>
                  Step {i + 1} · {s.plan}
                </span>
                <h3 className="mt-1 font-heading text-lg font-extrabold text-ink">{s.tag}</h3>
                <p className="mt-0.5 text-xs font-semibold text-ink/50">{s.lead}</p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// Value as outcomes, not a feature count. Each maps to a real premium gate:
// automation (reminder_flows/followup_flows), CRM (crm limit), earnings/commission
// history, growth (rebook automation + AI writing).
const VALUES = [
  {
    icon: Zap,
    title: "Less manual work",
    body: "Automate repetitive reminders, reschedule alerts and follow-ups so you're not chasing every appointment by hand.",
    accent: GROW,
  },
  {
    icon: Users,
    title: "Know your customers",
    body: "A full client CRM — records, notes and history for everyone you've served, not just your last ten.",
    accent: "#E0506F",
  },
  {
    icon: BarChart3,
    title: "Understand your business",
    body: "See your earnings, transaction history and exactly what commission you've paid — the numbers behind your bookings.",
    accent: "#960D32",
  },
  {
    icon: TrendingUp,
    title: "Grow intentionally",
    body: "Rebook automation and unlimited AI service writing to bring customers back and keep your page selling.",
    accent: OPERATE,
  },
];

// "What Pro does" (left, value list) + the pay-for-itself calculator (right),
// side by side on large screens — was two stacked full-width sections.
function ProValueAndCalculator() {
  return (
    <section className="bg-sand/60 px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — what Pro does */}
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight text-maroon sm:text-5xl">
            What <span className="text-rose">Pro</span> actually does
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink/70">
            It's not "25 more features." It's four things that matter as you grow.
          </p>
          <ul className="mt-8 space-y-5">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <li key={v.title} className="flex items-start gap-4">
                  <span
                    className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]"
                    style={{ color: v.accent, background: `${v.accent}14` }}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="font-heading text-lg font-extrabold text-ink">{v.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">{v.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right — the calculator */}
        <div className="lg:sticky lg:top-24">
          <PayForItself />
        </div>
      </div>
    </section>
  );
}

// "Does Pro pay for itself?" — an honest calculator, not decoration. It uses
// only real pricing logic: Starter's 5% commission vs Pro's flat effective
// ₹300/mo (yearly billing) at 0% commission. Breakeven is ₹4,700/mo of paid
// bookings (0.05 × 6,000 = 300), matching the plans.js persona blurb.
const COMMISSION_PCT = 5; // FREE_PLAN commission — mirrors subscription_plans
const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function PayForItself() {
  const [earn, setEarn] = useState(8000);
  const commission = (earn * COMMISSION_PCT) / 100; // what Starter's 5% costs this month
  const activeCost = PREMIUM_YEARLY_PER_MONTH; // flat ₹300/mo effective (yearly)
  const activeWins = commission >= activeCost;
  const saved = Math.max(0, commission - activeCost);

  let verdict;
  if (earn < 6000) {
    verdict = "You're just starting out. Starter is free and the 5% only applies when you actually get paid — stay on Starter for now.";
  } else if (earn < 15000) {
    verdict = "You're getting busy. Pro's flat price already costs less than the 5% here — and you keep every rupee, plus automation and CRM.";
  } else {
    verdict = "You're running a real business. Pro pays for itself several times over, and the automation and CRM keep the volume manageable.";
  }

  return (
    <div className="rounded-[24px] border-2 border-neutral-200 bg-white p-6 sm:p-8">
      <h3 className="font-heading text-2xl font-extrabold text-ink">Does <span className="text-primary-cta">Pro</span> pay for itself?</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">
        Drag to your rough monthly bookings revenue — we'll compare Starter's 5% against Pro's flat price.
      </p>

      <label htmlFor="earn" className="mt-7 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">Monthly bookings revenue</span>
        <span className="font-heading text-2xl font-extrabold text-ink">{inr(earn)}</span>
      </label>
      <input
        id="earn"
        type="range"
        min={0}
        max={50000}
        step={1000}
        value={earn}
        onChange={(e) => setEarn(Number(e.target.value))}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-sand accent-primary"
        style={{ accentColor: GROW }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
        <span>₹0</span>
        <span>₹50,000+</span>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border p-4" style={{ borderColor: `${OPERATE}44`, background: `${OPERATE}0d` }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: OPERATE }}>Starter · 5%</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-ink">{inr(commission)}<span className="text-sm font-semibold text-neutral-400"> /mo</span></p>
          <p className="mt-1 text-xs text-neutral-500">commission on your bookings</p>
        </div>
        <div className="rounded-[24px] border p-4" style={{ borderColor: `${GROW}55`, background: `${GROW}0d` }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GROW }}>Pro · flat</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-ink">{inr(activeCost)}<span className="text-sm font-semibold text-neutral-400"> /mo</span></p>
          <p className="mt-1 text-xs text-neutral-500">0% commission · billed yearly</p>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border-2 border-neutral-200 bg-sand p-4 text-sm text-neutral-700">
        {activeWins && saved > 0 && (
          <p className="mb-1 font-heading font-bold" style={{ color: GROW }}>
            Pro saves you about {inr(saved)} a month — before you count the automation.
          </p>
        )}
        <p>{verdict}</p>
      </div>

      <p className="mt-4 text-center text-[11px] text-neutral-400">
        Commission applies only to paid bookings. Yearly billing shown ({inr(PREMIUM_PLAN.yearly)}/year, under {PREMIUM_PER_DAY} a day, incl. GST).
      </p>
    </div>
  );
}

// A grouped block of comparison rows with a section header row.
function FragmentSection({ section, columns = PLAN_COLUMNS }) {
  return (
    <>
      <tr className="bg-sand/40">
        <td colSpan={columns.length + 1} className="px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-primary">
          {section.group}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.label} className="border-b border-neutral-200">
          <td className="py-3 pl-3 pr-4 text-sm text-neutral-700">{row.label}</td>
          {columns.map((c) => (
            <td key={c.key} className="px-3 py-3 text-center"><Cell value={row[c.key]} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}
