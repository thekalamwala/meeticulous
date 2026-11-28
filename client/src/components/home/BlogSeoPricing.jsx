import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, animate, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import {
  FREE_PLAN,
  PREMIUM_PLAN,
  PREMIUM_ANNUAL_SAVING,
  PREMIUM_YEARLY_PER_MONTH,
  PREMIUM_PLAN_USD,
  PREMIUM_USD_YEARLY_PER_MONTH,
} from "../../data/plans";
import { getPricingRegion } from "../../lib/pricingRegion";

/* Homepage pricing — BlogSEO-style wide cards. Each plan is one card: a features
   page on the LEFT (plan name, blurb, two-column checklist) and a price panel on
   the RIGHT (per-card billing toggle, big price, CTA). Same data + rules as
   components/pricing/PricingCards and the old NotebookPricing it replaced:
   - Pro on top, Starter below it. Starter always shows (founder 2026-11-28,
     overriding the interim fee-only hide); only Pro has a billing toggle
   - outside India → USD list price + "Get early access" (no USD checkout yet)
   - Pro shows the charge for the selected billing period */

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
      {/* Stable label: a switch names its ON state; the price suffix shows the period. */}
      Billed yearly
    </button>
  );
}

/* Odometer price (founder 2026-11-28). On a change the number counts from the old
   value to the new one in 400ms on an expo ease-out, and every digit is a 0–9
   wheel positioned from that running value, carrying like a real odometer: the
   units wheel turns fastest and the last two wheels visibly slow into place at
   the end. Wheels that are leading zeros mid-roll (₹1,199 → ₹199) collapse.
   Reduced motion: jumps straight to the value. */
function OdometerPrice({ value, currency, locale }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(value);
  const shown = useRef(value);
  const [span, setSpan] = useState(String(value).length);

  useEffect(() => {
    if (reduce || shown.current === value) {
      shown.current = value;
      setV(value);
      setSpan(String(value).length);
      return undefined;
    }
    setSpan((n) => Math.max(n, String(value).length));
    const ctrl = animate(shown.current, value, {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (x) => { shown.current = x; setV(x); },
      onComplete: () => { shown.current = value; setV(value); setSpan(String(value).length); },
    });
    return () => ctrl.stop();
  }, [value, reduce]);

  const wheels = [];
  for (let k = span - 1; k >= 0; k -= 1) {
    const unit = 10 ** k;
    const base = Math.floor(v / unit) % 10;
    // A wheel turns only while every wheel to its right is between 9 and 10.
    const carry = k === 0 ? v % 1 : Math.max(0, (v % unit) - (unit - 1));
    const hidden = k > 0 && v < unit - 1; // leading zero (shows once its carry starts)
    // Grouping: en-IN 1,19,999 (comma after thousands, then every 2); en-US every 3.
    const comma = locale === "en-IN" ? k >= 3 && (k - 3) % 2 === 0 : k >= 3 && k % 3 === 0;
    wheels.push(
      <span
        key={k}
        className="inline-flex overflow-hidden transition-[max-width,opacity] duration-150"
        style={{ maxWidth: hidden ? 0 : "1.2em", opacity: hidden ? 0 : 1 }}
      >
        <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden">
          <span
            className="absolute inset-x-0 top-0 flex flex-col"
            style={{ transform: `translateY(-${base + carry}em)` }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => (
              <span key={i} className="flex h-[1em] items-center justify-center leading-none">{n}</span>
            ))}
          </span>
        </span>
        {comma && <span className="leading-none">,</span>}
      </span>,
    );
  }

  return (
    <span role="img" aria-label={`${currency}${value.toLocaleString(locale)}`} className="inline-flex">
      <span aria-hidden="true" className="inline-flex h-[1em] items-center leading-none tabular-nums">
        <span>{currency}</span>
        {wheels}
      </span>
    </span>
  );
}

function PlanCard({
  plan,
  intro,
  amount,
  currency,
  locale,
  suffix,
  note,
  cta,
  ctaTo,
  yearly,
  onToggle,
  chip,
}) {
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
            {onToggle && <BillToggle yearly={yearly} onChange={onToggle} />}
            {chip && (
              <span className="ml-auto rounded-full bg-maroon/10 px-2.5 py-1 text-xs font-bold text-maroon">
                {chip}
              </span>
            )}
          </div>

          <p className="mt-6 flex items-baseline justify-center gap-1.5">
            <span className="font-display text-5xl font-extrabold text-ink sm:text-6xl">
              <OdometerPrice value={amount} currency={currency} locale={locale} />
            </span>
            <span className="text-left text-sm font-semibold leading-tight text-neutral-400">{suffix}</span>
          </p>
          <p className="mt-2 text-sm text-muted" aria-live={onToggle ? "polite" : undefined}>{note}</p>

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
  const [intl] = useState(() => getPricingRegion() === "INTL");

  const prices = intl ? PREMIUM_PLAN_USD : PREMIUM_PLAN;
  const currency = intl ? "$" : "₹";
  const period = yearly ? "year" : "month";
  const amount = yearly ? prices.yearly : prices.monthly;
  const locale = intl ? "en-US" : "en-IN";
  const monthlyEquivalent = intl ? PREMIUM_USD_YEARLY_PER_MONTH.toFixed(2) : PREMIUM_YEARLY_PER_MONTH;
  const taxNote = intl ? "USD" : "incl. GST";
  const proNote = yearly
    ? `Equivalent to ${currency}${monthlyEquivalent}/month · ${taxNote}`
    : `Billed monthly · ${taxNote}`;
  const proSave = intl
    ? `$${PREMIUM_PLAN_USD.monthly * 12 - PREMIUM_PLAN_USD.yearly} / year`
    : `₹${PREMIUM_ANNUAL_SAVING.toLocaleString("en-IN")} / year`;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PlanCard
        plan={PREMIUM_PLAN}
        intro={{ lead: "Everything in Starter,", accent: "plus" }}
        amount={amount}
        currency={currency}
        locale={locale}
        suffix={`/ ${period}`}
        note={proNote}
        cta={intl ? "Get early access" : "Go Pro — keep every rupee"}
        ctaTo={intl ? "/contact" : ROUTE_START}
        yearly={yearly}
        onToggle={setYearly}
        chip={yearly ? `Save ${proSave}` : undefined}
      />
      <PlanCard
        plan={FREE_PLAN}
        intro={{ lead: "What you get", accent: "for free" }}
        amount={0}
        currency={currency}
        locale={locale}
        suffix="/ forever"
        note="We take 9% only when you get paid. Nothing when you don't."
        cta={startLabel}
        ctaTo={ROUTE_START}
        chip="Always free"
      />
    </div>
  );
}
