import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import {
  FREE_PLAN,
  PREMIUM_PLAN,
  PREMIUM_ANNUAL_SAVING,
  PREMIUM_YEARLY_PER_MONTH,
  PREMIUM_PLAN_USD,
  PREMIUM_USD_YEARLY_PER_MONTH,
} from "../../data/plans";
import useFeeOnly from "../../hooks/useFeeOnly";
import { getPricingRegion } from "../../lib/pricingRegion";

/* Homepage pricing — BlogSEO-style wide cards. Each plan is one card: a features
   page on the LEFT (plan name, blurb, two-column checklist) and a price panel on
   the RIGHT (per-card billing toggle, big price, CTA). Same data + rules as
   components/pricing/PricingCards and the old NotebookPricing it replaced:
   - Starter hides in interim fee-only mode (useFeeOnly; free signup still works)
   - outside India → USD list price + "Get early access" (no USD checkout yet)
   - yearly leads with the monthly-equivalent; the real yearly charge sits in the note */

const ROUTE_START = "/become-a-host"; // must match Home.jsx

/* Small "Billed yearly" switch (off = monthly, on = yearly). */
function BillToggle({ yearly, onChange }) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={yearly}
      aria-label="Billed yearly"
      onClick={() => onChange(!yearly)}
      className="inline-flex items-center gap-2.5 text-sm font-semibold text-ink"
    >
      <span
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
          yearly ? "bg-maroon" : "bg-neutral-300"
        }`}
      >
        <motion.span
          layout
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 32 }}
          className={`absolute h-4 w-4 rounded-full bg-white shadow-sm ${yearly ? "right-1" : "left-1"}`}
        />
      </span>
      Billed yearly
    </button>
  );
}

function PlanCard({
  plan,
  intro,
  price,
  suffix,
  note,
  cta,
  ctaTo,
  yearly,
  onToggle,
  chip,
}) {
  const reduce = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_24px_60px_-34px_rgba(61,5,22,0.4)]">
      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        {/* LEFT — who it's for + what's included */}
        <div className="p-7 sm:p-10">
          <h3 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {plan.name} Plan
          </h3>
          <p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-muted">
            {plan.persona.blurb}
          </p>

          <p className="mt-8 font-semibold text-maroon">
            {intro.lead}{" "}
            <span className="underline decoration-maroon/40 decoration-2 underline-offset-4">
              {intro.accent}
            </span>
          </p>
          <div className="mt-3 h-px w-full bg-black/5" />

          <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[15px] text-neutral-700">
                <Check size={18} className="mt-0.5 flex-shrink-0 text-maroon" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT — price + CTA */}
        <div className="flex flex-col justify-center border-t border-black/5 bg-cream p-7 text-center sm:p-10 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <BillToggle yearly={yearly} onChange={onToggle} />
            {chip && (
              <span className="rounded-full bg-maroon/10 px-2.5 py-1 text-xs font-bold text-maroon">
                {chip}
              </span>
            )}
          </div>

          <p className="mt-6 flex items-baseline justify-center gap-1.5">
            <span className="relative inline-flex overflow-hidden font-display text-5xl font-extrabold text-ink sm:text-6xl">
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
            <span className="text-left text-sm font-semibold leading-tight text-neutral-400">{suffix}</span>
          </p>
          <p className="mt-2 text-sm text-muted">{note}</p>

          <Link
            to={ctaTo}
            className="mt-7 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-maroon px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 hover:no-underline"
          >
            {cta}
          </Link>
          <p className="mt-4 text-xs text-muted">Cancel anytime. No contracts.</p>
        </div>
      </div>
    </div>
  );
}

export default function BlogSeoPricing({ startLabel = "Get Started - Free" }) {
  const [yearly, setYearly] = useState(true);
  const feeOnly = useFeeOnly();
  const [intl] = useState(() => getPricingRegion() === "INTL");

  const proPrice = intl
    ? `$${yearly ? PREMIUM_USD_YEARLY_PER_MONTH.toFixed(2) : PREMIUM_PLAN_USD.monthly}`
    : `₹${(yearly ? PREMIUM_YEARLY_PER_MONTH : PREMIUM_PLAN.monthly).toLocaleString("en-IN")}`;
  const proNote = intl
    ? yearly
      ? `billed $${PREMIUM_PLAN_USD.yearly}/year · USD`
      : `or $${PREMIUM_PLAN_USD.yearly}/year · USD`
    : yearly
      ? `billed ₹${PREMIUM_PLAN.yearly.toLocaleString("en-IN")}/year · incl. GST`
      : `or ₹${PREMIUM_PLAN.yearly.toLocaleString("en-IN")}/year · incl. GST`;
  const proSave = intl
    ? `$${PREMIUM_PLAN_USD.monthly * 12 - PREMIUM_PLAN_USD.yearly} / year`
    : `₹${PREMIUM_ANNUAL_SAVING.toLocaleString("en-IN")} / year`;

  return (
    <div className="space-y-6 lg:space-y-8">
      {!feeOnly && (
        <PlanCard
          plan={FREE_PLAN}
          intro={{ lead: "What you get", accent: "for free" }}
          price={intl ? "$0" : "₹0"}
          suffix="/ forever"
          note="We take 5% only when you get paid. Nothing when you don't."
          cta={startLabel}
          ctaTo={ROUTE_START}
          yearly={yearly}
          onToggle={setYearly}
          chip="Always free"
        />
      )}
      <PlanCard
        plan={PREMIUM_PLAN}
        intro={{ lead: "Everything in Starter,", accent: "plus" }}
        price={proPrice}
        suffix="/ month"
        note={proNote}
        cta={intl ? "Get early access" : "Go Pro — keep every rupee"}
        ctaTo={intl ? "/contact" : ROUTE_START}
        yearly={yearly}
        onToggle={setYearly}
        chip={`Save ${proSave}`}
      />
    </div>
  );
}
