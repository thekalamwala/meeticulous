import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle2, Sprout, Rocket, Wallet, BadgePercent } from "lucide-react";
import {
  FREE_PLAN,
  PREMIUM_PLAN,
  PREMIUM_PER_DAY,
  PREMIUM_ANNUAL_SAVE_PCT,
  PREMIUM_YEARLY_PER_MONTH,
  PREMIUM_PLAN_USD,
  PREMIUM_USD_YEARLY_PER_MONTH,
  PREMIUM_USD_ANNUAL_SAVE_PCT,
} from "../../data/plans";
import useFeeOnly from "../../hooks/useFeeOnly";
import { getPricingRegion } from "../../lib/pricingRegion";

/* Homepage-only pricing: each plan is a "notebook" — a features page on the
   left, a price page on the right, bound by spiral rings — stacked Starter
   then Pro on a crimson field. Same data + rules as components/pricing/
   PricingCards (which /pricing and the other pages keep using):
   - Starter hides in interim fee-only mode (useFeeOnly; free signup still works)
   - outside India → USD list price + "Get early access" (no USD checkout yet)
   - yearly tab leads with the monthly-equivalent, real yearly charge underneath */

const ROUTE_START = "/become-a-host"; // must match Home.jsx
const ICONS = { Sprout, Rocket };

// Spiral binding between the two pages (lg+). A soft vertical spine runs down
// the centre gap; each ring is a capsule threaded over the spine, its two ends
// resting on the white pages with a punched hole on either side.
function Rings() {
  return (
    <div aria-hidden className="relative z-10 hidden w-10 flex-shrink-0 self-stretch lg:block">
      {/* spine the rings are bound to */}
      <div className="absolute inset-y-7 left-1/2 w-3.5 -translate-x-1/2 rounded-full bg-pink-200/80 shadow-[inset_0_0_0_1px_rgba(214,90,121,0.35)]" />
      {/* rings */}
      <div className="absolute inset-0 flex flex-col items-center justify-evenly py-10">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="flex h-6 w-[72px] items-center justify-between rounded-full border-[3px] border-pink-300 bg-pink-100 shadow-[0_3px_7px_-1px_rgba(61,5,22,0.28)]"
          >
            <span className="-ml-2 h-4 w-4 rounded-full bg-maroon-300 ring-[3px] ring-white" />
            <span className="-mr-2 h-4 w-4 rounded-full bg-maroon-300 ring-[3px] ring-white" />
          </span>
        ))}
      </div>
    </div>
  );
}

const PAGE = "rounded-3xl bg-white shadow-[0_24px_60px_-28px_rgba(61,5,22,0.45)]";
const CHIP = "inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-ink";

