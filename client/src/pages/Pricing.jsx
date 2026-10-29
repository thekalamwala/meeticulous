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
} from "../data/plans";
import PricingCards from "../components/pricing/PricingCards";
import useFeeOnly from "../hooks/useFeeOnly";
import { analytics, EVENTS } from "../services/analytics";
import useUtm from "../hooks/useUtm";

// /pricing — dedicated public pricing page. A product journey, not a spec sheet:
//   Sloth = Operate (free) → Sloth Active = Grow (premium).
// The plan cards, prices and the full feature comparison are single-sourced from
// client/src/data/plans.js (mirrors DB migration v3.165), so the table here, the
// homepage cards and the enforced server limits never drift apart. Only features
// the server actually enforces are shown (honesty rule — see plans.js).

const ROUTE_START = "/become-a-host";

// Green (Sloth / operate) vs orange (Active / grow) — the two plan accents from
// plans.js. Kept as locals so the storytelling sections read the same hues as the
// cards without re-hardcoding hex all over the file.
const OPERATE = FREE_PLAN.accent; // #4AB765
const GROW = PREMIUM_PLAN.accent; // #2E1065

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
    { "@type": "Offer", name: "Sloth", price: "0", priceCurrency: "INR", availability: "https://schema.org/InStock" },
    { "@type": "Offer", name: "Sloth Active (monthly)", price: "399", priceCurrency: "INR", availability: "https://schema.org/InStock" },
    { "@type": "Offer", name: "Sloth Active (yearly)", price: "3599", priceCurrency: "INR", availability: "https://schema.org/InStock" },
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
  // Interim (fee-only) mode: hide the free Sloth column + soften commission/earn
  // copy, and drop the free-vs-paid storytelling (it only makes sense once the
  // free plan is advertised). Reverts automatically when the DB flag flips on
  // Route go-live.
  const feeOnly = useFeeOnly();
  const columns = feeOnly ? PLAN_COLUMNS.filter((c) => c.key !== "free") : PLAN_COLUMNS;

  // plan_viewed — the pricing-visitor retargeting audience (Meta/GA4). Fire once
  // on mount, carrying first-touch ad attribution so the audience ties back to the
  // Reel/campaign that sent them here.
  const utm = useUtm();
  useEffect(() => { analytics.track(EVENTS.PLAN_VIEWED, { ...utm }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="bg-white">
      <Seo
        title={feeOnly ? "Pricing — Meeticulous | Sloth Active for creators & professionals" : "Pricing — Meeticulous | Start as a Sloth. Become Active as you grow."}
        description={feeOnly ? "Simple, honest pricing for your booking page — scheduling, reminders and automation. Sloth Active is ₹3,599 a year, GST included." : "Two plans, that's it. Sloth is free forever — put your business online and start taking bookings. Sloth Active turns those bookings into a business system. All prices include GST."}
        image={ogCard('pricing')}
        canonical={`${SITE_URL}/pricing`}
        jsonLd={JSON_LD}
      />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 pb-10 pt-16 sm:px-8 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          {!feeOnly && (
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-ink/10 bg-canvas px-3.5 py-1.5 text-xs font-semibold text-ink/70">
              <span aria-hidden="true">🦥</span>
              Start as a Sloth. Become Active when your business grows.
            </span>
          )}
          <h1 className="font-heading text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Pricing that grows{" "}
            <span className="text-primary">with your {feeOnly ? "practice" : "business"}.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[640px] text-neutral-500">
            {feeOnly
              ? "Pick the plan that fits your booking page. Upgrade anytime."
              : `Start for free. Stay free for as long as you need. When bookings start piling up, Sloth Active gives you the tools to run what happens next — for under ${PREMIUM_PER_DAY} a day.`}
          </p>
          {!feeOnly && <OperateGrowPills />}
        </div>
      </section>

      {/* ── Plan cards ─────────────────────────────────────── */}
      <section className="px-5 sm:px-8">
        <div className="mx-auto max-w-[1050px]">
          <PricingCards />
        </div>
        <p className="mx-auto mt-6 max-w-[1050px] text-center text-xs text-neutral-400">
          {feeOnly
            ? "All prices include GST · Cancel anytime"
            : `All prices include GST · Yearly saves ${PREMIUM_ANNUAL_SAVE_PCT}% · ~2.4% payment gateway fee applies (not our charge) · Cancel anytime`}
        </p>
      </section>

      {/* ── Growth journey — only in the two-plan (non-interim) world ── */}
      {!feeOnly && (
        <>
          <OperateVsGrow />
          <GrowingSection />
          <WhenToBecomeActive />
          <ValueSection />
          <PayForItself />
        </>
      )}

      {/* ── Full feature comparison ────────────────────────── */}
      <section className="bg-canvas px-5 pb-20 pt-16 sm:px-8 lg:pt-24">
        <div className="mx-auto max-w-[1050px]">
          <h2 className="text-center font-heading text-3xl font-extrabold text-ink sm:text-4xl">Everything you get</h2>
          <p className="mx-auto mt-3 max-w-[620px] text-center text-neutral-500">
            Everything Sloth gives you free, and everything you unlock with Sloth Active.
            Tap any <span className="font-semibold text-primary">Limited</span> tag for the detail.
          </p>

          <div className="mt-10 overflow-x-auto rounded-[6px] border-2 border-ink/10 bg-white p-1 sm:p-2">
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
                {PLAN_MATRIX.map((section) => (
                  <FragmentSection key={section.group} section={section} columns={columns} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Teams / agencies — no self-serve tier, one line to sales ── */}
      <section className="bg-canvas px-5 pb-14 sm:px-8">
        <p className="mx-auto max-w-[1050px] text-center text-sm text-neutral-500">
          Teams, agencies or multi-location practices?{" "}
          <Link to="/enterprise" className="font-semibold text-primary">Talk to sales →</Link>
        </p>
      </section>

      {/* ── Closing CTA ────────────────────────────────────── */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-[10px] bg-ink px-8 py-12 text-center text-white shadow-[0_24px_60px_-30px_rgba(26,26,26,0.6)]">
          <h2 className="font-heading text-3xl font-extrabold text-primary sm:text-4xl">
            {feeOnly ? "Ready when you are." : "Start slow. Grow when it counts."}
          </h2>
          <p className="mx-auto mt-3 max-w-[520px] text-neutral-300">
            Put your business online for free in minutes. Become Active in one click the day your bookings need it.
          </p>
          <Link
            to={ROUTE_START}
            className="mt-7 inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark hover:no-underline"
          >
            Start for free <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Storytelling sections (two-plan world only). All copy maps to real, enforced
 * gates from plans.js — no invented features, no fake booking thresholds.
 * ──────────────────────────────────────────────────────────────────────────── */

// Two little pills under the hero that name the whole idea in three words each.
function OperateGrowPills() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
      <span
        className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5"
        style={{ color: OPERATE, borderColor: `${OPERATE}55`, background: `${OPERATE}12` }}
      >
        <Sprout size={16} strokeWidth={2} /> Sloth · Operate
      </span>
      <ArrowRight size={18} className="text-ink/30" aria-hidden="true" />
      <span
        className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5"
        style={{ color: GROW, borderColor: `${GROW}55`, background: `${GROW}12` }}
      >
        <Rocket size={16} strokeWidth={2} /> Sloth Active · Grow
      </span>
    </div>
  );
}

// The core distinction, made visual: a calm green "Operate" panel, an arrow, and
// a bolder orange "Grow" panel. This is the Sloth → Active transition.
function OperateVsGrow() {
  return (
    <section className="px-5 pt-20 sm:px-8 lg:pt-24">
      <div className="mx-auto max-w-[1050px]">
        <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
          <StatePanel
            accent={OPERATE}
            icon={<Sprout size={22} strokeWidth={2} />}
            kicker="Sloth"
            title="Operate"
            line="Start taking bookings. Put your business online and accept appointments — free forever."
          />
          <div className="flex items-center justify-center py-2 md:py-0">
            <span
              className="grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-white text-ink/50 shadow-[0_8px_24px_-12px_rgba(26,26,26,0.4)]"
              aria-hidden="true"
            >
              <ArrowRight size={20} className="md:block hidden" />
              <TrendingUp size={20} className="md:hidden block" />
            </span>
          </div>
          <StatePanel
            accent={GROW}
            emphasised
            icon={<Rocket size={22} strokeWidth={2} />}
            kicker="Sloth Active"
            title="Grow"
            line="Turn bookings into a business system — automation, a real client CRM, and 0% commission so you keep every rupee."
          />
        </div>
      </div>
    </section>
  );
}

function StatePanel({ accent, icon, kicker, title, line, emphasised }) {
  return (
    <div
      className="group flex h-full flex-col rounded-[10px] border bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.05)] transition-shadow duration-300 hover:shadow-[0_24px_60px_-28px_var(--glow)] sm:p-8"
      style={{
        borderColor: emphasised ? `${accent}4d` : "rgba(0,0,0,0.06)",
        "--glow": emphasised ? `${accent}80` : "rgba(26,26,26,0.16)",
      }}
    >
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-[6px]"
        style={{ color: accent, background: `${accent}14` }}
      >
        {icon}
      </span>
      <p className="mt-5 text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>{kicker}</p>
      <h3 className="mt-1 font-heading text-3xl font-extrabold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">{line}</p>
    </div>
  );
}

// "Your business is growing." — the emotional bridge from free to paid.
function GrowingSection() {
  return (
    <section className="px-5 pt-20 sm:px-8 lg:pt-24">
      <div
        className="mx-auto max-w-[1050px] rounded-[6px] border-2 border-ink/10 bg-sand px-6 py-12 text-center sm:px-12"
      >
        <h2 className="font-heading text-3xl font-extrabold text-ink sm:text-4xl">Your business is growing.</h2>
        <p className="mx-auto mt-4 max-w-[620px] text-neutral-600">
          You started with bookings. Now you're getting repeat customers, more appointments and more
          things to manage.
        </p>
        <p className="mt-4 font-heading text-lg font-bold" style={{ color: GROW }}>
          That's when Sloth Active becomes useful.
        </p>
      </div>
    </section>
  );
}

// "When should you become Active?" — four stages. No fake numbers: the only
// figure named (₹6,000/mo) is the real breakeven — 5% commission = the effective
// ₹300/mo Active price (see plans.js persona blurb + PayForItself calculator).
const STAGES = [
  {
    tag: "Starting out",
    lead: "0 → your first bookings",
    body: "Sloth is enough. Get your booking page online and start accepting appointments — nothing to pay until you do.",
    accent: OPERATE,
    plan: "Sloth",
  },
  {
    tag: "Getting busy",
    lead: "Bookings coming in regularly",
    body: "Automation starts saving you time. 1-hour reminders, reschedule alerts and follow-ups keep customers showing up.",
    accent: "#f59e0b",
    plan: "Sloth Active",
  },
  {
    tag: "Growing",
    lead: "More customers. More to manage.",
    body: "You need visibility. A full client CRM with notes and history, plus rebook automation to bring people back.",
    accent: "#db2777",
    plan: "Sloth Active",
  },
  {
    tag: "Running the business",
    lead: "Bookings are your engine",
    body: "Earning over ₹6,000 a month? At 0% commission, Sloth Active already costs you less than the 5% — and you keep it all.",
    accent: GROW,
    plan: "Sloth Active",
  },
];

function WhenToBecomeActive() {
  return (
    <section className="px-5 pt-20 sm:px-8 lg:pt-24">
      <div className="mx-auto max-w-[1050px]">
        <h2 className="text-center font-heading text-3xl font-extrabold text-ink sm:text-4xl">
          When should you become Active?
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-neutral-500">
          There's no rush. Move up a stage only when the last one starts to feel busy.
        </p>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, i) => (
            <li
              key={s.tag}
              className="group relative flex flex-col rounded-[6px] border-2 border-ink/10 bg-white p-6 transition-transform hover:-translate-y-1"
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-[4px] font-heading text-sm font-extrabold text-white"
                style={{ background: s.accent }}
              >
                {i + 1}
              </span>
              <p className="mt-4 font-heading text-lg font-extrabold text-ink">{s.tag}</p>
              <p className="mt-1 text-xs font-semibold" style={{ color: s.accent }}>{s.lead}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-600">{s.body}</p>
              <p className="mt-4 border-t border-black/5 pt-3 text-xs font-semibold text-neutral-500">
                On <span style={{ color: s.accent }}>{s.plan}</span>
              </p>
            </li>
          ))}
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
    accent: "#db2777",
  },
  {
    icon: BarChart3,
    title: "Understand your business",
    body: "See your earnings, transaction history and exactly what commission you've paid — the numbers behind your bookings.",
    accent: "#2E1065",
  },
  {
    icon: TrendingUp,
    title: "Grow intentionally",
    body: "Rebook automation and unlimited AI service writing to bring customers back and keep your page selling.",
    accent: OPERATE,
  },
];

function ValueSection() {
  return (
    <section className="px-5 pt-20 sm:px-8 lg:pt-24">
      <div className="mx-auto max-w-[1050px]">
        <h2 className="text-center font-heading text-3xl font-extrabold text-ink sm:text-4xl">
          What Active actually does for you
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-neutral-500">
          It's not "25 more features." It's four things that matter as you grow.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="group flex items-start gap-4 rounded-[6px] border-2 border-ink/10 bg-white p-6 transition-transform hover:-translate-y-1 sm:p-7"
              >
                <span
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[6px]"
                  style={{ color: v.accent, background: `${v.accent}14` }}
                >
                  <Icon size={20} strokeWidth={2} />
                </span>
                <div>
                  <h3 className="font-heading text-lg font-extrabold text-ink">{v.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{v.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// "Does Active pay for itself?" — an honest calculator, not decoration. It uses
// only real pricing logic: Sloth's 5% commission vs Sloth Active's flat effective
// ₹300/mo (yearly billing) at 0% commission. Breakeven is ₹6,000/mo of paid
// bookings (0.05 × 6,000 = 300), matching the plans.js persona blurb.
const COMMISSION_PCT = 5; // FREE_PLAN commission — mirrors subscription_plans
const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function PayForItself() {
  const [earn, setEarn] = useState(8000);
  const commission = (earn * COMMISSION_PCT) / 100; // what Sloth's 5% costs this month
  const activeCost = PREMIUM_YEARLY_PER_MONTH; // flat ₹300/mo effective (yearly)
  const activeWins = commission >= activeCost;
  const saved = Math.max(0, commission - activeCost);

  let verdict;
  if (earn < 6000) {
    verdict = "You're just starting out. Sloth is free and the 5% only applies when you actually get paid — stay on Sloth for now.";
  } else if (earn < 15000) {
    verdict = "You're getting busy. Sloth Active's flat price already costs less than the 5% here — and you keep every rupee, plus automation and CRM.";
  } else {
    verdict = "You're running a real business. Active pays for itself several times over, and the automation and CRM keep the volume manageable.";
  }

  return (
    <section className="px-5 pt-20 sm:px-8 lg:pt-24">
      <div className="mx-auto max-w-[1050px]">
        <h2 className="text-center font-heading text-3xl font-extrabold text-ink sm:text-4xl">
          Does Active pay for itself?
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-neutral-500">
          Drag to your rough monthly bookings revenue. We'll compare Sloth's 5% against Sloth Active's flat price.
        </p>

        <div className="mx-auto mt-10 max-w-[720px] rounded-[10px] border border-ink/10 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.05)] sm:p-8">
          <label htmlFor="earn" className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-ink">Your monthly bookings revenue</span>
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
            <div
              className="rounded-[6px] border-2 p-4"
              style={{ borderColor: `${OPERATE}44`, background: `${OPERATE}0d` }}
            >
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: OPERATE }}>Sloth · 5%</p>
              <p className="mt-1 font-heading text-2xl font-extrabold text-ink">{inr(commission)}<span className="text-sm font-semibold text-neutral-400"> /mo</span></p>
              <p className="mt-1 text-xs text-neutral-500">commission on your bookings</p>
            </div>
            <div
              className="rounded-[6px] border-2 p-4"
              style={{ borderColor: `${GROW}55`, background: `${GROW}0d` }}
            >
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GROW }}>Sloth Active · flat</p>
              <p className="mt-1 font-heading text-2xl font-extrabold text-ink">{inr(activeCost)}<span className="text-sm font-semibold text-neutral-400"> /mo</span></p>
              <p className="mt-1 text-xs text-neutral-500">0% commission · billed yearly</p>
            </div>
          </div>

          <div
            className="mt-5 rounded-[6px] border-2 border-ink/10 bg-canvas p-4 text-sm text-neutral-700"
          >
            {activeWins && saved > 0 && (
              <p className="mb-1 font-heading font-bold" style={{ color: GROW }}>
                Sloth Active saves you about {inr(saved)} a month — before you count the automation.
              </p>
            )}
            <p>{verdict}</p>
          </div>

          <p className="mt-4 text-center text-[11px] text-neutral-400">
            Commission applies only to paid bookings. Yearly billing shown ({inr(PREMIUM_PLAN.yearly)}/year, under {PREMIUM_PER_DAY} a day, incl. GST).
          </p>
        </div>
      </div>
    </section>
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
        <tr key={row.label} className="border-b border-black/5">
          <td className="py-3 pl-3 pr-4 text-sm text-neutral-700">{row.label}</td>
          {columns.map((c) => (
            <td key={c.key} className="px-3 py-3 text-center"><Cell value={row[c.key]} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}