function Notebook({ plan, chipIcon: ChipIcon, chip, price, suffix, note, cta, ctaTo, ctaClass }) {
  const PlanIcon = ICONS[plan.icon] ?? Rocket;
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-0">
      {/* LEFT page — who it's for + what's included */}
      <div className={`${PAGE} p-7 sm:p-10 lg:flex-[1.45]`}>
        <span className={CHIP}>
          <PlanIcon size={14} className="text-maroon" />
          {plan.name} · {plan.persona.title}
        </span>
        <h3 className="mt-4 max-w-[440px] font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          {plan.tagline}
        </h3>
        <p className="mt-4 max-w-[520px] text-sm leading-relaxed text-muted">{plan.persona.blurb}</p>

        <p className="mt-7 font-display text-2xl font-extrabold tracking-tight text-ink">{plan.intro ?? "What's included"}</p>
        <ul className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-[15px] text-neutral-700">
              <CheckCircle2 size={20} className="mt-px flex-shrink-0 fill-c-emerald text-white" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <Rings />

      {/* RIGHT page — price + CTA */}
      <div className={`${PAGE} flex flex-col items-center justify-center p-7 text-center sm:p-10 lg:flex-1`}>
        <span className={CHIP}>
          <ChipIcon size={14} className="text-c-emerald" />
          {chip}
        </span>
        <p className="mt-5 flex items-baseline justify-center gap-1.5">
          <span className="relative inline-flex overflow-hidden font-sans text-5xl font-extrabold text-ink sm:text-6xl">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={price}
                initial={reduce ? false : { y: "0.5em", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { y: "-0.5em", opacity: 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="inline-block"
              >
                {price}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="text-2xl font-extrabold text-neutral-300 sm:text-3xl">{suffix}</span>
        </p>
        <Link
          to={ctaTo}
          className={`mt-7 inline-flex w-full max-w-[320px] items-center justify-center gap-1 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 hover:no-underline ${ctaClass}`}
        >
          {cta} →
        </Link>
        <p className="mt-5 max-w-[280px] text-xs leading-relaxed text-ink/70">{note}</p>
      </div>
    </div>
  );
}

export default function NotebookPricing({ startLabel = "Get Started - Free" }) {
  const [yearly, setYearly] = useState(true);
  const reduce = useReducedMotion();
  const thumbT = reduce ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] };
  const feeOnly = useFeeOnly();
  const [intl] = useState(() => getPricingRegion() === "INTL");
  const savePct = intl ? PREMIUM_USD_ANNUAL_SAVE_PCT : PREMIUM_ANNUAL_SAVE_PCT;

  const proPrice = intl
    ? `$${yearly ? PREMIUM_USD_YEARLY_PER_MONTH.toFixed(2) : PREMIUM_PLAN_USD.monthly}`
    : `₹${(yearly ? PREMIUM_YEARLY_PER_MONTH : PREMIUM_PLAN.monthly).toLocaleString("en-IN")}`;
  const proNote = intl
    ? yearly
      ? `billed $${PREMIUM_PLAN_USD.yearly}/year · USD`
      : `or $${PREMIUM_PLAN_USD.yearly}/year · USD`
    : yearly
      ? `billed ₹${PREMIUM_PLAN.yearly.toLocaleString("en-IN")}/year · under ${PREMIUM_PER_DAY} a day · incl. GST`
      : `or ₹${PREMIUM_PLAN.yearly.toLocaleString("en-IN")}/year · incl. GST`;

  return (
    <div>
      {/* Billing toggle — animated sliding pill (the active segment's dark
          background slides between Monthly/Yearly via a shared layoutId). */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setYearly(false)}
            aria-pressed={!yearly}
            className="relative rounded-full px-5 py-1.5 text-sm font-semibold"
          >
            {!yearly && (
              <motion.span
                layoutId="billing-thumb"
                transition={thumbT}
                className="absolute inset-0 rounded-full bg-ink"
              />
            )}
            <span className={`relative z-10 transition-colors ${!yearly ? "text-white" : "text-neutral-500 hover:text-ink"}`}>
              Monthly
            </span>
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            aria-pressed={yearly}
            className="relative inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-semibold"
          >
            {yearly && (
              <motion.span
                layoutId="billing-thumb"
                transition={thumbT}
                className="absolute inset-0 rounded-full bg-ink"
              />
            )}
            <span className={`relative z-10 transition-colors ${yearly ? "text-white" : "text-neutral-500 hover:text-ink"}`}>
              Yearly
            </span>
            <span className={`relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${yearly ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
              Save {savePct}%
            </span>
          </button>
        </div>
      </div>

      {/* Crimson field the notebooks sit on */}
      <div className="mt-8 space-y-8 rounded-3xl bg-maroon px-4 py-8 sm:px-8 sm:py-10 lg:space-y-10 lg:px-10 lg:py-10">
        {!feeOnly && (
          <Notebook
            plan={FREE_PLAN}
            chipIcon={BadgePercent}
            chip={`Free forever · ${FREE_PLAN.badge}`}
            price={intl ? "$0" : "₹0"}
            suffix="/ forever"
            note="We take 5% when you get paid. Nothing when you don't."
            cta={startLabel}
            ctaTo={ROUTE_START}
            ctaClass="bg-ink"
          />
        )}
        <Notebook
          plan={PREMIUM_PLAN}
          chipIcon={Wallet}
          chip={yearly ? `Save ${savePct}% · billed yearly` : "0% commission"}
          price={proPrice}
          suffix="/ month"
          note={proNote}
          cta={intl ? "Get early access" : "Go Premium"}
          ctaTo={intl ? "/contact" : ROUTE_START}
          ctaClass="bg-maroon"
        />
      </div>
    </div>
  );
}
